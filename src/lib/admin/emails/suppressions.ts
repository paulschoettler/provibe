import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { normalizeEmail } from "./policy";
import { sanitizeSearch } from "./log";

/**
 * Sperrliste (email_suppressions): Einträge aus Bounces, Beschwerden, Abmeldungen und von Hand.
 * Einsehen mit viewCustomers, Entfernen nur Owner und Admin (sendNewsletter) mit Grund.
 */

export const SUPPRESSION_REASON_LABELS: Record<string, string> = {
  bounce: "Unzustellbar (Bounce)",
  complaint: "Beschwerde",
  manual: "Von Hand",
  unsubscribe: "Abmeldung",
};

export interface SuppressionEntry {
  email: string;
  reason: string;
  reasonLabel: string;
  source: string | null;
  createdAt: string;
}

export async function listSuppressions(
  filter: { q?: string; reason?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: SuppressionEntry[]; total: number }> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? 50, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  let query = crmDb().from("email_suppressions").select("*", { count: "exact" });
  if (filter.reason && filter.reason in SUPPRESSION_REASON_LABELS)
    query = query.eq("reason", filter.reason);
  if (filter.q) {
    const q = sanitizeSearch(filter.q);
    if (q) query = query.ilike("email", `*${q}*`);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw dbError("Sperrliste laden", error);
  return {
    items: (data ?? []).map((s) => ({
      email: String(s.email),
      reason: s.reason,
      reasonLabel: SUPPRESSION_REASON_LABELS[s.reason] ?? s.reason,
      source: s.source,
      createdAt: s.created_at,
    })),
    total: count ?? 0,
  };
}

/**
 * Eintrag entfernen, zum Beispiel nach behobenem Postfachproblem. Der Grund landet im Protokoll.
 * Der Newsletter-Status des Kontakts bleibt unverändert (eine neue Einwilligung braucht Double Opt-in).
 */
export async function removeSuppression(
  input: { email: string; reason: string },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "sendNewsletter");
  const data = parseInput(
    z.object({
      email: z.string().trim().min(3).max(254),
      reason: z.string().trim().min(3, "Bitte gib einen Grund an.").max(300),
    }),
    input,
  );
  const email = normalizeEmail(data.email);
  const db = crmDb();
  const { data: before } = await db
    .from("email_suppressions")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (!before) throw new Error("Eintrag nicht gefunden");
  const { error } = await db.from("email_suppressions").delete().eq("email", email);
  if (error) throw dbError("Sperre entfernen", error);
  await writeAudit(actor, {
    action: "email_suppression.delete",
    entityType: "email_suppression",
    entityId: email,
    before: { reason: before.reason, source: before.source, created_at: before.created_at },
    after: { removed_reason: data.reason },
  });
}
