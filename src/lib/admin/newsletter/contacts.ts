import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { sanitizeSearch } from "@/lib/admin/emails/log";
import { integrations } from "@/lib/integrations";
import {
  NEWSLETTER_SOURCE_LABEL,
  NEWSLETTER_STATUS_LABEL,
  optInProof,
  type OptInProof,
} from "@/lib/admin/customers/profile";
import {
  mergeImportRow,
  prepareNewsletterImport,
  type ImportPreparation,
  type MergeDecision,
} from "./csv";

/**
 * Newsletter-Kontakte: Liste, Kennzahlen, CSV-Import (Vorbereitung und Übernahme), Abmelden aus dem
 * Backoffice, Abgleich mit der Resend-Audience. Versandfähig ist nur subscribed mit confirmed_at.
 */

const uuid = z.string().uuid("Ungültige ID");
const STATUSES = ["pending", "subscribed", "unsubscribed", "bounced", "complained"] as const;

export const contactFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  source: z.string().trim().max(30).optional(),
  sendable: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export interface NewsletterContactItem {
  id: string;
  email: string;
  firstName: string | null;
  status: (typeof STATUSES)[number];
  statusLabel: string;
  source: string;
  sourceLabel: string;
  customerId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  sendable: boolean;
  proof: OptInProof;
}

export async function listNewsletterContacts(
  filter: z.input<typeof contactFilterSchema> = {},
): Promise<{ items: NewsletterContactItem[]; total: number }> {
  const f = parseInput(contactFilterSchema, filter);
  let query = crmDb().from("newsletter_contacts").select("*", { count: "exact" });
  if (f.status) query = query.eq("status", f.status);
  if (f.source) query = query.eq("source", f.source);
  if (f.sendable === true) query = query.eq("status", "subscribed").not("confirmed_at", "is", null);
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q) query = query.or(`email.ilike.*${q}*,first_name.ilike.*${q}*`);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1);
  if (error) throw dbError("Kontakte laden", error);
  return {
    items: (data ?? []).map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      status: c.status,
      statusLabel: NEWSLETTER_STATUS_LABEL[c.status],
      source: c.source,
      sourceLabel: NEWSLETTER_SOURCE_LABEL[c.source] ?? c.source,
      customerId: c.customer_id,
      confirmedAt: c.confirmed_at,
      createdAt: c.created_at,
      sendable: c.status === "subscribed" && Boolean(c.confirmed_at),
      proof: optInProof(c),
    })),
    total: count ?? 0,
  };
}

export async function getContactStats(): Promise<
  Record<(typeof STATUSES)[number] | "sendable" | "suppressed", number>
> {
  const db = crmDb();
  const entries = await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await db
        .from("newsletter_contacts")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );
  const { count: sendable } = await db
    .from("newsletter_contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "subscribed")
    .not("confirmed_at", "is", null);
  const { count: suppressed } = await db
    .from("email_suppressions")
    .select("email", { count: "exact", head: true });
  return {
    ...(Object.fromEntries(entries) as Record<(typeof STATUSES)[number], number>),
    sendable: sendable ?? 0,
    suppressed: suppressed ?? 0,
  };
}

export interface ImportPlan extends ImportPreparation {
  decisions: { email: string; line: number; action: MergeDecision["action"]; reason?: string }[];
  plan: { insert: number; update: number; skip: number };
}

async function existingByEmail(emails: string[]) {
  const map = new Map<string, { status: (typeof STATUSES)[number]; confirmed_at: string | null }>();
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const { data, error } = await crmDb()
      .from("newsletter_contacts")
      .select("email, status, confirmed_at")
      .in("email", chunk);
    if (error) throw dbError("Kontakte prüfen", error);
    for (const c of data ?? [])
      map.set(String(c.email).toLowerCase(), { status: c.status, confirmed_at: c.confirmed_at });
  }
  return map;
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** CSV prüfen und zeigen, was passieren würde (keine Schreibzugriffe). */
export async function prepareImport(csvText: string): Promise<ImportPlan> {
  if (csvText.length > MAX_IMPORT_BYTES) throw new Error("Die Datei ist größer als 5 MB");
  const prep = prepareNewsletterImport(csvText);
  const existing = await existingByEmail(prep.rows.map((r) => r.email));
  const now = new Date().toISOString();
  const decisions = prep.rows.map((r) => {
    const d = mergeImportRow(existing.get(r.email) ?? null, r, now);
    return {
      email: r.email,
      line: r.line,
      action: d.action,
      reason: d.action === "skip" ? d.reason : undefined,
    };
  });
  return {
    ...prep,
    decisions,
    plan: {
      insert: decisions.filter((d) => d.action === "insert").length,
      update: decisions.filter((d) => d.action === "update").length,
      skip: decisions.filter((d) => d.action === "skip").length,
    },
  };
}

/**
 * Import übernehmen. Kontakte werden mit vorhandenen Kunden (gleiche E-Mail) verknüpft.
 * Keine Mail wird verschickt, auch keine Willkommensmail (Sweep überspringt import_shopify).
 */
export async function applyImport(
  csvText: string,
  actor: StaffSession,
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  assertPermission(actor, "sendNewsletter");
  if (csvText.length > MAX_IMPORT_BYTES) throw new Error("Die Datei ist größer als 5 MB");
  const prep = prepareNewsletterImport(csvText);
  if (prep.errors.length > 0 && prep.rows.length === 0) throw new Error(prep.errors[0].message);
  const db = crmDb();
  const existing = await existingByEmail(prep.rows.map((r) => r.email));
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const inserts: Record<string, unknown>[] = [];
  const updates: { email: string; values: Record<string, unknown> }[] = [];
  for (const row of prep.rows) {
    const d = mergeImportRow(existing.get(row.email) ?? null, row, now);
    if (d.action === "skip") skipped++;
    else if (d.action === "insert") inserts.push({ ...d.values });
    else updates.push({ email: row.email, values: { ...d.values } });
  }
  // Kunden mit gleicher E-Mail verknüpfen
  const allEmails = [...inserts.map((i) => String(i.email)), ...updates.map((u) => u.email)];
  const customerByEmail = new Map<string, string>();
  for (let i = 0; i < allEmails.length; i += 200) {
    const { data } = await db
      .from("customers")
      .select("id, email")
      .in("email", allEmails.slice(i, i + 200));
    for (const c of data ?? []) customerByEmail.set(String(c.email).toLowerCase(), c.id);
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200).map((v) => ({
      email: String(v.email),
      first_name: (v.first_name as string | null) ?? null,
      status: v.status as "subscribed" | "pending" | "unsubscribed",
      source: "import_shopify",
      confirmed_at: (v.confirmed_at as string | null) ?? null,
      imported_consent_at: (v.imported_consent_at as string | null) ?? null,
      unsubscribed_at: (v.unsubscribed_at as string | null) ?? null,
      customer_id: customerByEmail.get(String(v.email)) ?? null,
    }));
    const { error, data } = await db
      .from("newsletter_contacts")
      .upsert(chunk, { onConflict: "email", ignoreDuplicates: true })
      .select("id");
    if (error) throw dbError("Import speichern", error);
    inserted += data?.length ?? 0;
  }
  for (const u of updates) {
    const { error } = await db
      .from("newsletter_contacts")
      .update({
        status: u.values.status as "subscribed",
        confirmed_at: u.values.confirmed_at as string | null,
        imported_consent_at: u.values.imported_consent_at as string | null,
        first_name: (u.values.first_name as string | null) ?? undefined,
        customer_id: customerByEmail.get(u.email) ?? undefined,
      })
      .eq("email", u.email)
      .eq("status", "pending");
    if (error) throw dbError("Import aktualisieren", error);
    updated++;
  }
  await writeAudit(actor, {
    action: "newsletter.import",
    entityType: "newsletter_contact",
    after: { inserted, updated, skipped, errors: prep.errors.length, duplicates: prep.duplicates },
  });
  return { inserted, updated, skipped, errors: prep.errors.length };
}

/** Kontakt im Backoffice abmelden (zum Beispiel auf Wunsch per E-Mail). */
export async function adminUnsubscribeContact(
  input: { contactId: string; reason?: string },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(
    z.object({ contactId: uuid, reason: z.string().trim().max(300).optional() }),
    input,
  );
  const db = crmDb();
  const { data: contact } = await db
    .from("newsletter_contacts")
    .select("id, email, status, customer_id")
    .eq("id", data.contactId)
    .maybeSingle();
  if (!contact) throw new Error("Kontakt nicht gefunden");
  if (contact.status === "unsubscribed") return;
  const now = new Date().toISOString();
  const { error } = await db
    .from("newsletter_contacts")
    .update({
      status: "unsubscribed",
      unsubscribed_at: now,
      unsubscribe_reason: data.reason || "backoffice",
      confirm_token_hash: null,
    })
    .eq("id", contact.id);
  if (error) throw dbError("Abmelden", error);
  if (contact.customer_id) {
    await db.from("customer_events").insert({
      customer_id: contact.customer_id,
      kind: "newsletter_admin_unsubscribe",
      data: asJson({ by: actor.email, reason: data.reason ?? null }),
    });
  }
  try {
    await integrations().email.upsertContact({ email: String(contact.email), unsubscribed: true });
  } catch (e) {
    console.error("[newsletter] Resend-Kontakt nicht aktualisiert", e);
  }
  await writeAudit(actor, {
    action: "newsletter.unsubscribe",
    entityType: "newsletter_contact",
    entityId: contact.id,
    before: { status: contact.status },
    after: { status: "unsubscribed", reason: data.reason ?? "backoffice" },
  });
}

/**
 * Versandfähige Kontakte ohne resend_contact_id in die Resend-Audience übernehmen (keine Mail).
 * Liefert die Zahl der übernommenen Kontakte; höchstens limit je Aufruf.
 */
export async function syncContactsToResend(actor: StaffSession, limit = 200): Promise<number> {
  assertPermission(actor, "sendNewsletter");
  const db = crmDb();
  const { data, error } = await db
    .from("newsletter_contacts")
    .select("id, email, first_name")
    .eq("status", "subscribed")
    .not("confirmed_at", "is", null)
    .is("resend_contact_id", null)
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw dbError("Kontakte laden", error);
  let synced = 0;
  for (const c of data ?? []) {
    try {
      const res = await integrations().email.upsertContact({
        email: String(c.email),
        firstName: c.first_name ?? undefined,
        unsubscribed: false,
      });
      if (res.id) {
        await db.from("newsletter_contacts").update({ resend_contact_id: res.id }).eq("id", c.id);
        synced++;
      }
    } catch (e) {
      console.error("[newsletter] Resend-Abgleich fehlgeschlagen", e);
    }
  }
  await writeAudit(actor, {
    action: "newsletter.sync_resend",
    entityType: "newsletter_contact",
    after: { synced },
  });
  return synced;
}
