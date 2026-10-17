import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import type { LegalEntity } from "@/lib/checkout/emails";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { AdminOrderError } from "./errors";

/**
 * Datenzugriff der Bestell-Module (Service Role, nur serverseitig). Jede Funktion, die hierüber
 * schreibt, prüft vorher die Rolle des Staff-Benutzers und ruft writeAudit auf.
 */
export function ordersDb() {
  return supabaseAdmin();
}

export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

/**
 * RPC auf Funktionen, die (noch) nicht in database.types.ts stehen, weil die Migration dieses
 * Pakets erst gesammelt remote angewendet wird (claim_due_jobs, fail_job_with_backoff).
 */
export async function rpcUntyped<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string; code?: string; details?: string } | null }> {
  const db = ordersDb() as unknown as {
    rpc: (
      fn: string,
      a: Record<string, unknown>,
    ) => PromiseLike<{
      data: unknown;
      error: { message: string; code?: string; details?: string } | null;
    }>;
  };
  const res = await db.rpc(name, args);
  return { data: (res.data as T | null) ?? null, error: res.error };
}

export interface OrderEventInput {
  kind: string;
  message: string;
  data?: Record<string, unknown>;
  actor?: StaffSession | null;
  visibleToCustomer?: boolean;
}

/** Ereignis im Bestellverlauf (order_events). Fehler werden geloggt, nicht geworfen. */
export async function addOrderEvent(orderId: string, input: OrderEventInput): Promise<void> {
  const { error } = await ordersDb()
    .from("order_events")
    .insert({
      order_id: orderId,
      kind: input.kind,
      message: input.message,
      data: asJson(input.data ?? {}),
      actor_user_id: input.actor?.userId ?? null,
      visible_to_customer: input.visibleToCustomer ?? false,
    });
  if (error) console.error("[admin/orders] order_events:", error.message);
}

/** Impressumsdaten für Mails und Lieferschein (shop_settings shop.legal_entity). */
export async function loadLegalEntity(): Promise<LegalEntity | null> {
  const { data } = await ordersDb()
    .from("shop_settings")
    .select("value")
    .eq("key", "shop.legal_entity")
    .maybeSingle();
  return (data?.value as LegalEntity | undefined) ?? null;
}

/** Anzeigenamen der Staff-Benutzer für Verlauf, Notizen und Erstattungen. */
export async function staffNames(
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await ordersDb()
    .from("staff_users")
    .select("user_id, display_name, email, role")
    .in("user_id", ids);
  const roleLabel: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    support: "Support",
    fulfillment: "Fulfillment",
  };
  for (const s of data ?? []) {
    out.set(s.user_id, `${s.display_name ?? s.email} (${roleLabel[s.role] ?? s.role})`);
  }
  return out;
}

export function requirePermission(allowed: boolean, message: string): void {
  if (!allowed) throw new AdminOrderError("forbidden", message);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Bestellung als UUID oder Bestellnummer (PV-10001) auflösen. */
export async function resolveOrderId(idOrNumber: string): Promise<string | null> {
  const value = idOrNumber.trim();
  if (isUuid(value)) return value;
  const m = /^(?:pv[\s-]?)?(\d{3,})$/i.exec(value);
  if (!m) return null;
  const { data } = await ordersDb()
    .from("orders")
    .select("id")
    .eq("order_number", `PV-${m[1]}`)
    .maybeSingle();
  return data?.id ?? null;
}
