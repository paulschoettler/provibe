import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Lesen des Audit-Logs für /admin/protokoll (Schreiben: writeAudit in audit.ts).
 * Filter nach Aktion, Entität, Benutzer und Zeitraum (UTC-Grenzen, siehe parsePeriod bzw. berlinMidnight).
 */
export interface AuditEntry {
  id: number;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Json | null;
  after: Json | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditFilter {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  /** inklusive */
  from?: Date;
  /** exklusive */
  to?: Date;
  /** Freitext in entity_id (zum Beispiel Bestellnummer oder E-Mail) */
  entityId?: string;
}

const COLUMNS =
  "id, created_at, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, before, after, ip, user_agent";

type Row = {
  id: number;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  ip: unknown;
  user_agent: string | null;
};

function map(r: Row): AuditEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    before: r.before,
    after: r.after,
    ip: r.ip ? String(r.ip) : null,
    userAgent: r.user_agent,
  };
}

/** Sonderzeichen für ilike entschärfen */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listAuditLog(
  filter: AuditFilter,
  page = 1,
  pageSize = 50,
): Promise<{ rows: AuditEntry[]; total: number }> {
  let q = supabaseAdmin().from("audit_log").select(COLUMNS, { count: "exact" });
  if (filter.action) q = q.eq("action", filter.action);
  if (filter.entityType) q = q.eq("entity_type", filter.entityType);
  if (filter.actorUserId) q = q.eq("actor_user_id", filter.actorUserId);
  if (filter.from) q = q.gte("created_at", filter.from.toISOString());
  if (filter.to) q = q.lt("created_at", filter.to.toISOString());
  if (filter.entityId) q = q.ilike("entity_id", `%${escapeLike(filter.entityId.slice(0, 100))}%`);
  const offset = (page - 1) * pageSize;
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) throw new Error(`audit_log: ${error.message}`);
  return { rows: ((data ?? []) as Row[]).map(map), total: count ?? 0 };
}

export async function getAuditEntry(id: number): Promise<AuditEntry | null> {
  const { data, error } = await supabaseAdmin()
    .from("audit_log")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`audit_log: ${error.message}`);
  return data ? map(data as Row) : null;
}

/**
 * Auswahlwerte für die Filter: vorkommende Aktionen und Entitäten aus den letzten 5.000 Einträgen
 * (PostgREST kennt kein DISTINCT; für die Größe des Shops reicht das).
 */
export async function auditFacets(): Promise<{ actions: string[]; entityTypes: string[] }> {
  const { data, error } = await supabaseAdmin()
    .from("audit_log")
    .select("action, entity_type")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`audit_log: ${error.message}`);
  const actions = new Set<string>();
  const entityTypes = new Set<string>();
  for (const r of data ?? []) {
    actions.add(r.action);
    entityTypes.add(r.entity_type);
  }
  return { actions: [...actions].sort(), entityTypes: [...entityTypes].sort() };
}

export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/**
 * Vorher und Nachher Feld für Feld gegenüberstellen (oberste Ebene). Werte, die keine Objekte
 * sind, erscheinen unter dem Schlüssel "Wert".
 */
export function diffAudit(before: unknown, after: unknown): FieldChange[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(before) && !isObj(after)) {
    if (before === null && after === null) return [];
    return [
      { key: "Wert", before, after, changed: JSON.stringify(before) !== JSON.stringify(after) },
    ];
  }
  const b = isObj(before) ? before : {};
  const a = isObj(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  return keys.map((key) => ({
    key,
    before: key in b ? b[key] : undefined,
    after: key in a ? a[key] : undefined,
    changed: JSON.stringify(b[key]) !== JSON.stringify(a[key]),
  }));
}
