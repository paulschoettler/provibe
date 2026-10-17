"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RATE_LIMIT_MESSAGE, checkRateLimit } from "@/lib/security/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";
import { GENERIC_ERROR_MESSAGE, LINK_SENT_MESSAGE, type AccountFormState } from "./form-state";
import { callbackUrl, sendLoginLink } from "./links";
import { detachCustomerCart, mergeGuestCart } from "./merge-cart";
import { safeNextPath } from "./redirect";
import { ensureCustomerForUser } from "./session";
import {
  emailSchema,
  fieldErrorsOf,
  magicLinkSchema,
  passwordLoginSchema,
  registerSchema,
} from "./validation";

/**
 * Server Actions für Login, Registrierung, Aktivierung und Logout.
 * Alle Formulare funktionieren ohne JavaScript (useActionState mit Progressive Enhancement).
 * Meldungen nach Linkanfragen sind neutral, damit niemand testen kann, welche Adressen ein Konto haben.
 */

const FIFTEEN_MINUTES = 15 * 60;

async function limited(action: string, limit: number, identifier?: string): Promise<boolean> {
  const result = await checkRateLimit({
    action,
    limit,
    windowSeconds: FIFTEEN_MINUTES,
    identifier,
  });
  return !result.allowed;
}

/** Je IP und je Adresse begrenzen, damit weder Postfächer geflutet noch Konten durchprobiert werden. */
async function linkRequestLimited(kind: "magic-link" | "activate", email: string) {
  return (await limited(`${kind}-ip`, 10)) || (await limited(`${kind}-mail`, 3, email));
}

async function handleLinkRequest(
  kind: "magic-link" | "activate",
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = magicLinkSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    next: String(formData.get("next") ?? ""),
    website: String(formData.get("website") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    if (fieldErrors.website) return { status: "ok", message: LINK_SENT_MESSAGE, email: "" };
    return {
      status: "error",
      message: fieldErrors.email ?? "Bitte prüf deine Eingabe.",
      fieldErrors,
      values: { email: String(formData.get("email") ?? "") },
    };
  }
  const { email, next } = parsed.data;
  if (await linkRequestLimited(kind, email)) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: { email } };
  }

  const result = await sendLoginLink(email, next);
  if (result === "rate_limited") {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: { email } };
  }
  if (result === "error") {
    return { status: "error", message: GENERIC_ERROR_MESSAGE, values: { email } };
  }
  return { status: "ok", message: LINK_SENT_MESSAGE, email };
}

/** Magic Link anfordern (Tab "Magic Link" auf /account/login) */
export async function requestMagicLink(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return handleLinkRequest("magic-link", formData);
}

/** Aktivierungslink für Shopify-Bestandskunden (/account/konto-aktivieren) */
export async function requestActivation(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  return handleLinkRequest("activate", formData);
}

/** Login mit Passwort (Tab "Passwort") */
export async function loginWithPassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = passwordLoginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? ""),
    website: String(formData.get("website") ?? ""),
  });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      status: "error",
      message: fieldErrors.website ? GENERIC_ERROR_MESSAGE : "Bitte prüf deine Eingaben.",
      fieldErrors,
      values,
    };
  }
  const { email, password, next } = parsed.data;
  if ((await limited("login-ip", 20)) || (await limited("login-mail", 8, email))) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") {
      return {
        status: "error",
        message:
          "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in unserer Mail. Oder melde dich per Magic Link an.",
        values,
      };
    }
    return {
      status: "error",
      message: "E-Mail oder Passwort stimmen nicht. Du kannst dich auch per Magic Link anmelden.",
      fieldErrors: { password: "E-Mail oder Passwort stimmen nicht." },
      values,
    };
  }

  const customerId = await ensureCustomerForUser(data.user);
  if (customerId) await mergeGuestCart(customerId, email);
  revalidatePath("/account", "layout");
  redirect(safeNextPath(next) as Route);
}

/** Konto mit Passwort anlegen (optional, Standard ist der Magic Link) */
export async function registerWithPassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = registerSchema.safeParse({
    email: values.email,
    password: String(formData.get("password") ?? ""),
    passwordRepeat: String(formData.get("passwordRepeat") ?? ""),
    website: String(formData.get("website") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    if (fieldErrors.website) return { status: "ok", message: LINK_SENT_MESSAGE, email: "" };
    return { status: "error", message: "Bitte prüf deine Eingaben.", fieldErrors, values };
  }
  const { email, password } = parsed.data;
  if ((await limited("register-ip", 5)) || (await limited("register-mail", 3, email))) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl("/account") },
  });
  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: "Dieses Passwort ist zu unsicher.",
        fieldErrors: {
          password:
            "Dieses Passwort ist zu unsicher oder taucht in bekannten Datenlecks auf. Bitte wähl ein anderes.",
        },
        values,
      };
    }
    if (error.status === 429) return { status: "error", message: RATE_LIMIT_MESSAGE, values };
    if (error.code !== "user_already_exists") {
      console.error("[auth] Registrierung fehlgeschlagen", error.code, error.message);
      return { status: "error", message: GENERIC_ERROR_MESSAGE, values };
    }
  }
  // Auch bei bestehender Adresse dieselbe Meldung (kein Hinweis auf vorhandene Konten)
  return {
    status: "ok",
    message: "Fast geschafft. Bitte bestätige deine Adresse über den Link in deiner E-Mail.",
    email,
  };
}

/** Passwort vergessen: Supabase schickt einen Link, danach setzt man in /account/daten ein neues */
export async function requestPasswordReset(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Bitte prüf deine Eingabe.",
      fieldErrors: { email: parsed.error.issues[0]?.message ?? "" },
    };
  }
  const email = parsed.data;
  if (await linkRequestLimited("magic-link", email)) {
    return { status: "error", message: RATE_LIMIT_MESSAGE, values: { email } };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/account/daten?passwort=neu"),
  });
  if (error && error.status !== 429) {
    console.error("[auth] Passwort-Reset nicht verschickt", error.code, error.message);
  }
  return { status: "ok", message: LINK_SENT_MESSAGE, email };
}

async function signOutWithScope(scope: "local" | "global") {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut({ scope });
  } catch (error) {
    console.error("[auth] Logout fehlgeschlagen", error);
  }
  await detachCustomerCart();
  revalidatePath("/", "layout");
  redirect("/account/login?abgemeldet=1" as Route);
}

/** Abmelden auf diesem Gerät */
export async function signOut(): Promise<void> {
  await signOutWithScope("local");
}

/** Auf allen Geräten abmelden (alle Refresh-Tokens werden ungültig) */
export async function signOutEverywhere(): Promise<void> {
  await signOutWithScope("global");
}
