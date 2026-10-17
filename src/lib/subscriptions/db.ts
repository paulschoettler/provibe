import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { ActorType, SubscriptionPatch, SubscriptionRow, SubscriptionStatus } from "./types";

/**
 * Datenbankzugriff des Abos. Die Spalten und Funktionen aus Migration 20261017107000 stehen noch
 * nicht in database.types.ts (wird nach dem Anwenden neu generiert), deshalb ein schmaler,
 * untypisierter Service-Role-Client. Nur serverseitig (server-only), nie im Client-Bundle.
 */
export function aboDb(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

export class SubscriptionConflictError extends Error {
  constructor(message = "Das Abo wurde gerade geändert. Bitte lade die Seite neu.") {
    super(message);
    this.name = "SubscriptionConflictError";
  }
}

export async function loadSubscriptionRow(id: string): Promise<SubscriptionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await aboDb()
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Abo nicht geladen: ${error.message}`);
  return (data as SubscriptionRow | null) ?? null;
}

export interface ApplyInput {
  id: string;
  /** erlaubte Ausgangszustände (null: egal) */
  expected: SubscriptionStatus[] | null;
  patch: SubscriptionPatch;
  event: { kind: string; data?: Record<string, unknown> } | null;
  actor: { type: ActorType; id?: string | null };
}

/**
 * Atomarer Zustandswechsel über public.subscription_apply (sperrt die Zeile, prüft den Status,
 * schreibt Patch und Ereignis in einer Transaktion).
 */
export async function applySubscription(input: ApplyInput): Promise<SubscriptionRow> {
  const { data, error } = await aboDb().rpc("subscription_apply", {
    p_id: input.id,
    p_expected: input.expected,
    p_patch: input.patch,
    p_event_kind: input.event?.kind ?? null,
    p_event_data: input.event?.data ?? {},
    p_actor_type: input.actor.type,
    p_actor_id: input.actor.id ?? null,
  });
  if (error) {
    if (error.message.includes("SUBSCRIPTION_STATE_CONFLICT"))
      throw new SubscriptionConflictError();
    throw new Error(`Abo nicht geändert: ${error.message}`);
  }
  return data as SubscriptionRow;
}

/** Ereignis ohne Zustandsänderung (Erinnerung verschickt, Mail fehlgeschlagen, ...). */
export async function recordSubscriptionEvent(
  subscriptionId: string,
  kind: string,
  data: Record<string, unknown> = {},
  actor: { type: ActorType; id?: string | null } = { type: "system" },
): Promise<void> {
  const { error } = await aboDb()
    .from("subscription_events")
    .insert({
      subscription_id: subscriptionId,
      kind,
      data,
      actor_type: actor.type,
      actor_id: actor.id ?? null,
    });
  if (error) console.error("[abo] Ereignis nicht gespeichert", kind, error.message);
}

export async function lockSubscription(id: string): Promise<boolean> {
  const { data, error } = await aboDb().rpc("subscription_lock", { p_id: id });
  if (error) throw new Error(`Abo nicht gesperrt: ${error.message}`);
  return data === true;
}

export async function releaseSubscription(id: string): Promise<void> {
  const { error } = await aboDb().rpc("subscription_release", { p_id: id });
  if (error) console.error("[abo] Sperre nicht gelöst", error.message);
}
