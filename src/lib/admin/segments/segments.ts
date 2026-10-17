import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { asJson, crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import {
  describeRules,
  parseStoredRules,
  segmentRulesSchema,
  translateSegment,
  type InternalCondition,
  type SegmentCondition,
  type SegmentRules,
} from "./rules";

/**
 * Segmente: Auswertung (Trefferzahl live), Speichern, Mitglieder, Newsletter-Zielgruppe.
 * Die Übersetzung nach SQL passiert ausschließlich in rules.ts; hier nur Datenzugriff.
 */

export type MemberOrder =
  "last_order_desc" | "created_desc" | "total_spent_desc" | "orders_desc" | "name_asc";

export interface SegmentSummary {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules | null;
  summary: string;
  lastCount: number | null;
  lastCountedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function productLabels(): Promise<Record<string, string>> {
  const { data } = await crmDb()
    .from("products")
    .select("handle, product_translations(title, locale)")
    .neq("status", "archived");
  const map: Record<string, string> = {};
  for (const p of data ?? []) {
    const t = (p.product_translations ?? []).find((x) => x.locale === "de");
    map[p.handle] = t?.title ?? p.handle;
  }
  return map;
}

/** Trefferzahl einer (ungespeicherten) Regel, für die Live-Anzeige im Editor. */
export async function evaluateSegment(
  rules: unknown,
  extra: (SegmentCondition | InternalCondition)[] = [],
): Promise<{ count: number; summary: string }> {
  const parsed = parseInput(segmentRulesSchema, rules);
  const sql = translateSegment(parsed, extra);
  const { data, error } = await crmDb().rpc("crm_segment_count", {
    p_where: sql.where,
    p_params: asJson(sql.params),
  });
  if (error) throw dbError("Segment auswerten", error);
  return {
    count: Number(data ?? 0),
    summary: describeRules(parsed, { products: await productLabels() }),
  };
}

/** Kunden-IDs eines Regelwerks, sortiert und seitenweise. */
export async function segmentMemberIds(
  rules: SegmentRules,
  options: {
    extra?: (SegmentCondition | InternalCondition)[];
    limit?: number;
    offset?: number;
    order?: MemberOrder;
  } = {},
): Promise<string[]> {
  const sql = translateSegment(rules, options.extra ?? []);
  const { data, error } = await crmDb().rpc("crm_segment_members", {
    p_where: sql.where,
    p_params: asJson(sql.params),
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
    p_order: options.order ?? "last_order_desc",
  });
  if (error) throw dbError("Segment-Mitglieder laden", error);
  return (data ?? []) as string[];
}

export async function countSegmentMembers(
  rules: SegmentRules,
  extra: (SegmentCondition | InternalCondition)[] = [],
): Promise<number> {
  const sql = translateSegment(rules, extra);
  const { data, error } = await crmDb().rpc("crm_segment_count", {
    p_where: sql.where,
    p_params: asJson(sql.params),
  });
  if (error) throw dbError("Segment zählen", error);
  return Number(data ?? 0);
}

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  rules: segmentRulesSchema,
});

export type SaveSegmentInput = z.input<typeof saveSchema>;

/** Segment anlegen oder ändern; die Trefferzahl wird dabei neu gezählt und gespeichert. */
export async function saveSegment(
  input: SaveSegmentInput,
  actor: StaffSession,
): Promise<SegmentSummary> {
  assertPermission(actor, "viewCustomers");
  const data = parseInput(saveSchema, input);
  const count = await countSegmentMembers(data.rules);
  const db = crmDb();
  const now = new Date().toISOString();
  const row = {
    name: data.name,
    description: data.description ?? null,
    definition: asJson(data.rules),
    last_count: count,
    last_counted_at: now,
    updated_by: actor.userId,
  };
  let before: unknown = null;
  let saved;
  if (data.id) {
    const { data: old } = await db
      .from("saved_segments")
      .select("name, definition")
      .eq("id", data.id)
      .maybeSingle();
    if (!old) throw new Error("Segment nicht gefunden");
    before = old;
    const res = await db.from("saved_segments").update(row).eq("id", data.id).select("*").single();
    if (res.error) throw dbError("Segment speichern", res.error);
    saved = res.data;
  } else {
    const res = await db
      .from("saved_segments")
      .insert({ ...row, created_by: actor.userId })
      .select("*")
      .single();
    if (res.error) throw dbError("Segment anlegen", res.error);
    saved = res.data;
  }
  await writeAudit(actor, {
    action: data.id ? "segment.update" : "segment.create",
    entityType: "saved_segment",
    entityId: saved.id,
    before,
    after: { name: data.name, definition: data.rules },
  });
  return toSummary(saved, await productLabels());
}

export async function deleteSegment(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "viewCustomers");
  const segmentId = parseInput(z.string().uuid(), id);
  const db = crmDb();
  const { data: old } = await db
    .from("saved_segments")
    .select("name, definition")
    .eq("id", segmentId)
    .maybeSingle();
  if (!old) return;
  // Nur löschen, wenn keine Kampagne auf das Segment zeigt (auch versendete als Nachweis)
  const usage = (await segmentCampaignUsage()).get(segmentId);
  if (usage)
    throw new Error(
      `Das Segment wird von ${usage.count === 1 ? "der Kampagne" : `${usage.count} Kampagnen, zum Beispiel`} „${usage.names[0]}“ genutzt und lässt sich nicht löschen`,
    );
  const { error } = await db.from("saved_segments").delete().eq("id", segmentId);
  if (error) throw dbError("Segment löschen", error);
  await writeAudit(actor, {
    action: "segment.delete",
    entityType: "saved_segment",
    entityId: segmentId,
    before: old,
  });
}

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  definition: unknown;
  last_count: number | null;
  last_counted_at: string | null;
  created_at: string;
  updated_at: string;
};

function toSummary(row: SegmentRow, labels: Record<string, string>): SegmentSummary {
  const rules = parseStoredRules(row.definition);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules,
    summary: rules ? describeRules(rules, { products: labels }) : "Ungültige Definition",
    lastCount: row.last_count,
    lastCountedAt: row.last_counted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Alle gespeicherten Segmente. refreshCounts zählt die Treffer neu (langsamer). */
export async function listSegments(
  options: { refreshCounts?: boolean } = {},
): Promise<SegmentSummary[]> {
  const db = crmDb();
  const { data, error } = await db.from("saved_segments").select("*").order("name");
  if (error) throw dbError("Segmente laden", error);
  const labels = await productLabels();
  const rows = data ?? [];
  if (options.refreshCounts) {
    const now = new Date().toISOString();
    await Promise.all(
      rows.map(async (r) => {
        const rules = parseStoredRules(r.definition);
        if (!rules) return;
        r.last_count = await countSegmentMembers(rules);
        r.last_counted_at = now;
        await db
          .from("saved_segments")
          .update({ last_count: r.last_count, last_counted_at: now })
          .eq("id", r.id);
      }),
    );
  }
  return rows.map((r) => toSummary(r, labels));
}

export async function getSegment(id: string): Promise<SegmentSummary | null> {
  const { data, error } = await crmDb()
    .from("saved_segments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError("Segment laden", error);
  return data ? toSummary(data, await productLabels()) : null;
}

export interface SegmentMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  ordersCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}

/** Mitglieder eines gespeicherten Segments, seitenweise. */
export async function listSegmentMembers(
  segmentId: string,
  options: { page?: number; pageSize?: number; order?: MemberOrder } = {},
): Promise<{ items: SegmentMember[]; total: number }> {
  const segment = await getSegment(segmentId);
  if (!segment?.rules) throw new Error("Segment nicht gefunden");
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 200);
  const page = Math.max(options.page ?? 1, 1);
  const [ids, total] = await Promise.all([
    segmentMemberIds(segment.rules, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: options.order,
    }),
    countSegmentMembers(segment.rules),
  ]);
  if (ids.length === 0) return { items: [], total };
  const { data, error } = await crmDb()
    .from("customers")
    .select("id, email, first_name, last_name, orders_count, total_spent_cents, last_order_at")
    .in("id", ids);
  if (error) throw dbError("Kunden laden", error);
  const byId = new Map((data ?? []).map((c) => [c.id, c]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      ordersCount: c.orders_count,
      totalSpentCents: Number(c.total_spent_cents),
      lastOrderAt: c.last_order_at,
    }));
  return { items, total };
}

/**
 * Newsletter-Zielgruppe eines Segments: versandfähige Kontakte (subscribed, bestätigt, nicht
 * gesperrt) und Mitglieder ohne Opt-in, die übersprungen werden. Ohne Segment: alle versandfähigen
 * Kontakte.
 */
export async function segmentNewsletterAudience(
  segmentId: string | null,
): Promise<{ eligible: number; members: number | null; skippedWithoutOptIn: number | null }> {
  if (!segmentId) {
    const ids = await allSendableContactIds();
    return { eligible: ids.length, members: null, skippedWithoutOptIn: null };
  }
  const segment = await getSegment(segmentId);
  if (!segment?.rules) throw new Error("Segment nicht gefunden");
  const [ids, members] = await Promise.all([
    segmentContactIds(segment.rules),
    countSegmentMembers(segment.rules),
  ]);
  return { eligible: ids.length, members, skippedWithoutOptIn: Math.max(members - ids.length, 0) };
}

/** Versandfähige Kontakt-IDs eines Regelwerks (für den Kampagnenversand). */
export async function segmentContactIds(rules: SegmentRules): Promise<string[]> {
  const sql = translateSegment(rules);
  const ids: string[] = [];
  const pageSize = 1000;
  // PostgREST begrenzt Antworten (max_rows), deshalb seitenweise; die Funktion sortiert nach id
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await crmDb()
      .rpc("crm_segment_contact_ids", { p_where: sql.where, p_params: asJson(sql.params) })
      .range(from, from + pageSize - 1);
    if (error) throw dbError("Zielgruppe laden", error);
    const page = (data ?? []) as string[];
    ids.push(...page);
    if (page.length < pageSize) break;
  }
  return ids;
}

/** Alle versandfähigen Kontakte ohne Segment, seitenweise geladen (PostgREST liefert max. 1000). */
export async function allSendableContactIds(): Promise<string[]> {
  const db = crmDb();
  const { data: suppressed } = await db.from("email_suppressions").select("email");
  const blocked = new Set((suppressed ?? []).map((s) => String(s.email).toLowerCase()));
  const ids: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("newsletter_contacts")
      .select("id, email")
      .eq("status", "subscribed")
      .not("confirmed_at", "is", null)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw dbError("Kontakte laden", error);
    for (const c of data ?? []) if (!blocked.has(String(c.email).toLowerCase())) ids.push(c.id);
    if (!data || data.length < pageSize) break;
  }
  return ids;
}

/** Kampagnen je Segment (für Löschschutz und Anzeige in der Segmentliste). */
export async function segmentCampaignUsage(): Promise<
  Map<string, { count: number; names: string[] }>
> {
  const { data, error } = await crmDb()
    .from("newsletter_campaigns")
    .select("segment_id, name")
    .not("segment_id", "is", null);
  if (error) throw dbError("Kampagnen laden", error);
  const map = new Map<string, { count: number; names: string[] }>();
  for (const c of data ?? []) {
    if (!c.segment_id) continue;
    const entry = map.get(c.segment_id) ?? { count: 0, names: [] };
    entry.count++;
    entry.names.push(c.name);
    map.set(c.segment_id, entry);
  }
  return map;
}

/** Erste Treffer eines (ungespeicherten) Regelwerks für die Vorschau im Editor. */
export async function previewSegmentMembers(
  rules: SegmentRules,
  limit = 20,
): Promise<SegmentMember[]> {
  const ids = await segmentMemberIds(rules, { limit: Math.min(Math.max(limit, 1), 100) });
  if (ids.length === 0) return [];
  const { data, error } = await crmDb()
    .from("customers")
    .select("id, email, first_name, last_name, orders_count, total_spent_cents, last_order_at")
    .in("id", ids);
  if (error) throw dbError("Kunden laden", error);
  const byId = new Map((data ?? []).map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      ordersCount: c.orders_count,
      totalSpentCents: Number(c.total_spent_cents),
      lastOrderAt: c.last_order_at,
    }));
}

/** Produkte für die Bedingung "Hat Produkt gekauft" (Handle und deutscher Titel). */
export async function segmentProductOptions(): Promise<{ value: string; label: string }[]> {
  const labels = await productLabels();
  return Object.entries(labels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}
