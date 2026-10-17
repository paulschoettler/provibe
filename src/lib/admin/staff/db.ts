import "server-only";
import type { StaffRole, StaffSession } from "@/lib/admin/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Datenzugriff auf staff_users und staff_invites (Service Role, nur serverseitig). */

export interface StaffRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: StaffRole;
  is_active: boolean;
  mfa_enforced: boolean;
  last_login_at: string | null;
  created_at: string;
}

const COLUMNS =
  "user_id, email, display_name, role, is_active, mfa_enforced, last_login_at, created_at";

export async function getStaffByUserId(userId: string): Promise<StaffRow | null> {
  const { data } = await supabaseAdmin()
    .from("staff_users")
    .select(COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as StaffRow | null) ?? null;
}

export async function getStaffByEmail(email: string): Promise<StaffRow | null> {
  const { data } = await supabaseAdmin()
    .from("staff_users")
    .select(COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return (data as StaffRow | null) ?? null;
}

export async function listStaffRows(): Promise<StaffRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("staff_users")
    .select(COLUMNS)
    .order("created_at");
  if (error) throw new Error(`staff_users: ${error.message}`);
  return (data ?? []) as StaffRow[];
}

export async function getPendingInvite(email: string) {
  const { data } = await supabaseAdmin()
    .from("staff_invites")
    .select("email, role, invited_by, created_at, accepted_at")
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null)
    .maybeSingle();
  return data;
}

export async function listPendingInvites() {
  const { data, error } = await supabaseAdmin()
    .from("staff_invites")
    .select("email, role, invited_by, created_at, accepted_at")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`staff_invites: ${error.message}`);
  return data ?? [];
}

/** Staff-Zeile als Sitzungsobjekt, zum Beispiel als Akteur für writeAudit vor der 2FA. */
export function toStaffSession(row: StaffRow, mfaVerified = false): StaffSession {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name ?? row.email,
    role: row.role,
    mfaVerified,
    mfaEnforced: row.mfa_enforced,
  };
}

export async function touchLastLogin(userId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("staff_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) console.error("[admin] last_login_at nicht gesetzt", error.message);
}

/**
 * Tabelle staff_recovery_codes und Funktion invite_staff stehen noch nicht in database.types.ts
 * (Migration 20261017201000 wird gesammelt angewendet, danach Typen neu erzeugen). Bis dahin
 * läuft der Zugriff über diesen ungetypten Client; die Zeilentypen stehen hier.
 */
export interface RecoveryCodeRow {
  id: string;
  user_id: string;
  code_hash: string;
  used_at: string | null;
  created_at: string;
}

export function untypedAdmin(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}
