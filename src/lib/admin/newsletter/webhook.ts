import "server-only";
import { integrations } from "@/lib/integrations";
import { asJson, crmDb, UNIQUE_VIOLATION, type CrmDatabase } from "@/lib/admin/customers/crm-db";
import {
  mapResendEvent,
  nextMessageStatus,
  timestampFields,
  type MessageStatus,
} from "./resend-events";

/**
 * Resend-Webhook (Route src/app/api/webhooks/resend/route.ts). Signaturprüfung über
 * integrations().email.verifyWebhook (Svix), Idempotenz über webhook_events(provider, event_id).
 * Wirkung: email_messages und campaign_recipients (Status, Zeitstempel); harter Bounce und
 * Beschwerde sperren die Adresse automatisch (email_suppressions) und setzen den Newsletter-Kontakt
 * auf bounced bzw. complained.
 */

export type WebhookOutcome =
  | { status: "invalid_signature" }
  | { status: "duplicate" }
  | { status: "ignored"; type: string }
  | { status: "processed"; type: string }
  | { status: "failed"; error: string };

export async function handleResendWebhook(
  rawBody: string,
  headers: Record<string, string | null>,
): Promise<WebhookOutcome> {
  let event: { type: string; data: unknown; created_at?: unknown };
  try {
    event = (await integrations().email.verifyWebhook(rawBody, headers)) as typeof event;
  } catch {
    return { status: "invalid_signature" };
  }

  const db = crmDb();
  const mapped = mapResendEvent(event);
  const eventId =
    headers["svix-id"] ||
    (mapped ? `${mapped.messageId}:${event.type}` : `${event.type}:${Date.now()}`);

  const { data: existing } = await db
    .from("webhook_events")
    .select("id, processed_at")
    .eq("provider", "resend")
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing?.processed_at) return { status: "duplicate" };
  let rowId = existing?.id ?? null;
  if (!rowId) {
    const { data: inserted, error } = await db
      .from("webhook_events")
      .insert({
        provider: "resend",
        event_id: eventId,
        event_type: event.type,
        payload: asJson(event),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { status: "duplicate" };
      return { status: "failed", error: error.message };
    }
    rowId = inserted.id;
  }

  try {
    if (!mapped) {
      await db
        .from("webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", rowId);
      return { status: "ignored", type: event.type };
    }
    await applyEvent(mapped);
    await db
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("id", rowId);
    return { status: "processed", type: event.type };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from("webhook_events")
      .update({ processing_error: message.slice(0, 1000) })
      .eq("id", rowId);
    return { status: "failed", error: message };
  }
}

type Tables = CrmDatabase["public"]["Tables"];
type MessagePatch = Tables["email_messages"]["Update"];
type RecipientPatch = Tables["campaign_recipients"]["Update"];

async function applyEvent(ev: NonNullable<ReturnType<typeof mapResendEvent>>): Promise<void> {
  const db = crmDb();
  const fields = timestampFields(ev.kind);

  // Versandprotokoll
  const { data: messages } = await db
    .from("email_messages")
    .select("id, status, to_email, delivered_at, opened_at, clicked_at, customer_id")
    .eq("provider_message_id", ev.messageId);
  for (const m of messages ?? []) {
    const patch: MessagePatch = {};
    const status = nextMessageStatus(m.status as MessageStatus, ev.kind, ev.permanentBounce);
    if (status !== m.status) patch.status = status;
    for (const f of fields) {
      if ((f === "delivered_at" || f === "opened_at" || f === "clicked_at") && !m[f])
        patch[f] = ev.at;
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from("email_messages").update(patch).eq("id", m.id);
      if (error) throw new Error(`email_messages: ${error.message}`);
    }
  }

  // Kampagnen-Empfänger
  const { data: recipients } = await db
    .from("campaign_recipients")
    .select(
      "campaign_id, contact_id, status, delivered_at, opened_at, clicked_at, bounced_at, complained_at",
    )
    .eq("provider_message_id", ev.messageId);
  for (const r of recipients ?? []) {
    const patch: RecipientPatch = {};
    const status = nextMessageStatus(r.status as MessageStatus, ev.kind, ev.permanentBounce);
    if (status !== r.status) patch.status = status;
    for (const f of fields) {
      if (f === "bounced_at" && !ev.permanentBounce) continue;
      if (!r[f]) patch[f] = ev.at;
    }
    if (Object.keys(patch).length) {
      const { error } = await db
        .from("campaign_recipients")
        .update(patch)
        .eq("campaign_id", r.campaign_id)
        .eq("contact_id", r.contact_id);
      if (error) throw new Error(`campaign_recipients: ${error.message}`);
    }
  }

  // Automatische Sperre bei hartem Bounce und Beschwerde
  const blocks = (ev.kind === "bounced" && ev.permanentBounce) || ev.kind === "complained";
  if (!blocks) return;
  const emails = new Set<string>(ev.recipients);
  for (const m of messages ?? []) emails.add(String(m.to_email).toLowerCase());
  const reason = ev.kind === "complained" ? "complaint" : "bounce";
  for (const email of emails) {
    const { error } = await db
      .from("email_suppressions")
      .upsert(
        { email, reason, source: `resend:${ev.messageId}` },
        { onConflict: "email", ignoreDuplicates: true },
      );
    if (error) throw new Error(`email_suppressions: ${error.message}`);
    const { data: contact } = await db
      .from("newsletter_contacts")
      .select("id, status, customer_id")
      .eq("email", email)
      .maybeSingle();
    if (contact && contact.status !== "bounced" && contact.status !== "complained") {
      await db
        .from("newsletter_contacts")
        .update({
          status: ev.kind === "complained" ? "complained" : "bounced",
          unsubscribed_at: ev.at,
          unsubscribe_reason: ev.kind === "complained" ? "beschwerde" : "bounce",
        })
        .eq("id", contact.id);
      try {
        await integrations().email.upsertContact({ email, unsubscribed: true });
      } catch (e) {
        console.error("[resend] Kontakt nicht abgemeldet", e);
      }
    }
  }
}
