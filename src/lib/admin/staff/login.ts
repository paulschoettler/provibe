import "server-only";
import { writeAudit } from "@/lib/admin/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getPendingInvite, getStaffByEmail, getStaffByUserId, toStaffSession } from "./db";
import { sendStaffMagicLinkMail, staffCallbackLink } from "./mails";
import { safeAdminNext } from "./redirect";

/**
 * Erster Faktor der Backoffice-Anmeldung: Passwort oder Magic Link (Supabase Auth).
 * Nur aktive staff_users kommen durch; alle anderen bekommen dieselbe neutrale Meldung wie bei
 * falschen Angaben, damit niemand herausfinden kann, welche Adressen Zugang haben.
 * Der zweite Faktor (TOTP) folgt in mfa.ts.
 */

const FIFTEEN_MINUTES = 15 * 60;

export type PasswordLoginResult =
  | { status: "ok"; userId: string }
  | { status: "invalid" }
  | { status: "rate_limited" }
  | { status: "error" };

async function limited(action: string, limit: number, identifier?: string): Promise<boolean> {
  const r = await checkRateLimit({ action, limit, windowSeconds: FIFTEEN_MINUTES, identifier });
  return !r.allowed;
}

export async function signInStaffWithPassword(
  email: string,
  password: string,
): Promise<PasswordLoginResult> {
  const normalized = email.trim().toLowerCase();
  if ((await limited("admin-login-ip", 20)) || (await limited("admin-login-mail", 8, normalized))) {
    return { status: "rate_limited" };
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error || !data.user) {
    // Fehlversuche nur für echte Staff-Adressen protokollieren (Angriffe erkennen, keine Kundendaten)
    const staff = await getStaffByEmail(normalized);
    if (staff) {
      await writeAudit(null, {
        action: "staff.sign_in_failed",
        entityType: "staff_user",
        entityId: staff.user_id,
        after: { method: "password", reason: error?.code ?? "unknown" },
      });
    }
    if (error && error.status && error.status >= 500) return { status: "error" };
    return { status: "invalid" };
  }

  const staff = await getStaffByUserId(data.user.id);
  if (!staff || !staff.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return { status: "invalid" };
  }
  await writeAudit(toStaffSession(staff), {
    action: "staff.sign_in",
    entityType: "staff_user",
    entityId: staff.user_id,
    after: { method: "password" },
  });
  return { status: "ok", userId: staff.user_id };
}

export type MagicLinkResult = "sent" | "rate_limited" | "error";

/**
 * Magic Link für Staff. Bestehende Staff-Konten bekommen einen Anmeldelink, offene Einladungen ohne
 * Auth-Konto einen Einladungslink (legt das Konto an, der Trigger erzeugt den staff_users-Eintrag).
 * Für alle anderen Adressen passiert nichts; die Antwort ist trotzdem "sent" (neutral).
 */
export async function sendStaffMagicLink(
  email: string,
  rawNext?: string | null,
): Promise<MagicLinkResult> {
  const normalized = email.trim().toLowerCase();
  const next = safeAdminNext(rawNext);
  if ((await limited("admin-magic-ip", 10)) || (await limited("admin-magic-mail", 3, normalized))) {
    return "rate_limited";
  }
  try {
    const staff = await getStaffByEmail(normalized);
    let type: "magiclink" | "invite" | null = null;
    if (staff?.is_active) type = "magiclink";
    else if (!staff && (await getPendingInvite(normalized))) type = "invite";
    if (!type) return "sent";

    const { data, error } = await supabaseAdmin().auth.admin.generateLink({
      type,
      email: normalized,
    });
    const hashed = data?.properties?.hashed_token;
    if (error || !hashed) {
      console.error("[admin] Magic Link nicht erzeugt", error?.code ?? error?.message);
      return "error";
    }
    await sendStaffMagicLinkMail(normalized, staffCallbackLink(hashed, type, next));
    return "sent";
  } catch (error) {
    console.error("[admin] sendStaffMagicLink fehlgeschlagen", error);
    return "error";
  }
}

/** Abmelden (alle Tabs dieses Browsers) mit Protokolleintrag. */
export async function signOutStaff(): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const staff = await getStaffByUserId(user.id);
    if (staff) {
      await writeAudit(toStaffSession(staff), {
        action: "staff.sign_out",
        entityType: "staff_user",
        entityId: staff.user_id,
      });
    }
  }
  await supabase.auth.signOut({ scope: "local" });
}
