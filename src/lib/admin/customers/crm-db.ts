import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Datenbankzugriff des CRM-Pakets (Kunden, Segmente, Leads, Newsletter, Automationen, E-Mails,
 * Inhalte, Einstellungen). Service-Role, nur serverseitig.
 *
 * Die Migrationen 20261017204000 bis 204300 ergänzen Spalten und Funktionen, die in
 * database.types.ts erst nach der nächsten Typgenerierung stehen. Bis dahin ergänzt dieser Typ die
 * generierten Typen. Nach der Neugenerierung sind die Ergänzungen deckungsgleich und schaden nicht.
 */

type PublicSchema = Database["public"];
type Tables = PublicSchema["Tables"];

type Extend<T extends { Row: object; Insert: object; Update: object }, Row extends object> = Omit<
  T,
  "Row" | "Insert" | "Update"
> & {
  Row: T["Row"] & Row;
  Insert: T["Insert"] & Partial<Row>;
  Update: T["Update"] & Partial<Row>;
};

type ExtendedTables = {
  customers: Extend<
    Tables["customers"],
    { blocked_at: string | null; blocked_reason: string | null; blocked_by: string | null }
  >;
  saved_segments: Extend<
    Tables["saved_segments"],
    {
      description: string | null;
      last_count: number | null;
      last_counted_at: string | null;
      updated_by: string | null;
    }
  >;
  newsletter_contacts: Extend<Tables["newsletter_contacts"], { unsubscribe_token: string }>;
  newsletter_campaigns: Extend<
    Tables["newsletter_campaigns"],
    { reply_to: string | null; test_sent_at: string | null }
  >;
  campaign_recipients: Extend<
    Tables["campaign_recipients"],
    {
      delivered_at: string | null;
      complained_at: string | null;
      error: string | null;
      created_at: string;
    }
  >;
  automation_runs: Extend<Tables["automation_runs"], { token_hash: string | null }>;
  legal_document_versions: Extend<
    Tables["legal_document_versions"],
    { published_at: string | null; published_by: string | null }
  >;
  pages: Extend<Tables["pages"], { published_at: string | null }>;
};

type ExtendedFunctions = {
  crm_segment_count: { Args: { p_where: string; p_params?: Json }; Returns: number };
  crm_segment_members: {
    Args: {
      p_where: string;
      p_params?: Json;
      p_limit?: number;
      p_offset?: number;
      p_order?: string;
    };
    Returns: string[];
  };
  crm_segment_contact_ids: { Args: { p_where: string; p_params?: Json }; Returns: string[] };
};

export type CrmDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<Tables, keyof ExtendedTables> & ExtendedTables;
    Functions: PublicSchema["Functions"] & ExtendedFunctions;
  };
};

export type CrmClient = SupabaseClient<CrmDatabase>;

export function crmDb(): CrmClient {
  return supabaseAdmin() as unknown as CrmClient;
}

/** Beliebige serialisierbare Daten als jsonb übergeben. */
export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

/** Postgres-Fehlercode für Unique-Verletzungen. */
export const UNIQUE_VIOLATION = "23505";

/** Einheitlicher Fehler für Datenbankzugriffe, ohne Interna an die Oberfläche zu geben. */
export function dbError(context: string, error: { message: string } | null): Error {
  console.error(`[crm] ${context}`, error?.message);
  return new Error(`${context} fehlgeschlagen`);
}

/**
 * Ungetypter Zugriff für Tabellen und Spalten, deren generierte Typen hier nicht passen
 * (zum Beispiel Löschung über viele Tabellen, Nachweise aus webhook_events). Nur serverseitig.
 */
export function untypedCrm(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}
