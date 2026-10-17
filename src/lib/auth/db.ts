import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Datenbankfunktionen aus Migration 20261017103000_konto_auth.sql. Sie stehen noch nicht in
 * src/lib/supabase/database.types.ts (wird nach dem Anwenden der Migration neu generiert),
 * deshalb hier ein schmaler, untypisierter Zugang. Ausführbar nur mit der Service Role.
 */
type KontoFunction =
  | "link_auth_user_to_customer"
  | "claim_guest_orders_for"
  | "anonymize_customer"
  | "merge_cart_into";

export async function kontoRpc<T>(
  fn: KontoFunction,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const client = supabaseAdmin() as unknown as SupabaseClient;
  const { data, error } = await client.rpc(fn, args);
  return { data: (data as T | null) ?? null, error: error ? { message: error.message } : null };
}
