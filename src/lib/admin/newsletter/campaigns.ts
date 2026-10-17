import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { campaignBlocksSchema, type CampaignBlock, type RenderedMail } from "@/emails/campaign";
import { serverEnv } from "@/lib/env/server";
import { oneClickUnsubscribeUrlFor, unsubscribeUrlFor } from "@/lib/admin/emails/context";
import { canSendTo, normalizeEmail } from "@/lib/admin/emails/policy";
import { sendTrackedEmail, type EmailStatus } from "@/lib/admin/emails/send";
import { cancelQueuedJobs, enqueueCrmJob } from "@/lib/admin/automations/queue";
import { parseStoredRules } from "@/lib/admin/segments/rules";
import { segmentNewsletterAudience } from "@/lib/admin/segments/segments";
import type { Database } from "@/lib/supabase/database.types";
import { renderCampaignHtml } from "./render";
import {
  aggregateRecipientStats,
  type CampaignStats,
  type RecipientStatRow,
} from "./resend-events";

/**
 * Kampagnen: Entwurf mit Blockinhalt, Vorschau, Testversand an die Allowlist, Planung, Versand
 * (über newsletter.dispatch und newsletter.send_batch, siehe sending.ts), Kennzahlen.
 * Bearbeiten und Versenden: sendNewsletter (Owner, Admin). Lesen: viewCustomers.
 */

export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  sending: "Wird versendet",
  sent: "Versendet",
  cancelled: "Abgebrochen",
  failed: "Fehlgeschlagen",
};

const uuid = z.string().uuid("Ungültige ID");

const campaignInputSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(120),
  subject: z.string().trim().min(2, "Bitte gib einen Betreff ein.").max(150),
  preheader: z.string().trim().max(200).optional().nullable(),
  fromEmail: z.string().trim().max(200).optional().nullable(),
  replyTo: z
    .string()
    .trim()
    .toLowerCase()
    .email("Bitte gib eine gültige Antwortadresse ein.")
    .optional()
    .nullable(),
  segmentId: uuid.optional().nullable(),
  blocks: campaignBlocksSchema.default([]),
});

export type CampaignInput = z.input<typeof campaignInputSchema>;

export interface CampaignListItem {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  statusLabel: string;
  segmentId: string | null;
  segmentName: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientsCount: number;
  stats: Partial<CampaignStats>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignListItem {
  preheader: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  blocks: CampaignBlock[];
  testSentAt: string | null;
  editable: boolean;
}

type CampaignRow = Database["public"]["Tables"]["newsletter_campaigns"]["Row"] & {
  reply_to?: string | null;
  test_sent_at?: string | null;
};

function statsOf(v: unknown): Partial<CampaignStats> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<CampaignStats>) : {};
}

function toListItem(c: CampaignRow, segmentNames: Map<string, string>): CampaignListItem {
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    statusLabel: CAMPAIGN_STATUS_LABELS[c.status],
    segmentId: c.segment_id,
    segmentName: c.segment_id ? (segmentNames.get(c.segment_id) ?? null) : null,
    scheduledAt: c.scheduled_at,
    sentAt: c.sent_at,
    recipientsCount: c.recipients_count,
    stats: statsOf(c.stats),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

async function segmentNames(): Promise<Map<string, string>> {
  const { data } = await crmDb().from("saved_segments").select("id, name");
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}

export async function listCampaigns(
  filter: { status?: CampaignStatus } = {},
): Promise<CampaignListItem[]> {
  let query = crmDb()
    .from("newsletter_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw dbError("Kampagnen laden", error);
  const names = await segmentNames();
  return (data ?? []).map((c) => toListItem(c, names));
}

async function loadCampaign(id: string): Promise<CampaignRow> {
  const { data, error } = await crmDb()
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError("Kampagne laden", error);
  if (!data) throw new Error("Kampagne nicht gefunden");
  return data;
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  const campaignId = parseInput(uuid, id);
  const { data, error } = await crmDb()
    .from("newsletter_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw dbError("Kampagne laden", error);
  if (!data) return null;
  const parsedBlocks = campaignBlocksSchema.safeParse(data.content);
  return {
    ...toListItem(data, await segmentNames()),
    preheader: data.preheader,
    fromEmail: data.from_email,
    replyTo: data.reply_to ?? null,
    blocks: parsedBlocks.success ? parsedBlocks.data : [],
    testSentAt: data.test_sent_at ?? null,
    editable: data.status === "draft",
  };
}

function rowFromInput(input: z.infer<typeof campaignInputSchema>) {
  const env = serverEnv();
  return {
    name: input.name,
    subject: input.subject,
    preheader: input.preheader || null,
    // Absender ist fest die Newsletter-Adresse (Domain mit DKIM bei Resend)
    from_email: env.EMAIL_FROM_NEWSLETTER,
    reply_to: input.replyTo || env.EMAIL_REPLY_TO,
    segment_id: input.segmentId ?? null,
    content: asJson(input.blocks),
    html_cache: null,
  };
}

export async function createCampaign(
  input: CampaignInput,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(campaignInputSchema, input);
  const { data: row, error } = await crmDb()
    .from("newsletter_campaigns")
    .insert({ ...rowFromInput(data), created_by: actor.userId })
    .select("id")
    .single();
  if (error) throw dbError("Kampagne anlegen", error);
  await writeAudit(actor, {
    action: "campaign.create",
    entityType: "newsletter_campaign",
    entityId: row.id,
    after: { name: data.name, subject: data.subject, segment_id: data.segmentId ?? null },
  });
  return { id: row.id };
}

export async function updateCampaign(
  id: string,
  input: CampaignInput,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const campaignId = parseInput(uuid, id);
  const data = parseInput(campaignInputSchema, input);
  const before = await loadCampaign(campaignId);
  if (before.status !== "draft")
    throw new Error(
      before.status === "scheduled"
        ? "Die Kampagne ist geplant. Hebe die Planung auf, um sie zu bearbeiten."
        : "Versendete Kampagnen lassen sich nicht mehr bearbeiten.",
    );
  const { error } = await crmDb()
    .from("newsletter_campaigns")
    .update(rowFromInput(data))
    .eq("id", campaignId);
  if (error) throw dbError("Kampagne speichern", error);
  await writeAudit(actor, {
    action: "campaign.update",
    entityType: "newsletter_campaign",
    entityId: campaignId,
    before: { name: before.name, subject: before.subject, segment_id: before.segment_id },
    after: {
      name: data.name,
      subject: data.subject,
      segment_id: data.segmentId ?? null,
      blocks: data.blocks.length,
    },
  });
}

export async function duplicateCampaign(id: string, actor: StaffSession): Promise<{ id: string }> {
  assertPermission(actor, "sendNewsletter");
  const source = await loadCampaign(parseInput(uuid, id));
  const { data: row, error } = await crmDb()
    .from("newsletter_campaigns")
    .insert({
      name: `${source.name} (Kopie)`.slice(0, 120),
      subject: source.subject,
      preheader: source.preheader,
      from_email: source.from_email,
      reply_to: source.reply_to ?? null,
      segment_id: source.segment_id,
      content: source.content,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error) throw dbError("Kampagne kopieren", error);
  await writeAudit(actor, {
    action: "campaign.duplicate",
    entityType: "newsletter_campaign",
    entityId: row.id,
    after: { source_id: source.id },
  });
  return { id: row.id };
}

/** Nur Entwürfe und abgebrochene Kampagnen ohne Empfänger lassen sich löschen. */
export async function deleteCampaign(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const campaign = await loadCampaign(parseInput(uuid, id));
  if (campaign.status !== "draft" && campaign.status !== "cancelled")
    throw new Error("Nur Entwürfe lassen sich löschen");
  const { count } = await crmDb()
    .from("campaign_recipients")
    .select("contact_id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id);
  if ((count ?? 0) > 0)
    throw new Error("Die Kampagne hat bereits Empfänger und bleibt als Nachweis erhalten");
  const { error } = await crmDb().from("newsletter_campaigns").delete().eq("id", campaign.id);
  if (error) throw dbError("Kampagne löschen", error);
  await writeAudit(actor, {
    action: "campaign.delete",
    entityType: "newsletter_campaign",
    entityId: campaign.id,
    before: { name: campaign.name, subject: campaign.subject },
  });
}

/** Vorschau (Desktop/Mobil im Editor) mit aktuellen Katalogpreisen. */
export async function previewCampaign(id: string): Promise<RenderedMail> {
  const c = await loadCampaign(parseInput(uuid, id));
  return renderCampaignHtml(
    { id: c.id, subject: c.subject, preheader: c.preheader, content: c.content },
    { preview: true },
  );
}

/**
 * Testversand. Immer nur an Adressen der Allowlist, auch nach dem Go-live (Test bleibt Test).
 * Ist die Testadresse ein Newsletter-Kontakt, funktioniert ihr Abmeldelink.
 */
export async function sendTestCampaign(
  input: { campaignId: string; to: string },
  actor: StaffSession,
): Promise<{ status: EmailStatus }> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(
    z.object({
      campaignId: uuid,
      to: z.string().trim().toLowerCase().email("Bitte gib eine gültige Testadresse ein."),
    }),
    input,
  );
  const env = serverEnv();
  if (!canSendTo(data.to, env, true))
    throw new Error(
      "Testversand nur an Adressen der Allowlist (@provibe-drinks.de, mail@paulschoettler.de)",
    );
  const campaign = await loadCampaign(data.campaignId);
  const { data: contact } = await crmDb()
    .from("newsletter_contacts")
    .select("unsubscribe_token")
    .eq("email", normalizeEmail(data.to))
    .maybeSingle();
  const token = contact?.unsubscribe_token ?? "testversand-ohne-kontakt";
  const mail = await renderCampaignHtml(
    {
      id: campaign.id,
      subject: campaign.subject,
      preheader: campaign.preheader,
      content: campaign.content,
    },
    { unsubscribeToken: token, testBanner: "TESTVERSAND" },
  );
  const result = await sendTrackedEmail({
    to: data.to,
    subject: `[TEST] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
    category: "marketing",
    template: "newsletter_campaign",
    unsubscribeUrl: unsubscribeUrlFor(token, campaign.id),
    listUnsubscribeUrl: oneClickUnsubscribeUrlFor(token, campaign.id),
    campaignId: campaign.id,
    metadata: { test: true, by: actor.email },
  });
  await crmDb()
    .from("newsletter_campaigns")
    .update({ test_sent_at: new Date().toISOString() })
    .eq("id", campaign.id);
  await writeAudit(actor, {
    action: "campaign.test_send",
    entityType: "newsletter_campaign",
    entityId: campaign.id,
    after: { to: data.to, status: result.status },
  });
  return { status: result.status };
}

/** Zielgruppe vor dem Versand: versandfähige Kontakte und übersprungene Mitglieder ohne Opt-in. */
export async function getCampaignAudience(segmentId: string | null) {
  return segmentNewsletterAudience(segmentId ? parseInput(uuid, segmentId) : null);
}

async function assertSendable(campaign: CampaignRow): Promise<unknown> {
  const blocks = campaignBlocksSchema.safeParse(campaign.content);
  if (!blocks.success || blocks.data.length === 0)
    throw new Error("Die Kampagne hat noch keinen Inhalt");
  if (!campaign.segment_id) return null;
  const { data } = await crmDb()
    .from("saved_segments")
    .select("definition")
    .eq("id", campaign.segment_id)
    .maybeSingle();
  const rules = data ? parseStoredRules(data.definition) : null;
  if (!rules) throw new Error("Das Segment der Kampagne existiert nicht mehr oder ist ungültig");
  return rules;
}

const scheduleSchema = z.object({
  campaignId: uuid,
  scheduledAt: z.string().datetime({ offset: true, message: "Bitte wähle Datum und Uhrzeit." }),
});

/**
 * Versand planen. Das Segment wird als Schnappschuss gespeichert (segment_snapshot), damit spätere
 * Änderungen am Segment die geplante Zielgruppe nicht unbemerkt ändern. Ausgewertet wird es zum
 * Versandzeitpunkt (Opt-in-Status von dann).
 */
export async function scheduleCampaign(
  input: { campaignId: string; scheduledAt: string },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(scheduleSchema, input);
  const when = new Date(data.scheduledAt);
  if (when.getTime() < Date.now() - 60_000)
    throw new Error("Der Zeitpunkt liegt in der Vergangenheit");
  const campaign = await loadCampaign(data.campaignId);
  if (campaign.status !== "draft") throw new Error("Nur Entwürfe lassen sich planen");
  const rules = await assertSendable(campaign);
  const scheduledAt = when.toISOString();
  const { error } = await crmDb()
    .from("newsletter_campaigns")
    .update({ status: "scheduled", scheduled_at: scheduledAt, segment_snapshot: asJson(rules) })
    .eq("id", campaign.id)
    .eq("status", "draft");
  if (error) throw dbError("Kampagne planen", error);
  await enqueueCrmJob({
    kind: "newsletter.dispatch",
    payload: { campaign_id: campaign.id },
    idempotencyKey: `newsletter.dispatch:${campaign.id}:${scheduledAt}`,
    runAt: scheduledAt,
    priority: 90,
  });
  await writeAudit(actor, {
    action: "campaign.schedule",
    entityType: "newsletter_campaign",
    entityId: campaign.id,
    after: { scheduled_at: scheduledAt, segment_id: campaign.segment_id },
  });
}

/** Sofort senden: plant auf jetzt. */
export async function sendCampaign(campaignId: string, actor: StaffSession): Promise<void> {
  return scheduleCampaign({ campaignId, scheduledAt: new Date().toISOString() }, actor);
}

export async function unscheduleCampaign(campaignId: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const campaign = await loadCampaign(parseInput(uuid, campaignId));
  if (campaign.status !== "scheduled") throw new Error("Die Kampagne ist nicht geplant");
  const { error } = await crmDb()
    .from("newsletter_campaigns")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", campaign.id)
    .eq("status", "scheduled");
  if (error) throw dbError("Planung aufheben", error);
  await cancelQueuedJobs("newsletter.dispatch", { campaign_id: campaign.id });
  await writeAudit(actor, {
    action: "campaign.unschedule",
    entityType: "newsletter_campaign",
    entityId: campaign.id,
    before: { scheduled_at: campaign.scheduled_at },
  });
}

/** Laufenden Versand abbrechen: offene Empfänger bleiben unversendet. */
export async function cancelCampaign(campaignId: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const campaign = await loadCampaign(parseInput(uuid, campaignId));
  if (campaign.status !== "sending" && campaign.status !== "scheduled")
    throw new Error("Nur geplante oder laufende Kampagnen lassen sich abbrechen");
  const { error } = await crmDb()
    .from("newsletter_campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaign.id);
  if (error) throw dbError("Kampagne abbrechen", error);
  await cancelQueuedJobs("newsletter.dispatch", { campaign_id: campaign.id });
  await cancelQueuedJobs("newsletter.send_batch", { campaign_id: campaign.id });
  await writeAudit(actor, {
    action: "campaign.cancel",
    entityType: "newsletter_campaign",
    entityId: campaign.id,
    before: { status: campaign.status },
  });
}

/** Kennzahlen frisch aus campaign_recipients (Resend-Webhooks) und im Kampagnendatensatz ablegen. */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const id = parseInput(uuid, campaignId);
  const db = crmDb();
  const rows: RecipientStatRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("campaign_recipients")
      .select(
        "contact_id, status, delivered_at, opened_at, clicked_at, bounced_at, complained_at, unsubscribed_at",
      )
      .eq("campaign_id", id)
      .order("contact_id")
      .range(from, from + pageSize - 1);
    if (error) throw dbError("Kennzahlen laden", error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  const stats = aggregateRecipientStats(rows);
  await db
    .from("newsletter_campaigns")
    .update({ stats: asJson({ ...stats, updated_at: new Date().toISOString() }) })
    .eq("id", id);
  return stats;
}

export interface CampaignRecipientRow {
  contactId: string;
  email: string;
  status: EmailStatus;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  error: string | null;
}

export async function listCampaignRecipients(
  campaignId: string,
  options: { status?: EmailStatus; page?: number; pageSize?: number } = {},
): Promise<{ items: CampaignRecipientRow[]; total: number }> {
  const id = parseInput(uuid, campaignId);
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 200);
  const page = Math.max(options.page ?? 1, 1);
  let query = crmDb()
    .from("campaign_recipients")
    .select("*", { count: "exact" })
    .eq("campaign_id", id);
  if (options.status) query = query.eq("status", options.status);
  const { data, error, count } = await query
    .order("email")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw dbError("Empfänger laden", error);
  return {
    items: (data ?? []).map((r) => ({
      contactId: r.contact_id,
      email: r.email,
      status: r.status,
      sentAt: r.sent_at,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
      bouncedAt: r.bounced_at,
      unsubscribedAt: r.unsubscribed_at,
      error: r.error,
    })),
    total: count ?? 0,
  };
}
