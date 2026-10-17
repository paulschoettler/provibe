import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Datenbankzugriff des Checkouts. carts, checkout_sessions, orders und alle Bestandstabellen haben
 * bewusst keine anon-Policies (ADR-007, ADR-010): jeder Zugriff läuft serverseitig über den
 * Service-Role-Client. Dieser Client darf nie in eine Client-Komponente gelangen (server-only).
 */
export function checkoutDb() {
  return supabaseAdmin();
}

/** Beliebige serialisierbare Daten als Json-Spalte übergeben (Typhilfe für jsonb). */
export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

/** Postgres-Fehlercode für Unique-Verletzungen (Idempotenz bei parallelen Webhooks). */
export const UNIQUE_VIOLATION = "23505";
