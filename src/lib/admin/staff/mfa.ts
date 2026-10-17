import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { publicEnv } from "@/lib/env/public";
import { clientIpFromHeaders } from "@/lib/security/rate-limit-core";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import {
  getStaffByUserId,
  toStaffSession,
  touchLastLogin,
  untypedAdmin,
  type RecoveryCodeRow,
  type StaffRow,
} from "./db";
import {
  findMatchingRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "./recovery-codes";

/**
 * Zweiter Faktor (TOTP über Supabase MFA) und Wiederherstellung (Entscheidung H15).
 *
 * Ablauf:
 *  - Erster Login ohne bestätigten Faktor: startEnrollment() legt einen TOTP-Faktor an (QR-Code und
 *    Geheimnis), confirmEnrollment() prüft den ersten Code, hebt die Sitzung auf AAL2 und erzeugt
 *    zehn Wiederherstellungscodes (nur als Hash gespeichert, Klartext genau einmal zurück).
 *  - Danach: verifyTotp() bei jeder Anmeldung.
 *  - Gerät verloren: redeemRecoveryCode() verbraucht einen Code, löscht die TOTP-Faktoren und meldet
 *    überall ab (Supabase beendet die Sitzungen beim Löschen eines bestätigten Faktors). Nach dem
 *    nächsten Login wird neu eingerichtet. Alternativ setzt ein Owner zurück (resetStaffMfa).
 */

export interface MfaContext {
  user: User;
  staff: StaffRow;
  aal: "aal1" | "aal2" | null;
  verifiedFactorId: string | null;
}

/** Zustand für /admin/2fa: angemeldeter Auth-Benutzer, Staff-Zeile, AAL und bestätigter Faktor. */
export async function getMfaContext(): Promise<MfaContext | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const staff = await getStaffByUserId(user.id);
  if (!staff || !staff.is_active) return null;
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const verified = factors?.totp?.find((f) => f.status === "verified") ?? null;
  return {
    user,
    staff,
    aal: (aal?.currentLevel as "aal1" | "aal2" | null) ?? null,
    verifiedFactorId: verified?.id ?? null,
  };
}

const TOTP_ISSUER = "provibe Backoffice";

export interface EnrollmentData {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export type MfaFailure = "invalid_code" | "rate_limited" | "not_allowed" | "error";

async function limitedForUser(
  action: string,
  limit: number,
  windowSeconds: number,
  userId: string,
) {
  const r = await checkRateLimit({ action, limit, windowSeconds, identifier: userId });
  return !r.allowed;
}

/** Neuen TOTP-Faktor anlegen. Alte, nie bestätigte Faktoren werden vorher entfernt. */
export async function startEnrollment(
  ctx: MfaContext,
): Promise<EnrollmentData | { error: MfaFailure }> {
  if (ctx.verifiedFactorId) return { error: "not_allowed" };
  if (await limitedForUser("admin-mfa-enroll", 10, 3600, ctx.user.id))
    return { error: "rate_limited" };
  const supabase = await supabaseServer();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error)
        await supabaseAdmin().auth.admin.mfa.deleteFactor({ id: f.id, userId: ctx.user.id });
    }
  }
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: TOTP_ISSUER,
    friendlyName: `Authenticator ${stamp}`,
  });
  if (error || !data || data.type !== "totp") {
    console.error("[admin] MFA-Einrichtung fehlgeschlagen", error?.code ?? error?.message);
    return { error: "error" };
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/**
 * Client für Challenge und Verify: wie supabaseServer(), zusätzlich mit der IP der Person als
 * X-Forwarded-For. Supabase Auth merkt sich die IP der Challenge und lehnt ein Verify von einer
 * anderen IP ab (mfa_ip_address_mismatch). Ohne den Header zählt die ausgehende IP des Servers,
 * und die wechselt hinter Proxys und bei Netlify Functions zwischen zwei Aufrufen.
 */
async function mfaClient() {
  const cookieStore = await cookies();
  const h = await headers();
  const ip = clientIpFromHeaders((n) => h.get(n));
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
      },
    },
    global: ip !== "unbekannt" ? { headers: { "X-Forwarded-For": ip } } : undefined,
  });
}

/**
 * Supabase prüft, dass Challenge und Verify von derselben IP kommen. Serverseitig (Netlify Functions,
 * Proxys) kann die ausgehende IP zwischen zwei Aufrufen wechseln; dann wird mit neuer Challenge
 * wiederholt. Der Code bleibt innerhalb seines 30-Sekunden-Fensters gültig.
 */
async function challengeAndVerify(factorId: string, code: string) {
  const supabase = await mfaClient();
  let result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  for (
    let attempt = 1;
    attempt < 4 && result.error?.code === "mfa_ip_address_mismatch";
    attempt++
  ) {
    result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  }
  return result;
}

/**
 * Ersten Code prüfen. Bei Erfolg: Sitzung ist AAL2, neue Wiederherstellungscodes (alte verfallen).
 * Gibt die Codes im Klartext zurück, damit die Seite sie genau einmal anzeigt.
 */
export async function confirmEnrollment(
  ctx: MfaContext,
  factorId: string,
  code: string,
): Promise<{ codes: string[] } | { error: MfaFailure }> {
  if (await limitedForUser("admin-2fa", 10, 900, ctx.user.id)) return { error: "rate_limited" };
  // Nur eigene, noch unbestätigte Faktoren (die Sitzung prüft Supabase zusätzlich)
  const supabase = await supabaseServer();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.all?.find((f) => f.id === factorId && f.factor_type === "totp");
  if (!factor || factor.status === "verified") return { error: "not_allowed" };

  const { error } = await challengeAndVerify(factorId, code);
  if (error) return { error: error.status === 429 ? "rate_limited" : "invalid_code" };

  const codes = generateRecoveryCodes();
  const stored = await storeRecoveryCodes(ctx.user.id, codes);
  const actor = toStaffSession(ctx.staff, true);
  await writeAudit(actor, {
    action: "staff.mfa_enroll",
    entityType: "staff_user",
    entityId: ctx.user.id,
    after: { factor: "totp", recovery_codes: stored ? codes.length : 0 },
  });
  await touchLastLogin(ctx.user.id);
  return { codes: stored ? codes : [] };
}

/** Wiederherstellungscodes ersetzen. false, wenn die Tabelle fehlt (Migration nicht angewendet). */
export async function storeRecoveryCodes(userId: string, codes: string[]): Promise<boolean> {
  const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(c)));
  const db = untypedAdmin();
  const { error: delError } = await db.from("staff_recovery_codes").delete().eq("user_id", userId);
  if (delError) {
    console.error("[admin] staff_recovery_codes nicht erreichbar", delError.message);
    return false;
  }
  const { error } = await db
    .from("staff_recovery_codes")
    .insert(hashes.map((code_hash) => ({ user_id: userId, code_hash })));
  if (error) {
    console.error("[admin] Wiederherstellungscodes nicht gespeichert", error.message);
    return false;
  }
  return true;
}

/** Anzahl offener Wiederherstellungscodes (für die Benutzerliste und Hinweise). */
export async function countOpenRecoveryCodes(userId: string): Promise<number | null> {
  const { count, error } = await untypedAdmin()
    .from("staff_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);
  return error ? null : (count ?? 0);
}

/** Code bei jeder Anmeldung prüfen. */
export async function verifyTotp(
  ctx: MfaContext,
  code: string,
): Promise<{ ok: true } | { error: MfaFailure }> {
  if (!ctx.verifiedFactorId) return { error: "not_allowed" };
  if (await limitedForUser("admin-2fa", 10, 900, ctx.user.id)) return { error: "rate_limited" };
  const { error } = await challengeAndVerify(ctx.verifiedFactorId, code);
  if (error) {
    console.warn("[admin] TOTP abgelehnt", error.code ?? error.status);
    await writeAudit(toStaffSession(ctx.staff), {
      action: "staff.mfa_failed",
      entityType: "staff_user",
      entityId: ctx.user.id,
    });
    return { error: error.status === 429 ? "rate_limited" : "invalid_code" };
  }
  await writeAudit(toStaffSession(ctx.staff, true), {
    action: "staff.mfa_verify",
    entityType: "staff_user",
    entityId: ctx.user.id,
  });
  await touchLastLogin(ctx.user.id);
  return { ok: true };
}

/** Alle MFA-Faktoren eines Benutzers über die Admin-API löschen (beendet seine Sitzungen). */
async function deleteAllFactors(userId: string): Promise<number> {
  const admin = supabaseAdmin().auth.admin.mfa;
  const { data, error } = await admin.listFactors({ userId });
  if (error) throw new Error(`MFA-Faktoren nicht lesbar: ${error.message}`);
  let deleted = 0;
  for (const f of data?.factors ?? []) {
    if (f.factor_type === "recovery_code") continue;
    const { error: delError } = await admin.deleteFactor({ id: f.id, userId });
    if (delError) throw new Error(`MFA-Faktor nicht gelöscht: ${delError.message}`);
    deleted++;
  }
  return deleted;
}

/**
 * Wiederherstellungscode einlösen: Code wird verbraucht, TOTP-Faktoren gelöscht, Sitzungen beendet.
 * Die Person meldet sich danach neu an und richtet die Zwei-Faktor-Anmeldung neu ein.
 */
export async function redeemRecoveryCode(
  ctx: MfaContext,
  input: string,
): Promise<{ ok: true } | { error: MfaFailure }> {
  if (await limitedForUser("admin-recovery", 5, 3600, ctx.user.id))
    return { error: "rate_limited" };
  const db = untypedAdmin();
  const { data, error } = await db
    .from("staff_recovery_codes")
    .select("id, code_hash")
    .eq("user_id", ctx.user.id)
    .is("used_at", null);
  if (error) {
    console.error("[admin] staff_recovery_codes nicht lesbar", error.message);
    return { error: "error" };
  }
  const match = await findMatchingRecoveryCode(
    input,
    (data ?? []) as Pick<RecoveryCodeRow, "id" | "code_hash">[],
  );
  if (!match) {
    await writeAudit(toStaffSession(ctx.staff), {
      action: "staff.mfa_recovery_failed",
      entityType: "staff_user",
      entityId: ctx.user.id,
    });
    return { error: "invalid_code" };
  }
  const { data: used, error: useError } = await db
    .from("staff_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", match)
    .is("used_at", null)
    .select("id");
  if (useError || !used?.length) return { error: "invalid_code" };

  await writeAudit(toStaffSession(ctx.staff), {
    action: "staff.mfa_recovery_used",
    entityType: "staff_user",
    entityId: ctx.user.id,
  });
  try {
    await deleteAllFactors(ctx.user.id);
  } catch (e) {
    console.error("[admin] Faktoren nach Wiederherstellung nicht gelöscht", e);
    return { error: "error" };
  }
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope: "local" });
  return { ok: true };
}

/** Owner setzt die Zwei-Faktor-Anmeldung eines anderen Benutzers zurück (H15). */
export async function resetStaffMfa(
  actor: StaffSession,
  userId: string,
): Promise<{ deleted: number }> {
  const deleted = await deleteAllFactors(userId);
  const { error } = await untypedAdmin()
    .from("staff_recovery_codes")
    .delete()
    .eq("user_id", userId);
  if (error) console.error("[admin] Wiederherstellungscodes nicht gelöscht", error.message);
  await writeAudit(actor, {
    action: "staff.mfa_reset",
    entityType: "staff_user",
    entityId: userId,
    after: { factors_deleted: deleted },
  });
  return { deleted };
}
