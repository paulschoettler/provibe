import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { sanitizeSearch } from "@/lib/admin/emails/log";

/**
 * Posteingang neben den Leads: Nachrichten aus dem Kontaktformular (contact_messages) und
 * Widerrufe aus der elektronischen Widerrufsfunktion (withdrawal_requests). Lesen und Status
 * setzen mit viewCustomers; jede Änderung im Protokoll.
 */

const uuid = z.string().uuid("Ungültige ID");

export const CONTACT_STATUSES = ["new", "answered", "spam", "archived"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: "Offen",
  answered: "Erledigt",
  spam: "Spam",
  archived: "Archiviert",
};

export const WITHDRAWAL_STATUSES = ["received", "confirmed", "processed", "rejected"] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];
export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  received: "Eingegangen",
  confirmed: "Bestätigt",
  processed: "Bearbeitet",
  rejected: "Abgelehnt",
};

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
}

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(CONTACT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listContactMessages(
  filter: z.input<typeof listSchema> = {},
): Promise<{ items: ContactMessageItem[]; total: number; open: number }> {
  const f = parseInput(listSchema, filter);
  const db = crmDb();
  let query = db.from("contact_messages").select("*", { count: "exact" });
  if (f.status) query = query.eq("status", f.status);
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q) query = query.or(`name.ilike.*${q}*,email.ilike.*${q}*,message.ilike.*${q}*`);
  }
  const [{ data, error, count }, { count: open }] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1),
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if (error) throw dbError("Kontaktanfragen laden", error);
  return {
    items: (data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      subject: (m as { subject?: string | null }).subject ?? null,
      message: m.message,
      status: m.status as ContactStatus,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
    total: count ?? 0,
    open: open ?? 0,
  };
}

export async function getContactMessage(id: string): Promise<ContactMessageItem | null> {
  const { data, error } = await crmDb()
    .from("contact_messages")
    .select("*")
    .eq("id", parseInput(uuid, id))
    .maybeSingle();
  if (error) throw dbError("Kontaktanfrage laden", error);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    subject: (data as { subject?: string | null }).subject ?? null,
    message: data.message,
    status: data.status as ContactStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function setContactMessageStatus(
  input: { ids: string[]; status: ContactStatus },
  actor: StaffSession,
): Promise<number> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(
    z.object({
      ids: z.array(uuid).min(1, "Bitte wähle mindestens eine Nachricht.").max(200),
      status: z.enum(CONTACT_STATUSES),
    }),
    input,
  );
  const { data: rows, error } = await crmDb()
    .from("contact_messages")
    .update({ status: data.status, updated_at: new Date().toISOString() })
    .in("id", data.ids)
    .select("id");
  if (error) throw dbError("Status speichern", error);
  await writeAudit(actor, {
    action: "contact_message.status",
    entityType: "contact_message",
    entityId: data.ids.join(","),
    after: { status: data.status, count: rows?.length ?? 0 },
  });
  return rows?.length ?? 0;
}

export interface WithdrawalItem {
  id: string;
  orderNumber: string | null;
  orderId: string | null;
  customerName: string;
  email: string;
  address: string | null;
  itemsDescription: string;
  orderedOn: string | null;
  receivedOn: string | null;
  message: string | null;
  status: WithdrawalStatus;
  confirmationEmailSentAt: string | null;
  createdAt: string;
}

const withdrawalListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(WITHDRAWAL_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

function toWithdrawal(w: Record<string, unknown>): WithdrawalItem {
  return {
    id: String(w.id),
    orderNumber: (w.order_number as string | null) ?? null,
    orderId: (w.order_id as string | null) ?? null,
    customerName: String(w.customer_name),
    email: String(w.email),
    address: (w.address as string | null) ?? null,
    itemsDescription: String(w.items_description),
    orderedOn: (w.ordered_on as string | null) ?? null,
    receivedOn: (w.received_on as string | null) ?? null,
    message: (w.message as string | null) ?? null,
    status: w.status as WithdrawalStatus,
    confirmationEmailSentAt: (w.confirmation_email_sent_at as string | null) ?? null,
    createdAt: String(w.created_at),
  };
}

export async function listWithdrawals(
  filter: z.input<typeof withdrawalListSchema> = {},
): Promise<{ items: WithdrawalItem[]; total: number; open: number }> {
  const f = parseInput(withdrawalListSchema, filter);
  const db = crmDb();
  let query = db.from("withdrawal_requests").select("*", { count: "exact" });
  if (f.status) query = query.eq("status", f.status);
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q)
      query = query.or(`customer_name.ilike.*${q}*,email.ilike.*${q}*,order_number.ilike.*${q}*`);
  }
  const [{ data, error, count }, { count: open }] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1),
    db
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "confirmed"]),
  ]);
  if (error) throw dbError("Widerrufe laden", error);
  return {
    items: (data ?? []).map((w) => toWithdrawal(w as Record<string, unknown>)),
    total: count ?? 0,
    open: open ?? 0,
  };
}

export async function getWithdrawal(id: string): Promise<WithdrawalItem | null> {
  const { data, error } = await crmDb()
    .from("withdrawal_requests")
    .select("*")
    .eq("id", parseInput(uuid, id))
    .maybeSingle();
  if (error) throw dbError("Widerruf laden", error);
  return data ? toWithdrawal(data as Record<string, unknown>) : null;
}

export async function setWithdrawalStatus(
  input: { id: string; status: WithdrawalStatus },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(z.object({ id: uuid, status: z.enum(WITHDRAWAL_STATUSES) }), input);
  const before = await getWithdrawal(data.id);
  if (!before) throw new Error("Widerruf nicht gefunden");
  const { error } = await crmDb()
    .from("withdrawal_requests")
    .update({ status: data.status, updated_at: new Date().toISOString() })
    .eq("id", data.id);
  if (error) throw dbError("Status speichern", error);
  await writeAudit(actor, {
    action: "withdrawal.status",
    entityType: "withdrawal_request",
    entityId: data.id,
    before: { status: before.status },
    after: { status: data.status },
  });
}
