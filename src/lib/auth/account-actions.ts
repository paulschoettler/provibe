"use server";

import { randomBytes } from "node:crypto";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env/public";
import { integrations } from "@/lib/integrations";
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  OPT_IN_TTL_DAYS,
  hashToken,
} from "@/lib/newsletter/consent";
import { RATE_LIMIT_MESSAGE, checkRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { kontoRpc } from "./db";
import { GENERIC_ERROR_MESSAGE, type AccountFormState } from "./form-state";
import { callbackUrl } from "./links";
import { sendAccountDeletedMail, sendNewsletterOptInMail } from "./mails";
import { requireCustomer } from "./session";
import {
  addressSchema,
  emailChangeSchema,
  fieldErrorsOf,
  formValues,
  profileSchema,
  setPasswordSchema,
} from "./validation";

/**
 * Server Actions der Kontoseiten. Jede Aktion prüft zuerst die Session (requireCustomer).
 * Schreibzugriffe auf Profil und Adressen laufen mit der Nutzer-Session, RLS und der Trigger
 * guard_customer_self_update begrenzen sie auf eigene Zeilen und erlaubte Spalten.
 */

function revalidateAccount() {
  revalidatePath("/account", "layout");
}

// --- Profil ------------------------------------------------------------------

export async function updateProfile(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const customer = await requireCustomer("/account/daten");
  const values = formValues(formData, ["firstName", "lastName", "phone"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüf deine Eingaben.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
    })
    .eq("id", customer.id);
  if (error) {
    console.error("[konto] Profil nicht gespeichert", error.message);
    return { status: "error", message: GENERIC_ERROR_MESSAGE, values };
  }
  revalidateAccount();
  return { status: "ok", message: "Gespeichert.", values };
}

// --- E-Mail ändern --------------------------------------------------------------

export async function requestEmailChange(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const customer = await requireCustomer("/account/daten");
  const values = formValues(formData, ["email"]);
  const parsed = emailChangeSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüf deine Eingabe.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const email = parsed.data.email;
  if (email === customer.email.toLowerCase()) {
    return {
      status: "error",
      message: "Das ist schon deine aktuelle Adresse.",
      fieldErrors: { email: "Das ist schon deine aktuelle Adresse." },
      values,
    };
  }
  const limit = await checkRateLimit({
    action: "email-change",
    limit: 3,
    windowSeconds: 3600,
    identifier: customer.id,
  });
  if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE, values };

  // Gehört die Adresse schon zu einem anderen Konto mit Login? Dann gar nicht erst anfragen.
  const { data: taken } = await supabaseAdmin()
    .from("customers")
    .select("id, auth_user_id")
    .eq("email", email)
    .maybeSingle();
  if (taken && taken.id !== customer.id && taken.auth_user_id) {
    return {
      status: "error",
      message:
        "Diese Adresse kannst du nicht verwenden. Schreib uns gern an hello@provibe-drinks.de.",
      fieldErrors: { email: "Diese Adresse kannst du nicht verwenden." },
      values,
    };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: callbackUrl("/account/daten?email=bestaetigt") },
  );
  if (error) {
    if (error.status === 429) return { status: "error", message: RATE_LIMIT_MESSAGE, values };
    console.error("[konto] E-Mail-Wechsel nicht angefragt", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR_MESSAGE, values };
  }
  revalidateAccount();
  return {
    status: "ok",
    message:
      "Fast geschafft. Wir haben dir Bestätigungslinks geschickt. Erst nach der Bestätigung gilt die neue Adresse.",
    values,
  };
}

// --- Passwort ------------------------------------------------------------------

export async function setPassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireCustomer("/account/daten");
  const parsed = setPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    passwordRepeat: String(formData.get("passwordRepeat") ?? ""),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüf deine Eingaben.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: "Dieses Passwort ist zu unsicher.",
        fieldErrors: {
          password:
            "Dieses Passwort ist zu unsicher oder taucht in bekannten Datenlecks auf. Bitte wähl ein anderes.",
        },
      };
    }
    if (error.code === "same_password") {
      return {
        status: "error",
        message: "Das ist schon dein aktuelles Passwort.",
        fieldErrors: { password: "Das ist schon dein aktuelles Passwort." },
      };
    }
    if (error.code === "reauthentication_needed") {
      return {
        status: "error",
        message:
          "Aus Sicherheitsgründen melde dich bitte kurz neu an (Magic Link) und setz das Passwort dann direkt danach.",
      };
    }
    console.error("[konto] Passwort nicht gesetzt", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
  return {
    status: "ok",
    message: "Dein Passwort ist gespeichert. Du kannst dich jetzt auch damit anmelden.",
  };
}

// --- Newsletter ------------------------------------------------------------------

export async function setNewsletter(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const customer = await requireCustomer("/account/daten");
  const wants = formData.get("newsletter") === "on";
  const db = supabaseAdmin();
  const email = customer.email.toLowerCase();

  try {
    const { data: contact } = await db
      .from("newsletter_contacts")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (!wants) {
      if (contact && contact.status !== "unsubscribed") {
        await db
          .from("newsletter_contacts")
          .update({
            status: "unsubscribed",
            unsubscribed_at: new Date().toISOString(),
            unsubscribe_reason: "konto",
            confirm_token_hash: null,
            customer_id: customer.id,
          })
          .eq("id", contact.id);
        try {
          await integrations().email.upsertContact({ email, unsubscribed: true });
        } catch (error) {
          console.error("[konto] Abmeldung beim Mailanbieter nicht übertragen", error);
        }
      }
      revalidateAccount();
      return { status: "ok", message: "Du bekommst keinen Newsletter mehr." };
    }

    if (contact?.status === "subscribed") {
      return { status: "ok", message: "Du bist schon angemeldet." };
    }
    const limit = await checkRateLimit({
      action: "newsletter-account",
      limit: 3,
      windowSeconds: 3600,
      identifier: customer.id,
    });
    if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE };

    // Double Opt-in auch im Konto: Nachweis der Einwilligung (DSGVO Art. 7, § 7 UWG)
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const { error } = await db.from("newsletter_contacts").upsert(
      {
        email,
        status: "pending",
        source: "account",
        customer_id: customer.id,
        first_name: customer.firstName,
        confirm_token_hash: hashToken(token),
        opt_in_sent_at: now,
        consent_text: CONSENT_TEXT,
        consent_version: CONSENT_VERSION,
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    );
    if (error) throw error;
    const confirmUrl = `${publicEnv.siteUrl}/newsletter/bestaetigen?token=${token}&email=${encodeURIComponent(email)}`;
    await sendNewsletterOptInMail(email, confirmUrl, OPT_IN_TTL_DAYS);
    revalidateAccount();
    return {
      status: "ok",
      message: "Fast geschafft! Bitte bestätige deine Anmeldung über den Link in deiner E-Mail.",
    };
  } catch (error) {
    console.error("[konto] Newsletter-Einstellung fehlgeschlagen", error);
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
}

// --- Konto löschen ----------------------------------------------------------------

export async function deleteAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const customer = await requireCustomer("/account/daten");
  const confirmText = String(formData.get("confirm") ?? "")
    .trim()
    .toUpperCase();
  const confirmed = formData.get("understood") === "on";
  if (confirmText !== "LÖSCHEN" || !confirmed) {
    const fieldErrors: Record<string, string> = {};
    if (confirmText !== "LÖSCHEN") fieldErrors.confirm = "Bitte tippe LÖSCHEN zur Bestätigung.";
    if (!confirmed) fieldErrors.understood = "Bitte bestätige, dass du die Folgen gelesen hast.";
    return { status: "error", message: "Bitte bestätige die Löschung.", fieldErrors };
  }

  const db = supabaseAdmin();
  const { data: running } = await db
    .from("subscriptions")
    .select("id")
    .eq("customer_id", customer.id)
    .in("status", ["active", "paused", "past_due"])
    .limit(1);
  if (running && running.length > 0) {
    return {
      status: "error",
      message:
        "Du hast noch ein laufendes Abo. Bitte kündige es zuerst, danach kannst du dein Konto löschen.",
    };
  }

  const oldEmail = customer.email;
  // 1. Login entfernen (danach kann sich niemand mehr mit dem Konto anmelden)
  const { error: deleteError } = await db.auth.admin.deleteUser(customer.authUserId);
  if (deleteError) {
    console.error("[konto] Auth-Benutzer nicht gelöscht", deleteError.message);
    return { status: "error", message: GENERIC_ERROR_MESSAGE };
  }
  // 2. Kunde pseudonymisieren, Bestellungen bleiben (Aufbewahrungspflicht AO/HGB)
  const { error: anonError } = await kontoRpc<null>("anonymize_customer", {
    p_customer_id: customer.id,
  });
  if (anonError) {
    // Login ist schon weg; Pseudonymisierung kann das Team im Backoffice nachholen
    console.error("[konto] Pseudonymisierung fehlgeschlagen", customer.id, anonError.message);
  }
  try {
    await sendAccountDeletedMail(oldEmail);
  } catch (error) {
    console.error("[konto] Löschbestätigung nicht verschickt", error);
  }

  // 3. Session-Cookies entfernen (der Benutzer existiert nicht mehr, signOut würde scheitern)
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name.startsWith("sb-")) store.delete(c.name);
  }
  revalidatePath("/", "layout");
  redirect("/account/login?geloescht=1" as Route);
}

// --- Adressen --------------------------------------------------------------------

const ADDRESS_KEYS = [
  "id",
  "label",
  "firstName",
  "lastName",
  "company",
  "street",
  "houseNumber",
  "addressAddition",
  "postalCode",
  "city",
  "countryCode",
  "phone",
] as const;

export async function saveAddress(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const customer = await requireCustomer("/account/adressen");
  const values = formValues(formData, ADDRESS_KEYS);
  const parsed = addressSchema.safeParse({
    ...values,
    isDefaultShipping: formData.get("isDefaultShipping") === "on",
    isDefaultBilling: formData.get("isDefaultBilling") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüf die markierten Felder.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values,
    };
  }
  const a = parsed.data;
  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("customer_addresses")
    .select("id", { count: "exact", head: true });
  if (!a.id && (count ?? 0) >= 20) {
    return { status: "error", message: "Du kannst höchstens 20 Adressen speichern.", values };
  }
  // Erste Adresse wird automatisch Standard
  const first = !a.id && (count ?? 0) === 0;
  const row = {
    customer_id: customer.id,
    label: a.label,
    first_name: a.firstName,
    last_name: a.lastName,
    company: a.company,
    street: a.street,
    house_number: a.houseNumber,
    address_addition: a.addressAddition,
    postal_code: a.postalCode,
    city: a.city,
    country_code: a.countryCode,
    phone: a.phone,
    is_default_shipping: a.isDefaultShipping || first,
    is_default_billing: a.isDefaultBilling || first,
  };

  const result = a.id
    ? await supabase
        .from("customer_addresses")
        .update(row)
        .eq("id", a.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("customer_addresses").insert(row).select("id").single();
  if (result.error || !result.data) {
    console.error("[konto] Adresse nicht gespeichert", result.error?.message);
    return { status: "error", message: GENERIC_ERROR_MESSAGE, values };
  }
  await clearOtherDefaults(result.data.id, row.is_default_shipping, row.is_default_billing);
  revalidatePath("/account/adressen");
  revalidatePath("/account");
  redirect("/account/adressen?gespeichert=1" as Route);
}

async function clearOtherDefaults(keepId: string, shipping: boolean, billing: boolean) {
  const supabase = await supabaseServer();
  if (shipping) {
    await supabase
      .from("customer_addresses")
      .update({ is_default_shipping: false })
      .neq("id", keepId)
      .eq("is_default_shipping", true);
  }
  if (billing) {
    await supabase
      .from("customer_addresses")
      .update({ is_default_billing: false })
      .neq("id", keepId)
      .eq("is_default_billing", true);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteAddress(formData: FormData): Promise<void> {
  await requireCustomer("/account/adressen");
  const id = String(formData.get("id") ?? "");
  if (uuidPattern.test(id)) {
    const supabase = await supabaseServer();
    // RLS begrenzt auf eigene Adressen, das WHERE auf genau diese ID
    await supabase.from("customer_addresses").delete().eq("id", id);
  }
  revalidatePath("/account/adressen");
  redirect("/account/adressen?geloescht=1" as Route);
}

export async function setDefaultAddress(formData: FormData): Promise<void> {
  await requireCustomer("/account/adressen");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "shipping");
  if (uuidPattern.test(id)) {
    const supabase = await supabaseServer();
    const shipping = kind === "shipping" || kind === "both";
    const billing = kind === "billing" || kind === "both";
    const update: { is_default_shipping?: boolean; is_default_billing?: boolean } = {};
    if (shipping) update.is_default_shipping = true;
    if (billing) update.is_default_billing = true;
    const { error } = await supabase.from("customer_addresses").update(update).eq("id", id);
    if (!error) await clearOtherDefaults(id, shipping, billing);
  }
  revalidatePath("/account/adressen");
  redirect("/account/adressen?gespeichert=1" as Route);
}
