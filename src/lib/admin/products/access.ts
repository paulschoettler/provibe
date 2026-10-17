import "server-only";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Gemeinsame Server-Helfer des Pakets Admin-Katalog. Datenzugriff läuft über den
 * Service-Role-Client (RLS umgangen), deshalb prüft jede schreibende Funktion die Rolle
 * selbst, zusätzlich zu requireStaff() in der aufrufenden Server Action.
 */

export type AdminDb = ReturnType<typeof supabaseAdmin>;

export function db(): AdminDb {
  return supabaseAdmin();
}

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: StaffSession | null | undefined, permission: Permission): boolean {
  return !!actor && PERMISSIONS[permission](actor);
}

/**
 * RPC auf Funktionen, die noch nicht in database.types.ts stehen (eigene Migrationen dieses
 * Pakets, Typen werden nach dem gesammelten Remote-Deploy neu erzeugt).
 */
export async function rpcUntyped<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string; code?: string; details?: string } | null }> {
  const client = db() as unknown as {
    rpc: (
      fn: string,
      a: Record<string, unknown>,
    ) => PromiseLike<{
      data: unknown;
      error: { message: string; code?: string; details?: string } | null;
    }>;
  };
  const res = await client.rpc(name, args);
  return { data: (res.data as T) ?? null, error: res.error };
}

/** Fehlertext aus der Datenbank ohne interne Details für die Oberfläche. */
export function dbErrorMessage(error: { code?: string; message: string } | null): string {
  if (!error) return "Unbekannter Fehler.";
  if (error.code === "23505") return "Dieser Wert ist schon vergeben.";
  if (error.code === "23503") return "Der Datensatz wird noch an anderer Stelle verwendet.";
  if (error.code === "23514") return "Ein Wert verletzt eine Regel der Datenbank.";
  console.error("admin-katalog:", error.code, error.message);
  return "Speichern ist fehlgeschlagen. Bitte versuche es noch einmal.";
}
