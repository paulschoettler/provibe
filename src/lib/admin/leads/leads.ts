import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { sanitizeSearch } from "@/lib/admin/emails/log";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  canChangeLeadStatus,
  statusAfterConversion,
  type LeadStatus,
} from "./status";

/**
 * Partner- und B2B-Anfragen (leads, lead_notes) aus dem Partnerformular.
 * Lesen und Schreiben mit viewCustomers (Support darf Leads laut RLS bearbeiten),
 * Umwandlung in einen B2B-Kunden nur Owner und Admin.
 */

const uuid = z.string().uuid("Ungültige ID");

export const leadFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  open: z.boolean().optional(),
  assignedTo: z.union([z.string().uuid(), z.literal("none")]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type LeadFilter = z.input<typeof leadFilterSchema>;

export interface LeadListItem {
  id: string;
  kind: string;
  company: string | null;
  contactName: string;
  email: string;
  phone: string | null;
  locationType: string | null;
  status: LeadStatus;
  statusLabel: string;
  assignedTo: string | null;
  assignedName: string | null;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function staffMap(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (!unique.length) return new Map();
  const { data } = await crmDb()
    .from("staff_users")
    .select("user_id, display_name, email")
    .in("user_id", unique);
  return new Map((data ?? []).map((s) => [s.user_id, s.display_name ?? s.email]));
}

export async function listLeads(
  filter: LeadFilter = {},
): Promise<{ items: LeadListItem[]; total: number; counts: Record<LeadStatus, number> }> {
  const f = parseInput(leadFilterSchema, filter);
  const db = crmDb();
  let query = db.from("leads").select("*", { count: "exact" });
  if (f.status) query = query.eq("status", f.status);
  else if (f.open) query = query.in("status", ["new", "contacted", "qualified"]);
  if (f.assignedTo === "none") query = query.is("assigned_to", null);
  else if (f.assignedTo) query = query.eq("assigned_to", f.assignedTo);
  if (f.q) {
    const q = sanitizeSearch(f.q);
    if (q) query = query.or(`company.ilike.*${q}*,contact_name.ilike.*${q}*,email.ilike.*${q}*`);
  }
  const offset = (f.page - 1) * f.pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + f.pageSize - 1);
  if (error) throw dbError("Leads laden", error);

  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  await Promise.all(
    LEAD_STATUSES.map(async (s) => {
      const { count: n } = await db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      counts[s] = n ?? 0;
    }),
  );
  const names = await staffMap((data ?? []).map((l) => l.assigned_to));
  return {
    items: (data ?? []).map((l) => ({
      id: l.id,
      kind: l.kind,
      company: l.company,
      contactName: l.contact_name,
      email: l.email,
      phone: l.phone,
      locationType: l.location_type,
      status: l.status,
      statusLabel: LEAD_STATUS_LABELS[l.status],
      assignedTo: l.assigned_to,
      assignedName: l.assigned_to ? (names.get(l.assigned_to) ?? null) : null,
      customerId: l.customer_id,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })),
    total: count ?? 0,
    counts,
  };
}

export interface LeadDetail extends LeadListItem {
  message: string | null;
  sourceUrl: string | null;
  attribution: unknown;
  notes: {
    id: string;
    body: string;
    authorUserId: string | null;
    authorName: string | null;
    createdAt: string;
  }[];
  customer: { id: string; email: string; customerType: string; b2bStatus: string } | null;
}

export async function getLead(id: string): Promise<LeadDetail | null> {
  const leadId = parseInput(uuid, id);
  const db = crmDb();
  const { data: l, error } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error) throw dbError("Lead laden", error);
  if (!l) return null;
  const [{ data: notes }, customer] = await Promise.all([
    db.from("lead_notes").select("*").eq("lead_id", l.id).order("created_at", { ascending: false }),
    l.customer_id
      ? db
          .from("customers")
          .select("id, email, customer_type, b2b_status")
          .eq("id", l.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const names = await staffMap([l.assigned_to, ...(notes ?? []).map((n) => n.author_user_id)]);
  return {
    id: l.id,
    kind: l.kind,
    company: l.company,
    contactName: l.contact_name,
    email: l.email,
    phone: l.phone,
    locationType: l.location_type,
    status: l.status,
    statusLabel: LEAD_STATUS_LABELS[l.status],
    assignedTo: l.assigned_to,
    assignedName: l.assigned_to ? (names.get(l.assigned_to) ?? null) : null,
    customerId: l.customer_id,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    message: l.message,
    sourceUrl: l.source_url,
    attribution: l.attribution,
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      authorUserId: n.author_user_id,
      authorName: n.author_user_id ? (names.get(n.author_user_id) ?? null) : null,
      createdAt: n.created_at,
    })),
    customer: customer.data
      ? {
          id: customer.data.id,
          email: customer.data.email,
          customerType: customer.data.customer_type,
          b2bStatus: customer.data.b2b_status,
        }
      : null,
  };
}

async function loadLead(id: string) {
  const { data, error } = await crmDb().from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw dbError("Lead laden", error);
  if (!data) throw new Error("Lead nicht gefunden");
  return data;
}

async function systemNote(leadId: string, actor: StaffSession, body: string) {
  await crmDb().from("lead_notes").insert({ lead_id: leadId, author_user_id: actor.userId, body });
}

export async function setLeadStatus(
  input: { leadId: string; status: LeadStatus },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(z.object({ leadId: uuid, status: z.enum(LEAD_STATUSES) }), input);
  const lead = await loadLead(data.leadId);
  if (!canChangeLeadStatus(lead.status, data.status))
    throw new Error(
      `Wechsel von „${LEAD_STATUS_LABELS[lead.status]}“ zu „${LEAD_STATUS_LABELS[data.status]}“ ist nicht möglich`,
    );
  const { error } = await crmDb().from("leads").update({ status: data.status }).eq("id", lead.id);
  if (error) throw dbError("Status speichern", error);
  await systemNote(
    lead.id,
    actor,
    `Status: ${LEAD_STATUS_LABELS[lead.status]} → ${LEAD_STATUS_LABELS[data.status]}`,
  );
  await writeAudit(actor, {
    action: "lead.status",
    entityType: "lead",
    entityId: lead.id,
    before: { status: lead.status },
    after: { status: data.status },
  });
}

export async function addLeadNote(
  input: { leadId: string; body: string },
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(
    z.object({
      leadId: uuid,
      body: z.string().trim().min(1, "Bitte schreib eine Notiz.").max(5000),
    }),
    input,
  );
  await loadLead(data.leadId);
  const { data: note, error } = await crmDb()
    .from("lead_notes")
    .insert({ lead_id: data.leadId, author_user_id: actor.userId, body: data.body })
    .select("id")
    .single();
  if (error) throw dbError("Notiz speichern", error);
  await crmDb()
    .from("leads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", data.leadId);
  await writeAudit(actor, {
    action: "lead.note_add",
    entityType: "lead",
    entityId: data.leadId,
    after: { note_id: note.id },
  });
  return { id: note.id };
}

/** Lead einer Staff-Person zuweisen (null hebt die Zuweisung auf). */
export async function assignLead(
  input: { leadId: string; userId: string | null },
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(z.object({ leadId: uuid, userId: uuid.nullable() }), input);
  const lead = await loadLead(data.leadId);
  if (data.userId) {
    const { data: staff } = await crmDb()
      .from("staff_users")
      .select("user_id, is_active")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!staff?.is_active) throw new Error("Benutzer nicht gefunden oder inaktiv");
  }
  const { error } = await crmDb()
    .from("leads")
    .update({ assigned_to: data.userId })
    .eq("id", lead.id);
  if (error) throw dbError("Zuweisung speichern", error);
  await writeAudit(actor, {
    action: "lead.assign",
    entityType: "lead",
    entityId: lead.id,
    before: { assigned_to: lead.assigned_to },
    after: { assigned_to: data.userId },
  });
}

/** Aktive Staff-Personen für die Zuweisung (ohne Fulfillment, die Leads nicht sehen). */
export async function listAssignableStaff(): Promise<
  { userId: string; name: string; role: string }[]
> {
  const { data, error } = await crmDb()
    .from("staff_users")
    .select("user_id, display_name, email, role")
    .eq("is_active", true)
    .neq("role", "fulfillment")
    .order("display_name");
  if (error) throw dbError("Benutzer laden", error);
  return (data ?? []).map((s) => ({
    userId: s.user_id,
    name: s.display_name ?? s.email,
    role: s.role,
  }));
}

const convertSchema = z.object({
  leadId: uuid,
  companyName: z.string().trim().min(2, "Bitte gib den Firmennamen an.").max(200).optional(),
  vatId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}[0-9A-Z]{2,12}$/, "Bitte gib eine gültige USt-IdNr. an (z.B. DE123456789).")
    .optional(),
});

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || null, last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/**
 * Lead in einen B2B-Kunden umwandeln: Kunde anlegen oder vorhandenen per E-Mail übernehmen,
 * customer_type b2b und b2b_status approved setzen, b2b_applications als freigegeben protokollieren,
 * Lead auf "Gewonnen". Keine B2B-Oberfläche in Phase 1 (Briefing 13), nur Datenmodell.
 */
export async function convertLeadToB2B(
  input: z.input<typeof convertSchema>,
  actor: StaffSession,
): Promise<{ customerId: string; created: boolean }> {
  if (actor.role !== "owner" && actor.role !== "admin")
    throw new Error("Keine Berechtigung für diese Aktion");
  const data = parseInput(convertSchema, input);
  const lead = await loadLead(data.leadId);
  const companyName = data.companyName ?? lead.company;
  if (!companyName) throw new Error("Bitte gib den Firmennamen an.");
  const db = crmDb();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("customers")
    .select("id, customer_type, company_name, vat_id, b2b_status, anonymized_at, tags")
    .eq("email", lead.email)
    .maybeSingle();
  if (existing?.anonymized_at)
    throw new Error("Zu dieser E-Mail gibt es nur einen gelöschten Kunden");

  let customerId: string;
  let created = false;
  if (existing) {
    customerId = existing.id;
    const { error } = await db
      .from("customers")
      .update({
        customer_type: "b2b",
        b2b_status: "approved",
        company_name: existing.company_name || companyName,
        vat_id: data.vatId ?? existing.vat_id,
        tags: Array.from(new Set([...existing.tags, "B2B"])),
      })
      .eq("id", existing.id);
    if (error) throw dbError("Kunde aktualisieren", error);
  } else {
    const name = splitName(lead.contact_name);
    const { data: inserted, error } = await db
      .from("customers")
      .insert({
        email: lead.email,
        first_name: name.first,
        last_name: name.last,
        phone: lead.phone,
        customer_type: "b2b",
        b2b_status: "approved",
        company_name: companyName,
        vat_id: data.vatId ?? null,
        tags: ["B2B"],
        acquisition_source: "partner_lead",
        acquisition_details: asJson({ lead_id: lead.id, location_type: lead.location_type }),
      })
      .select("id")
      .single();
    if (error) throw dbError("Kunde anlegen", error);
    customerId = inserted.id;
    created = true;
  }

  const { error: appError } = await db.from("b2b_applications").insert({
    customer_id: customerId,
    company_name: companyName,
    vat_id: data.vatId ?? null,
    message: lead.message,
    status: "approved",
    reviewed_by: actor.userId,
    reviewed_at: now,
  });
  if (appError) throw dbError("B2B-Freischaltung protokollieren", appError);

  const status = statusAfterConversion();
  const { error: leadError } = await db
    .from("leads")
    .update({ customer_id: customerId, status })
    .eq("id", lead.id);
  if (leadError) throw dbError("Lead aktualisieren", leadError);
  await systemNote(lead.id, actor, `In B2B-Kunden umgewandelt${created ? " (neu angelegt)" : ""}.`);
  await db.from("customer_events").insert({
    customer_id: customerId,
    kind: "lead_converted",
    data: asJson({ lead_id: lead.id, by: actor.email }),
  });
  await writeAudit(actor, {
    action: "lead.convert_b2b",
    entityType: "lead",
    entityId: lead.id,
    before: { status: lead.status, customer_id: lead.customer_id },
    after: { status, customer_id: customerId, created },
  });
  return { customerId, created };
}
