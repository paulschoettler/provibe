import "server-only";
import type { StaffRole, StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listPendingInvites, listStaffRows, untypedAdmin } from "./db";
import { sendStaffInviteMail, sendStaffMagicLinkMail, staffCallbackLink } from "./mails";
import {
  checkActiveChange,
  checkRoleChange,
  mfaDisplay,
  type MfaDisplay,
  type RuleResult,
} from "./rules";

/** Benutzer und Rollen (/admin/einstellungen/benutzer). Alle Schreibwege prüfen die Regeln aus rules.ts. */

export interface StaffListItem {
  userId: string | null;
  email: string;
  displayName: string | null;
  role: StaffRole;
  isActive: boolean;
  mfa: MfaDisplay;
  lastLoginAt: string | null;
  invitedAt: string | null;
  /** offene Einladung ohne Auth-Konto */
  invitePending: boolean;
}

/** Staff-Benutzer plus offene Einladungen, mit Zwei-Faktor-Status aus Supabase Auth. */
export async function listStaffOverview(): Promise<StaffListItem[]> {
  const [rows, invites, users] = await Promise.all([
    listStaffRows(),
    listPendingInvites(),
    supabaseAdmin().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const authById = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
  // listUsers liefert keine Faktoren mit, deshalb je Benutzer abfragen (wenige Staff-Konten)
  const verifiedById = new Map(
    await Promise.all(
      rows.map(async (r) => {
        const { data } = await supabaseAdmin().auth.admin.mfa.listFactors({ userId: r.user_id });
        const count = (data?.factors ?? []).filter(
          (f) => f.factor_type === "totp" && f.status === "verified",
        ).length;
        return [r.user_id, count] as const;
      }),
    ),
  );
  const items: StaffListItem[] = rows.map((r) => {
    const auth = authById.get(r.user_id);
    const verified = verifiedById.get(r.user_id) ?? 0;
    // Konto angelegt (Einladungslink erzeugt), aber noch nie angemeldet: gilt als offene Einladung
    const neverSignedIn = !r.last_login_at && !auth?.last_sign_in_at;
    return {
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      isActive: r.is_active,
      mfa: mfaDisplay({
        verifiedFactors: verified,
        invitePending: neverSignedIn && verified === 0,
      }),
      lastLoginAt: r.last_login_at ?? auth?.last_sign_in_at ?? null,
      invitedAt: neverSignedIn ? r.created_at : null,
      invitePending: false,
    };
  });
  const known = new Set(rows.map((r) => r.email.toLowerCase()));
  for (const inv of invites) {
    if (known.has(String(inv.email).toLowerCase())) continue;
    items.push({
      userId: null,
      email: String(inv.email),
      displayName: null,
      role: inv.role,
      isActive: true,
      mfa: "invite",
      lastLoginAt: null,
      invitedAt: inv.created_at,
      invitePending: true,
    });
  }
  const order: Record<StaffRole, number> = { owner: 0, admin: 1, support: 2, fulfillment: 3 };
  return items.sort(
    (a, b) =>
      Number(a.invitePending) - Number(b.invitePending) ||
      Number(b.isActive) - Number(a.isActive) ||
      order[a.role] - order[b.role] ||
      a.email.localeCompare(b.email),
  );
}

async function staffForRules() {
  const rows = await listStaffRows();
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role,
    isActive: r.is_active,
    email: r.email,
  }));
}

export async function changeStaffRole(
  actor: StaffSession,
  userId: string,
  role: StaffRole,
): Promise<RuleResult> {
  const all = await staffForRules();
  const target = all.find((s) => s.userId === userId);
  if (!target) return { ok: false, reason: "Benutzer nicht gefunden." };
  const check = checkRoleChange(actor, target, role, all);
  if (!check.ok) return check;
  const { error } = await supabaseAdmin()
    .from("staff_users")
    .update({ role })
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "Speichern fehlgeschlagen." };
  await writeAudit(actor, {
    action: "staff.role_change",
    entityType: "staff_user",
    entityId: userId,
    before: { role: target.role },
    after: { role },
  });
  return { ok: true };
}

export async function setStaffActive(
  actor: StaffSession,
  userId: string,
  active: boolean,
): Promise<RuleResult> {
  const all = await staffForRules();
  const target = all.find((s) => s.userId === userId);
  if (!target) return { ok: false, reason: "Benutzer nicht gefunden." };
  const check = checkActiveChange(actor, target, active, all);
  if (!check.ok) return check;
  const { error } = await supabaseAdmin()
    .from("staff_users")
    .update({ is_active: active })
    .eq("user_id", userId);
  if (error) return { ok: false, reason: "Speichern fehlgeschlagen." };
  await writeAudit(actor, {
    action: active ? "staff.activate" : "staff.deactivate",
    entityType: "staff_user",
    entityId: userId,
    before: { is_active: target.isActive },
    after: { is_active: active },
  });
  return { ok: true };
}

export type InviteResult =
  | { ok: true; result: "invited" | "linked" | "reactivated"; mailed: boolean }
  | { ok: false; reason: string };

/**
 * Einladen (nur Owner, geprüft in invite_staff und hier): Datenbankfunktion schreibt staff_invites
 * bzw. staff_users, danach Mail mit Link über integrations().email. Bei einer neuen Adresse legt
 * generateLink("invite") das Auth-Konto an, der Trigger erzeugt den staff_users-Eintrag.
 */
export async function inviteStaff(
  actor: StaffSession,
  email: string,
  role: StaffRole,
): Promise<InviteResult> {
  if (actor.role !== "owner") return { ok: false, reason: "Nur Owner dürfen Benutzer einladen." };
  const normalized = email.trim().toLowerCase();
  const { data, error } = await untypedAdmin().rpc("invite_staff", {
    p_email: normalized,
    p_role: role,
    p_actor: actor.userId,
  });
  if (error) {
    if (error.code === "PGRST202") {
      return {
        ok: false,
        reason:
          "Die Datenbankfunktion invite_staff fehlt noch (Migration 20261017201000 anwenden).",
      };
    }
    console.error("[admin] invite_staff", error.code, error.message);
    return {
      ok: false,
      reason:
        error.code === "42501"
          ? "Nur Owner dürfen Benutzer einladen."
          : "Einladung fehlgeschlagen.",
    };
  }
  const result = data as "invited" | "linked" | "reactivated" | "already_staff";
  if (result === "already_staff")
    return { ok: false, reason: "Diese Adresse hat bereits Zugang zum Backoffice." };

  const type = result === "invited" ? "invite" : "magiclink";
  const { data: link, error: linkError } = await supabaseAdmin().auth.admin.generateLink({
    type,
    email: normalized,
  });
  const hashed = link?.properties?.hashed_token;
  let mailed = false;
  if (!linkError && hashed) {
    const url = staffCallbackLink(hashed, type, "/admin");
    const sent =
      type === "invite"
        ? await sendStaffInviteMail(normalized, url, role, actor.displayName)
        : await sendStaffMagicLinkMail(normalized, url);
    mailed = sent.status !== "suppressed";
  } else {
    console.error("[admin] Einladungslink nicht erzeugt", linkError?.code ?? linkError?.message);
  }
  await writeAudit(actor, {
    action: "staff.invite",
    entityType: "staff_invite",
    entityId: normalized,
    after: { role, result, mailed },
  });
  return { ok: true, result, mailed };
}

/** Offene Einladung zurückziehen (nur ohne Auth-Konto). */
export async function revokeInvite(actor: StaffSession, email: string): Promise<RuleResult> {
  if (actor.role !== "owner")
    return { ok: false, reason: "Nur Owner dürfen Einladungen zurückziehen." };
  const { error, count } = await supabaseAdmin()
    .from("staff_invites")
    .delete({ count: "exact" })
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null);
  if (error) return { ok: false, reason: "Zurückziehen fehlgeschlagen." };
  if (!count) return { ok: false, reason: "Keine offene Einladung gefunden." };
  await writeAudit(actor, {
    action: "staff.invite_revoke",
    entityType: "staff_invite",
    entityId: email,
  });
  return { ok: true };
}
