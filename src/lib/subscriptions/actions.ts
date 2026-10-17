"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/auth/session";
import { splitStreet } from "@/lib/checkout/snapshot";
import type { StoredAddress } from "@/lib/checkout/types";
import { integrations } from "@/lib/integrations";
import type { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { storePaymentMethod } from "./checkout-hook";
import { loadSubscribableProducts } from "./catalog";
import { loadSubscriptionRow, SubscriptionConflictError } from "./db";
import { confirmPendingPayment } from "./renewal";
import { variantForFlavor } from "./data";
import {
  cancel,
  changeAddress,
  pause,
  resume,
  setPaymentMethod,
  setSkipNext,
  SubscriptionActionError,
  updatePlan,
  type Actor,
} from "./service";
import { checkSetupTestCard } from "./test-cards";
import { CANCEL_REASONS, type AboFormState, type SubscriptionRow } from "./types";
import { berlinDay, pauseSuggestions } from "./schedule";
import { loadSubscriptionSettings } from "./settings";

/**
 * Server Actions des Abo-Portals (/account/abo/[id]). Jede Aktion prüft Session und Besitz,
 * validiert mit Zod und schreibt über die Service-Funktionen (Zustandsmaschine, atomar).
 * Ohne JavaScript: normales Formular-Submit, Erfolg leitet mit Hinweis auf die Detailseite.
 */

const idSchema = z.string().uuid();

function detailPath(id: string, hint?: string): Route {
  return `/account/abo/${id}${hint ? `?hinweis=${hint}` : ""}` as Route;
}

async function ownedSubscription(rawId: FormDataEntryValue | null): Promise<{
  row: SubscriptionRow;
  actor: Actor;
  customerId: string;
}> {
  const id = idSchema.safeParse(String(rawId ?? ""));
  if (!id.success) redirect("/account/abo" as Route);
  const customer = await requireCustomer(`/account/abo/${id.data}`);
  const row = await loadSubscriptionRow(id.data);
  if (!row || row.customer_id !== customer.id || row.status === "draft") {
    redirect("/account/abo" as Route);
  }
  return { row, actor: { type: "customer", id: customer.authUserId }, customerId: customer.id };
}

function errorState(error: unknown, values?: Record<string, string>): AboFormState {
  if (error instanceof SubscriptionActionError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      values,
    };
  }
  if (error instanceof SubscriptionConflictError) {
    return { status: "error", message: error.message, values };
  }
  console.error("[abo] Aktion fehlgeschlagen", error);
  return {
    status: "error",
    message: "Das hat leider nicht geklappt. Bitte versuch es gleich noch einmal.",
    values,
  };
}

function done(id: string, hint: string): never {
  revalidatePath("/account/abo");
  revalidatePath(`/account/abo/${id}`);
  redirect(detailPath(id, hint));
}

/* ---------- Sorte, Packgröße, Intervall ---------- */

const planSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid("Bitte wähl eine Packgröße."),
  intervalWeeks: z.coerce.number().int().min(1).max(52),
  quantity: z.coerce.number().int().min(1).max(48).optional(),
});

export async function savePlanAction(
  _prev: AboFormState,
  formData: FormData,
): Promise<AboFormState> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  const parsed = planSchema.safeParse({
    productId: formData.get("productId") || undefined,
    variantId: formData.get("variantId"),
    intervalWeeks: formData.get("intervalWeeks"),
    quantity: formData.get("quantity") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Bitte prüf deine Auswahl.",
    };
  }
  try {
    let variantId = parsed.data.variantId;
    if (parsed.data.productId) {
      // Sortenwechsel: gleiche Packgröße in der gewählten Sorte
      const flavors = await loadSubscribableProducts();
      const pack = flavors.flatMap((p) => p.variants).find((v) => v.id === variantId);
      const mapped = pack ? variantForFlavor(flavors, parsed.data.productId, pack.unitCount) : null;
      if (mapped) variantId = mapped;
    }
    await updatePlan(
      row,
      { variantId, intervalWeeks: parsed.data.intervalWeeks, quantity: parsed.data.quantity },
      actor,
    );
  } catch (error) {
    return errorState(error);
  }
  done(row.id, "gespeichert");
}

/* ---------- Überspringen ---------- */

export async function skipAction(formData: FormData): Promise<void> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  const skip = formData.get("skip") !== "0";
  try {
    await setSkipNext(row, skip, actor);
  } catch (error) {
    const state = errorState(error);
    redirect(`${detailPath(row.id)}?fehler=${encodeURIComponent(state.message ?? "")}` as Route);
  }
  done(row.id, skip ? "uebersprungen" : "nicht-uebersprungen");
}

/* ---------- Pausieren und Fortsetzen ---------- */

export async function pauseAction(_prev: AboFormState, formData: FormData): Promise<AboFormState> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  const option = String(formData.get("option") ?? "");
  const values = { option, until: String(formData.get("until") ?? "") };
  let day = values.until;
  if (/^\d+$/.test(option)) {
    const settings = await loadSubscriptionSettings();
    const next = row.next_order_at ? new Date(row.next_order_at) : null;
    const suggestion = pauseSuggestions(next, new Date(), settings.pauseMaxDays).find(
      (s) => s.weeks === Number(option),
    );
    if (!suggestion) return { status: "error", message: "Bitte wähl eine Dauer.", values };
    day = suggestion.day;
  } else if (option !== "date") {
    return { status: "error", message: "Bitte wähl eine Dauer.", values };
  }
  try {
    await pause(row, day, actor);
  } catch (error) {
    return errorState(error, values);
  }
  done(row.id, "pausiert");
}

export async function resumeAction(formData: FormData): Promise<void> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  let hint = "fortgesetzt";
  try {
    const result = await resume(row, actor);
    if (result.charge === "declined" || result.charge === "paused_after_failures")
      hint = "zahlung-abgelehnt";
    else if (result.charge === "ordered") hint = "bezahlt";
  } catch (error) {
    const state = errorState(error);
    redirect(`${detailPath(row.id)}?fehler=${encodeURIComponent(state.message ?? "")}` as Route);
  }
  done(row.id, hint);
}

/* ---------- Kündigen (Portal: ab sofort keine weiteren Lieferungen) ---------- */

const reasonIds = CANCEL_REASONS.map((r) => r.id) as [string, ...string[]];

export async function cancelAction(_prev: AboFormState, formData: FormData): Promise<AboFormState> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  const reason = z
    .enum(reasonIds)
    .optional()
    .safeParse(formData.get("reason") || undefined);
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 1000);
  try {
    await cancel(
      row,
      {
        kind: "ordinary",
        timing: "next_possible",
        reason: reason.success
          ? (CANCEL_REASONS.find((r) => r.id === reason.data)?.label ?? null)
          : null,
        note: note || null,
        sendMail: true,
      },
      actor,
    );
  } catch (error) {
    return errorState(error, { note });
  }
  done(row.id, "gekuendigt");
}

/* ---------- Lieferadresse ---------- */

const text = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, "Das ist zu lang.");
const addressSchema = z.object({
  firstName: text(80, "Bitte gib deinen Vornamen an."),
  lastName: text(80, "Bitte gib deinen Nachnamen an."),
  street: text(120, "Bitte gib Straße und Hausnummer an.").refine(
    (v) => /\d/.test(v),
    "Bitte ergänze die Hausnummer.",
  ),
  addressAddition: z.string().trim().max(80, "Das ist zu lang."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Bitte gib eine fünfstellige Postleitzahl an."),
  city: text(80, "Bitte gib den Ort an."),
});

export async function addressAction(
  _prev: AboFormState,
  formData: FormData,
): Promise<AboFormState> {
  const { row, actor } = await ownedSubscription(formData.get("id"));
  const values = Object.fromEntries(
    ["firstName", "lastName", "street", "addressAddition", "postalCode", "city"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Bitte prüf die markierten Felder.", fieldErrors, values };
  }
  const { street, houseNumber } = splitStreet(parsed.data.street);
  const address: StoredAddress = {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    company: null,
    street,
    house_number: houseNumber,
    address_addition: parsed.data.addressAddition || null,
    postal_code: parsed.data.postalCode,
    city: parsed.data.city,
    country_code: "DE",
    phone: null,
  };
  try {
    await changeAddress(row, address, actor);
  } catch (error) {
    return errorState(error, values);
  }
  done(row.id, "adresse");
}

/* ---------- Zahlungsmittel wechseln ---------- */

/**
 * Mock (APP_INTEGRATIONS=mock): SetupIntent anlegen und mit einer Testkarte bestätigen, alles
 * serverseitig. Live: siehe startSetupAction und finishSetup (Stripe Payment Element im Browser).
 */
export async function mockPaymentMethodAction(
  _prev: AboFormState,
  formData: FormData,
): Promise<AboFormState> {
  const { row, actor, customerId } = await ownedSubscription(formData.get("id"));
  const values = {
    method: String(formData.get("method") ?? "card"),
    cardNumber: String(formData.get("cardNumber") ?? ""),
    cardExpiry: String(formData.get("cardExpiry") ?? ""),
  };
  const payments = integrations().payments;
  if (payments.name !== "mock") {
    return { status: "error", message: "Bitte lade die Seite neu.", values };
  }
  const limit = await checkRateLimit({
    action: "abo-payment-method",
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE, values };

  const mock = payments as MockPaymentProvider;
  let method;
  if (values.method === "paypal") {
    method = mock.createTestPaymentMethod({ type: "paypal" });
  } else {
    const card = checkSetupTestCard({
      number: values.cardNumber,
      expiry: values.cardExpiry,
      cvc: String(formData.get("cardCvc") ?? ""),
    });
    if (!card.ok) {
      return {
        status: "error",
        message: card.message,
        fieldErrors: { [card.field]: card.message },
        values,
      };
    }
    method = mock.createTestPaymentMethod({
      type: "card",
      last4: card.last4,
      brand: card.brand,
      expMonth: card.expMonth,
      expYear: card.expYear,
    });
  }
  let hint = "zahlungsmittel";
  try {
    const customer = (await requireCustomer(`/account/abo/${row.id}`)).email;
    const providerCustomerId =
      row.stripe_customer_id ?? (await payments.ensureCustomer({ email: customer })).id;
    const setup = await payments.createSetupIntent({
      providerCustomerId,
      metadata: { subscription_id: row.id },
      idempotencyKey: `abo-setup:${row.id}:${method.id}`,
    });
    mock.completeTestSetup(setup.id, method);
    const stored = await storePaymentMethod(customerId, providerCustomerId, method);
    const result = await setPaymentMethod(row, stored, actor);
    if (result.charge === "ordered") hint = "bezahlt";
    else if (result.charge === "declined" || result.charge === "paused_after_failures")
      hint = "zahlung-abgelehnt";
    else if (result.charge === "action_required") hint = "bestaetigung-noetig";
  } catch (error) {
    return errorState(error, values);
  }
  done(row.id, hint);
}

/** Live: SetupIntent für das Stripe Payment Element anlegen, gibt das client_secret zurück. */
export async function startSetupAction(
  formData: FormData,
): Promise<{ ok: true; clientSecret: string; returnUrl: string } | { ok: false; message: string }> {
  const { row } = await ownedSubscription(formData.get("id"));
  const customer = await requireCustomer(`/account/abo/${row.id}`);
  const payments = integrations().payments;
  const limit = await checkRateLimit({
    action: "abo-payment-method",
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE };
  try {
    const providerCustomerId =
      row.stripe_customer_id ?? (await payments.ensureCustomer({ email: customer.email })).id;
    const setup = await payments.createSetupIntent({
      providerCustomerId,
      metadata: { subscription_id: row.id, customer_id: customer.id },
      idempotencyKey: `abo-setup:${row.id}:${berlinDay(new Date())}:${crypto.randomUUID()}`,
    });
    return {
      ok: true,
      clientSecret: setup.clientSecret,
      returnUrl: `/account/abo/${row.id}/zahlungsmittel`,
    };
  } catch (error) {
    console.error("[abo] SetupIntent nicht angelegt", error);
    return { ok: false, message: "Das Zahlungsmittel kann gerade nicht geändert werden." };
  }
}

/* ---------- Offene Zahlung bestätigen (3-D Secure) ---------- */

export async function confirmPaymentAction(formData: FormData): Promise<{
  status: "confirmed" | "client_action" | "nothing_pending" | "error";
  clientSecret?: string;
}> {
  const { row } = await ownedSubscription(formData.get("id"));
  try {
    const result = await confirmPendingPayment(row);
    if (result.status === "confirmed") {
      revalidatePath(`/account/abo/${row.id}`);
      revalidatePath("/account/abo");
    }
    return result.status === "client_action"
      ? { status: "client_action", clientSecret: result.clientSecret }
      : { status: result.status };
  } catch (error) {
    console.error("[abo] Bestätigung fehlgeschlagen", error);
    return { status: "error" };
  }
}

/** Formular-Variante ohne JavaScript (Mock): bestätigt und leitet zurück. */
export async function confirmPaymentFormAction(formData: FormData): Promise<void> {
  const result = await confirmPaymentAction(formData);
  const id = String(formData.get("id") ?? "");
  if (result.status === "confirmed") done(id, "bezahlt");
  redirect(detailPath(id, result.status === "client_action" ? "bestaetigung-noetig" : "fehler"));
}
