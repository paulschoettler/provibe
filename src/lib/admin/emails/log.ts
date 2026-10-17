import "server-only";
import { z } from "zod";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { parseInput } from "@/lib/admin/customers/guard";
import type { Database } from "@/lib/supabase/database.types";

/** Versandprotokoll aus email_messages mit Filtern (/admin/emails, Tab Protokoll). */

type Row = Database["public"]["Tables"]["email_messages"]["Row"];

export const EMAIL_STATUS_LABELS: Record<Row["status"], string> = {
  queued: "In Warteschlange",
  sent: "Gesendet",
  delivered: "Zugestellt",
  bounced: "Unzustellbar",
  complained: "Beschwerde",
  failed: "Fehlgeschlagen",
  suppressed: "Gesperrt (Sperrliste)",
  blocked_allowlist: "Blockiert (Allowlist)",
};

export const emailLogFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum([
      "queued",
      "sent",
      "delivered",
      "bounced",
      "complained",
      "failed",
      "suppressed",
      "blocked_allowlist",
    ])
    .optional(),
  category: z.enum(["transactional", "marketing", "auth", "internal"]).optional(),
  template: z.string().trim().max(80).optional(),
  campaignId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type EmailLogFilter = z.input<typeof emailLogFilterSchema>;

export interface EmailLogEntry {
  id: string;
  toEmail: string;
  subject: string;
  template: string;
  category: Row["category"];
  status: Row["status"];
  statusLabel: string;
  provider: string;
  error: string | null;
  orderId: string | null;
  customerId: string | null;
  campaignId: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

function toEntry(r: Row): EmailLogEntry {
  return {
    id: r.id,
    toEmail: r.to_email,
    subject: r.subject,
    template: r.template,
    category: r.category,
    status: r.status,
    statusLabel: EMAIL_STATUS_LABELS[r.status],
    provider: r.provider,
    error: r.error,
    orderId: r.order_id,
    customerId: r.customer_id,
    campaignId: r.campaign_id,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    deliveredAt: r.delivered_at,
    openedAt: r.opened_at,
    clickedAt: r.clicked_at,
  };
}

/** Suchbegriff für PostgREST-Filter entschärfen (Komma, Klammern, Wildcards). */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

export async function listEmailMessages(
  filter: EmailLogFilter = {},
): Promise<{ items: EmailLogEntry[]; total: number; page: number; pageSize: number }> {
  const f = parseInput(emailLogFilterSchema, filter);
  let query = crmDb().from("email_messages").select("*", { count: "exact" });
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q) query = query.or(`to_email.ilike.*${q}*,subject.ilike.*${q}*`);
  }
  if (f.status) query = query.eq("status", f.status);
  if (f.category) query = query.eq("category", f.category);
  if (f.template) query = query.eq("template", f.template);
  if (f.campaignId) query = query.eq("campaign_id", f.campaignId);
  if (f.customerId) query = query.eq("customer_id", f.customerId);
  if (f.orderId) query = query.eq("order_id", f.orderId);
  if (f.from) query = query.gte("created_at", f.from);
  if (f.to) query = query.lt("created_at", f.to);
  const offset = (f.page - 1) * f.pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + f.pageSize - 1);
  if (error) throw dbError("Versandprotokoll laden", error);
  return {
    items: (data ?? []).map(toEntry),
    total: count ?? 0,
    page: f.page,
    pageSize: f.pageSize,
  };
}

export async function getEmailMessage(
  id: string,
): Promise<
  (EmailLogEntry & { metadata: unknown; fromEmail: string; replyTo: string | null }) | null
> {
  const { data, error } = await crmDb()
    .from("email_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError("E-Mail laden", error);
  if (!data) return null;
  return {
    ...toEntry(data),
    metadata: data.metadata,
    fromEmail: data.from_email,
    replyTo: data.reply_to,
  };
}
