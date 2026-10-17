import "server-only";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { oneClickUnsubscribeUrlFor, unsubscribeUrlFor } from "@/lib/admin/emails/context";
import { isContactSendable } from "@/lib/admin/emails/policy";
import { sendTrackedEmail, type EmailStatus } from "@/lib/admin/emails/send";
import { enqueueCrmJob } from "@/lib/admin/automations/queue";
import { parseStoredRules } from "@/lib/admin/segments/rules";
import { allSendableContactIds, segmentContactIds } from "@/lib/admin/segments/segments";
import { personalize, renderCampaignHtml } from "./render";
import { getCampaignStats } from "./campaigns";

/**
 * Versand einer Kampagne über die Job-Queue:
 *   newsletter.dispatch     Zielgruppe zum Versandzeitpunkt bestimmen (nur subscribed mit
 *                           confirmed_at, nicht gesperrt), campaign_recipients anlegen, erste Batch.
 *   newsletter.send_batch   BATCH_SIZE Empfänger senden, nächste Batch einreihen, am Ende Status
 *                           "sent" und Kennzahlen. Jeder Empfänger wird vor dem Senden erneut
 *                           geprüft (Abmeldung zwischen Planung und Versand).
 * Bis zum Go-live blockiert sendTrackedEmail alle Adressen außerhalb der Allowlist
 * (Status blocked_allowlist am Empfänger, keine Mail).
 */

export const BATCH_SIZE = 25;
const CHUNK = 200;

export async function dispatchCampaign(campaignId: string): Promise<void> {
  const db = crmDb();
  const { data: campaign, error } = await db
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw dbError("Kampagne laden", error);
  if (!campaign) return;
  if (campaign.status !== "scheduled" && campaign.status !== "sending") return; // abgebrochen oder entplant

  const rules = campaign.segment_snapshot ? parseStoredRules(campaign.segment_snapshot) : null;
  if (campaign.segment_snapshot && !rules) {
    await db.from("newsletter_campaigns").update({ status: "failed" }).eq("id", campaignId);
    throw new Error("Segment-Schnappschuss ungültig");
  }
  const contactIds = rules ? await segmentContactIds(rules) : await allSendableContactIds();

  await db.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaignId);

  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const ids = contactIds.slice(i, i + CHUNK);
    const { data: contacts, error: cErr } = await db
      .from("newsletter_contacts")
      .select("id, email")
      .in("id", ids);
    if (cErr) throw dbError("Kontakte laden", cErr);
    if (!contacts?.length) continue;
    const { error: insErr } = await db.from("campaign_recipients").upsert(
      contacts.map((c) => ({
        campaign_id: campaignId,
        contact_id: c.id,
        email: c.email,
        status: "queued" as const,
      })),
      { onConflict: "campaign_id,contact_id", ignoreDuplicates: true },
    );
    if (insErr) throw dbError("Empfänger anlegen", insErr);
  }
  const { count } = await db
    .from("campaign_recipients")
    .select("contact_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  await db
    .from("newsletter_campaigns")
    .update({ recipients_count: count ?? 0 })
    .eq("id", campaignId);

  await enqueueCrmJob({
    kind: "newsletter.send_batch",
    payload: { campaign_id: campaignId, batch: 1 },
    idempotencyKey: `newsletter.send_batch:${campaignId}:1`,
    priority: 90,
  });
}

export async function sendCampaignBatch(campaignId: string, batch: number): Promise<void> {
  const db = crmDb();
  const { data: campaign, error } = await db
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw dbError("Kampagne laden", error);
  if (!campaign || campaign.status !== "sending") return;
  // Schutz vor Endlosschleifen, falls Empfänger nicht aktualisiert werden konnten
  const maxBatches = Math.ceil(campaign.recipients_count / BATCH_SIZE) + 3;
  if (batch > maxBatches) {
    await db.from("newsletter_campaigns").update({ status: "failed" }).eq("id", campaignId);
    throw new Error(`Kampagne ${campaignId}: mehr Batches als Empfänger, Versand gestoppt`);
  }

  const { data: recipients, error: rErr } = await db
    .from("campaign_recipients")
    .select("contact_id, email")
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .order("contact_id")
    .limit(BATCH_SIZE);
  if (rErr) throw dbError("Empfänger laden", rErr);

  if (recipients && recipients.length > 0) {
    const mail = await renderCampaignHtml({
      id: campaign.id,
      subject: campaign.subject,
      preheader: campaign.preheader,
      content: campaign.content,
    });
    const { data: contacts } = await db
      .from("newsletter_contacts")
      .select("id, email, status, confirmed_at, unsubscribe_token, customer_id")
      .in(
        "id",
        recipients.map((r) => r.contact_id),
      );
    const byId = new Map((contacts ?? []).map((c) => [c.id, c]));

    for (const r of recipients) {
      const contact = byId.get(r.contact_id);
      const now = new Date().toISOString();
      if (!contact || !isContactSendable(contact)) {
        await db
          .from("campaign_recipients")
          .update({ status: "suppressed", error: "Nicht mehr abonniert" })
          .eq("campaign_id", campaignId)
          .eq("contact_id", r.contact_id);
        continue;
      }
      const personal = personalize(mail, contact.unsubscribe_token);
      let status: EmailStatus;
      let providerMessageId: string | null = null;
      let errorText: string | null = null;
      try {
        const result = await sendTrackedEmail({
          to: String(contact.email),
          subject: personal.subject,
          html: personal.html,
          text: personal.text,
          category: "marketing",
          template: "newsletter_campaign",
          unsubscribeUrl: unsubscribeUrlFor(contact.unsubscribe_token, campaignId),
          listUnsubscribeUrl: oneClickUnsubscribeUrlFor(contact.unsubscribe_token, campaignId),
          idempotencyKey: `campaign:${campaignId}:${contact.id}`,
          campaignId,
          customerId: contact.customer_id,
          tags: { campaign: campaignId },
        });
        status = result.status;
        providerMessageId = result.providerMessageId;
      } catch (e) {
        status = "failed";
        errorText = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      }
      await db
        .from("campaign_recipients")
        .update({
          status,
          provider_message_id: providerMessageId,
          sent_at: status === "sent" ? now : null,
          error: errorText,
        })
        .eq("campaign_id", campaignId)
        .eq("contact_id", r.contact_id);
    }
  }

  const { count: remaining } = await db
    .from("campaign_recipients")
    .select("contact_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  if ((remaining ?? 0) > 0) {
    await enqueueCrmJob({
      kind: "newsletter.send_batch",
      payload: { campaign_id: campaignId, batch: batch + 1 },
      idempotencyKey: `newsletter.send_batch:${campaignId}:${batch + 1}`,
      priority: 90,
    });
    return;
  }
  await db
    .from("newsletter_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "sending");
  await getCampaignStats(campaignId);
}
