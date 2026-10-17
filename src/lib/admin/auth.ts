import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

export interface StaffSession {
  userId: string;
  email: string;
  displayName: string;
  role: StaffRole;
  /** Zwei-Faktor für diese Sitzung bestätigt (AAL2) */
  mfaVerified: boolean;
  mfaEnforced: boolean;
}

/** Rangfolge der Rollen: owner > admin > support = fulfillment (gleichrangig, verschiedene Rechte) */
const RANK: Record<StaffRole, number> = { owner: 4, admin: 3, support: 1, fulfillment: 1 };

/**
 * Staff-Sitzung aus den Auth-Cookies lesen. Gibt null zurück, wenn niemand eingeloggt ist
 * oder der Benutzer kein aktiver Staff ist. Pro Request einmal (React cache).
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabaseAdmin()
    .from("staff_users")
    .select("user_id, email, display_name, role, is_active, mfa_enforced")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff || !staff.is_active) return null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    userId: staff.user_id,
    email: staff.email,
    displayName: staff.display_name ?? staff.email,
    role: staff.role,
    mfaVerified: aal?.currentLevel === "aal2",
    mfaEnforced: staff.mfa_enforced,
  };
});

/** Rechteprüfung: hat die Rolle mindestens den Rang der geforderten Rolle? */
export function hasRole(session: StaffSession, minimum: StaffRole): boolean {
  return RANK[session.role] >= RANK[minimum];
}

/**
 * Für Seiten und Server Actions im Backoffice: leitet ohne Sitzung auf den Login,
 * ohne bestätigte Zwei-Faktor-Authentifizierung auf /admin/2fa und wirft bei fehlender Rolle.
 */
export async function requireStaff(
  minimum: StaffRole = "support",
  options?: { next?: string },
): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session)
    redirect(`/admin/login${options?.next ? `?next=${encodeURIComponent(options.next)}` : ""}`);
  if (session.mfaEnforced && !session.mfaVerified)
    redirect(`/admin/2fa${options?.next ? `?next=${encodeURIComponent(options.next)}` : ""}`);
  if (!hasRole(session, minimum)) {
    throw new Error("Keine Berechtigung für diese Aktion");
  }
  return session;
}

/** Feingranulare Rechte (Entscheidung H19): Benutzerverwaltung nur Owner, Erstattungen Owner und Admin. */
export const PERMISSIONS = {
  manageUsers: (s: StaffSession) => s.role === "owner",
  refund: (s: StaffSession) => s.role === "owner" || s.role === "admin",
  editProducts: (s: StaffSession) => s.role === "owner" || s.role === "admin",
  editContent: (s: StaffSession) => s.role === "owner" || s.role === "admin",
  editSettings: (s: StaffSession) => s.role === "owner" || s.role === "admin",
  fulfil: (s: StaffSession) => s.role === "owner" || s.role === "admin" || s.role === "fulfillment",
  viewCustomers: (s: StaffSession) => s.role !== "fulfillment",
  sendNewsletter: (s: StaffSession) => s.role === "owner" || s.role === "admin",
} as const;
