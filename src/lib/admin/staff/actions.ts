"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  actionError,
  actionOk,
  fieldErrorsOf,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { sendStaffMagicLink, signInStaffWithPassword, signOutStaff } from "./login";
import {
  confirmEnrollment,
  getMfaContext,
  redeemRecoveryCode,
  startEnrollment,
  verifyTotp,
} from "./mfa";
import { adminTwoFactorUrl, safeAdminNext } from "./redirect";

/**
 * Server Actions für Login, Magic Link, Zwei-Faktor und Abmelden. Alle Formulare funktionieren
 * ohne JavaScript (useActionState). Meldungen sind neutral, damit niemand Staff-Adressen erraten kann.
 */

const NEUTRAL_LOGIN_ERROR =
  "E-Mail oder Passwort stimmt nicht. Prüfe deine Eingabe oder fordere einen Magic Link an.";
const LINK_SENT =
  "Wenn die Adresse Zugang zum Backoffice hat, ist der Anmeldelink unterwegs. Er funktioniert einmal und läuft nach kurzer Zeit ab.";
const GENERIC_ERROR =
  "Das hat gerade nicht geklappt. Bitte versuch es in ein paar Minuten noch einmal.";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte gib eine gültige E-Mail-Adresse ein.")
  .max(254);

const passwordSchema = z.object({
  email,
  password: z.string().min(1, "Bitte gib dein Passwort ein.").max(200),
  next: z.string().max(512).optional(),
});

export async function loginWithPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return actionError("Bitte prüf deine Eingaben.", {
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    });
  }
  const result = await signInStaffWithPassword(parsed.data.email, parsed.data.password);
  if (result.status === "rate_limited") return actionError(RATE_LIMIT_MESSAGE, { values });
  if (result.status === "error") return actionError(GENERIC_ERROR, { values });
  if (result.status === "invalid") {
    return actionError(NEUTRAL_LOGIN_ERROR, {
      values,
      fieldErrors: { password: "Passwort prüfen" },
    });
  }
  redirect(adminTwoFactorUrl(parsed.data.next) as Route);
}

const magicSchema = z.object({ email, next: z.string().max(512).optional() });

export async function requestMagicLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = magicSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return actionError("Für den Magic Link brauchen wir deine E-Mail-Adresse.", {
      fieldErrors: {
        email: fieldErrorsOf(parsed.error).email ?? "Bitte gib deine E-Mail-Adresse ein.",
      },
      values,
    });
  }
  const result = await sendStaffMagicLink(parsed.data.email, parsed.data.next);
  if (result === "rate_limited") return actionError(RATE_LIMIT_MESSAGE, { values });
  if (result === "error") return actionError(GENERIC_ERROR, { values });
  return actionOk(LINK_SENT, { magic: true });
}

/**
 * Ein Formular, zwei Wege (Figma 27:4372): "Anmelden" schickt intent=password, "Magic Link senden"
 * intent=magic. So funktioniert beides auch ohne JavaScript mit nur einer Server Action.
 */
export async function loginAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  return formData.get("intent") === "magic"
    ? requestMagicLinkAction(prev, formData)
    : loginWithPasswordAction(prev, formData);
}

/* --- Zwei-Faktor ------------------------------------------------------------------------------ */

/** Sechs Ziffern aus code oder d1 bis d6 (einzelne Kästchen) */
function readCode(formData: FormData): string | null {
  const direct = String(formData.get("code") ?? "").replace(/\s/g, "");
  const parts = [1, 2, 3, 4, 5, 6].map((i) => String(formData.get(`d${i}`) ?? "").trim()).join("");
  const code = direct || parts;
  return /^\d{6}$/.test(code) ? code : null;
}

const ENROLLED_COOKIE = "pv_admin_mfa_neu";

async function clearEnrolledMarker() {
  (await cookies()).delete({ name: ENROLLED_COOKIE, path: "/admin/2fa" });
}

const MFA_MESSAGES = {
  invalid_code: "Der Code ist ungültig oder abgelaufen. Gib den aktuellen Code aus der App ein.",
  rate_limited: RATE_LIMIT_MESSAGE,
  not_allowed:
    "Diese Einrichtung ist nicht mehr gültig. Lade die Seite neu und starte noch einmal.",
  error: GENERIC_ERROR,
} as const;

export async function startEnrollmentAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const ctx = await getMfaContext();
  if (!ctx) redirect("/admin/login");
  const result = await startEnrollment(ctx);
  if ("error" in result) return actionError(MFA_MESSAGES[result.error]);
  return actionOk(undefined, { step: "scan", ...result });
}

export async function confirmEnrollmentAction(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getMfaContext();
  if (!ctx) redirect("/admin/login");
  const factorId = z.string().uuid().safeParse(formData.get("factorId"));
  // QR-Code und Geheimnis bleiben bei einem Fehler sichtbar (aus dem vorherigen Zustand)
  const keep = prev.data && prev.data.step === "scan" ? prev.data : undefined;
  if (!factorId.success) return { status: "error", message: MFA_MESSAGES.not_allowed };
  const code = readCode(formData);
  if (!code) {
    return {
      status: "error",
      message: "Bitte gib die sechs Ziffern aus der App ein.",
      data: keep,
      fieldErrors: { code: "Sechs Ziffern" },
    };
  }
  const result = await confirmEnrollment(ctx, factorId.data, code);
  if ("error" in result)
    return {
      status: "error",
      message: MFA_MESSAGES[result.error],
      data: keep,
      fieldErrors: { code: "Code prüfen" },
    };
  // Die Sitzung ist jetzt AAL2 und die Seite wird neu gerendert. Ohne diese Markierung würde
  // /admin/2fa sofort weiterleiten, bevor die Wiederherstellungscodes zu sehen sind.
  (await cookies()).set(ENROLLED_COOKIE, "1", {
    path: "/admin/2fa",
    maxAge: 600,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return actionOk(undefined, {
    step: "codes",
    codes: result.codes,
    next: safeAdminNext(formData.get("next")),
  });
}

export async function verifyTotpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getMfaContext();
  if (!ctx) redirect("/admin/login");
  const code = readCode(formData);
  if (!code)
    return actionError("Bitte gib die sechs Ziffern aus der App ein.", {
      fieldErrors: { code: "Sechs Ziffern" },
    });
  const result = await verifyTotp(ctx, code);
  if ("error" in result)
    return actionError(MFA_MESSAGES[result.error], { fieldErrors: { code: "Code prüfen" } });
  await clearEnrolledMarker();
  redirect(safeAdminNext(formData.get("next")) as Route);
}

export async function redeemRecoveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getMfaContext();
  if (!ctx) redirect("/admin/login");
  const input = String(formData.get("recovery") ?? "").slice(0, 40);
  if (!input.trim()) {
    return actionError("Bitte gib einen Wiederherstellungscode ein.", {
      fieldErrors: { recovery: "Code fehlt" },
    });
  }
  const result = await redeemRecoveryCode(ctx, input);
  if ("error" in result) {
    const message =
      result.error === "invalid_code"
        ? "Dieser Code ist ungültig oder wurde schon verwendet."
        : MFA_MESSAGES[result.error];
    return actionError(message, { fieldErrors: { recovery: "Code prüfen" } });
  }
  redirect("/admin/login?hinweis=neu-einrichten");
}

/** "Weiter zum Backoffice" nach dem Sichern der Wiederherstellungscodes */
export async function finishEnrollmentAction(formData: FormData): Promise<void> {
  await clearEnrolledMarker();
  redirect(safeAdminNext(formData.get("next")) as Route);
}

/* --- Abmelden --------------------------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  await signOutStaff();
  await clearEnrolledMarker();
  redirect("/admin/login?abgemeldet=1");
}
