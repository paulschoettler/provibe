"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { integrations } from "@/lib/integrations";
import type { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { buildCheckoutEvent, emitTrackingEvent } from "@/lib/tracking/events";
import { asJson, checkoutDb } from "./db";
import { DISCOUNT_MESSAGES, findDiscountByCode, setCartDiscount, toRule } from "./discount";
import { processPaymentEvent, type PaymentDetails } from "./finalize";
import { currentLegalVersions, legalVersionsSnapshot } from "./legal";
import { preparePayment } from "./payment";
import { loadCheckoutState, saveSessionDetails, type CheckoutState } from "./session";
import { buildAmountsSnapshot, hasSubscriptionLines, splitStreet } from "./snapshot";
import { checkTestCard } from "./test-cards";
import { PAYMENT_METHODS, type FormState, type StoredAddress } from "./types";

/**
 * Server Actions des Checkouts. Alle funktionieren ohne JavaScript (Formular-Submit mit Redirect
 * oder neu gerenderter Seite) und mit JavaScript über useActionState ohne Seitenwechsel.
 * Der Client schickt nur Eingaben; jeder Betrag wird hier aus der Datenbank neu gerechnet.
 */

const ROUTE = (path: string) => path as Route;

/* ---------- Schritt 1: Kontakt, Adresse, Versand ---------- */

const text = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, "Das ist zu lang.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Das ist zu lang.")
    .transform((v) => (v.length > 0 ? v : null));

const addressSchema = z.object({
  firstName: text(80, "Bitte gib deinen Vornamen an."),
  lastName: text(80, "Bitte gib deinen Nachnamen an."),
  street: text(120, "Bitte gib Straße und Hausnummer an.").refine(
    (v) => /\d/.test(v),
    "Bitte ergänze die Hausnummer.",
  ),
  addressAddition: optionalText(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Bitte gib eine fünfstellige Postleitzahl an."),
  city: text(80, "Bitte gib den Ort an."),
});

const detailsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  phone: z
    .string()
    .trim()
    .max(30, "Das ist zu lang.")
    .refine((v) => v === "" || /^[+\d][\d\s()/-]{5,}$/.test(v), "Bitte prüf die Telefonnummer.")
    .transform((v) => (v.length > 0 ? v : null)),
  shippingRateId: z.string().uuid("Bitte wähl eine Versandart."),
  billingDifferent: z.boolean(),
  website: z.string().max(0).optional(),
});

const FIELDS = [
  "email",
  "firstName",
  "lastName",
  "street",
  "addressAddition",
  "postalCode",
  "city",
  "phone",
  "shippingRateId",
  "billingDifferent",
  "billingFirstName",
  "billingLastName",
  "billingStreet",
  "billingAddressAddition",
  "billingPostalCode",
  "billingCity",
] as const;

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of FIELDS) values[key] = String(formData.get(key) ?? "");
  return values;
}

function toAddress(a: z.infer<typeof addressSchema>, phone: string | null): StoredAddress {
  const { street, houseNumber } = splitStreet(a.street);
  return {
    first_name: a.firstName,
    last_name: a.lastName,
    company: null,
    street,
    house_number: houseNumber,
    address_addition: a.addressAddition,
    postal_code: a.postalCode,
    city: a.city,
    country_code: "DE",
    phone,
  };
}

function collectErrors(target: Record<string, string>, error: z.ZodError, prefix = ""): void {
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    const name = prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;
    if (!target[name]) target[name] = issue.message;
  }
}

export async function saveDetailsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const billingDifferent = values.billingDifferent === "on" || values.billingDifferent === "1";
  const fieldErrors: Record<string, string> = {};

  const details = detailsSchema.safeParse({
    email: values.email,
    phone: values.phone,
    shippingRateId: values.shippingRateId,
    billingDifferent,
    website: String(formData.get("website") ?? ""),
  });
  if (!details.success) collectErrors(fieldErrors, details.error);

  const shipping = addressSchema.safeParse(values);
  if (!shipping.success) collectErrors(fieldErrors, shipping.error);

  const billing = billingDifferent
    ? addressSchema.safeParse({
        firstName: values.billingFirstName,
        lastName: values.billingLastName,
        street: values.billingStreet,
        addressAddition: values.billingAddressAddition,
        postalCode: values.billingPostalCode,
        city: values.billingCity,
      })
    : null;
  if (billing && !billing.success) collectErrors(fieldErrors, billing.error, "billing");

  if (!details.success || !shipping.success || (billing && !billing.success)) {
    return {
      status: "error",
      message: "Bitte prüf die markierten Felder.",
      fieldErrors,
      values,
    };
  }
  if (details.data.website) redirect(ROUTE("/checkout")); // Honeypot: still ins Leere

  const state = await loadCheckoutState({
    shippingRateId: details.data.shippingRateId,
    email: details.data.email,
  });
  if (!state) redirect(ROUTE("/cart"));
  const rate = state.shippingRates.find((r) => r.id === details.data.shippingRateId);
  if (!rate) {
    return {
      status: "error",
      message: "Diese Versandart ist nicht verfügbar.",
      fieldErrors: { shippingRateId: "Bitte wähl eine Versandart." },
      values,
    };
  }
  const { snapshot, totals } = buildAmountsSnapshot({
    lines: state.cart.lines,
    discount: state.discount,
    shippingRates: [rate],
    depositTaxRateBp: state.depositTaxRateBp,
  });
  if (!totals.shippingRate) {
    return {
      status: "error",
      message: "Für deinen Warenkorb passt diese Versandart nicht.",
      fieldErrors: { shippingRateId: "Bitte wähl eine andere Versandart." },
      values,
    };
  }

  const shippingAddress = toAddress(shipping.data, details.data.phone);
  const session = await saveSessionDetails(state, {
    email: details.data.email,
    phone: details.data.phone,
    shippingAddress,
    billingAddress: billing?.success ? toAddress(billing.data, null) : null,
    shippingRate: rate,
    snapshot,
  });

  await emitTrackingEvent(
    buildCheckoutEvent(
      "add_shipping_info",
      `add_shipping_info_${session.id}`,
      trackingSource(snapshot),
      { shipping_tier: rate.name },
    ),
  );

  redirect(ROUTE("/checkout/zahlung"));
}

function trackingSource(snapshot: CheckoutState["snapshot"]) {
  return {
    items: snapshot.lines.map((l) => ({
      id: l.sku ?? l.variantId,
      title: l.productTitle,
      variant: l.variantTitle,
      unitPriceCents: l.unitPriceCents,
      quantity: l.quantity,
    })),
    valueCents: snapshot.discountedSubtotalCents,
    coupon: snapshot.discountCode,
  };
}

/* ---------- Rabattcode ---------- */

const codeSchema = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Rabattcode ein.")
  .max(40, "Diesen Rabattcode kennen wir leider nicht.")
  .regex(/^[\w-]+$/, "Diesen Rabattcode kennen wir leider nicht.");

export async function applyDiscountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = String(formData.get("code") ?? "");
  const back = String(formData.get("back") ?? "/checkout");
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: { code: parsed.error.issues[0]?.message ?? "Bitte prüf den Code." },
      values: { code: raw },
    };
  }

  const limit = await checkRateLimit({ action: "discount", limit: 10, windowSeconds: 600 });
  if (!limit.allowed) {
    return { status: "error", fieldErrors: { code: RATE_LIMIT_MESSAGE }, values: { code: raw } };
  }

  const state = await loadCheckoutState();
  if (!state) redirect(ROUTE("/cart"));

  const row = await findDiscountByCode(parsed.data);
  if (!row) {
    return {
      status: "error",
      fieldErrors: { code: DISCOUNT_MESSAGES.unknown },
      values: { code: raw },
    };
  }
  const rule = await toRule(row, state.session?.email ?? state.cart.email);
  const { totals } = buildAmountsSnapshot({
    lines: state.cart.lines,
    discount: rule,
    shippingRates: state.selectedRate ? [state.selectedRate] : state.shippingRates,
    depositTaxRateBp: state.depositTaxRateBp,
  });
  if (totals.discountReason) {
    return {
      status: "error",
      fieldErrors: { code: DISCOUNT_MESSAGES[totals.discountReason] },
      values: { code: raw },
    };
  }

  await setCartDiscount(state.cart.id, row.id);
  await syncSessionDiscount(state, row.code);
  revalidatePath("/checkout");
  revalidatePath("/checkout/zahlung");
  if (back === "/checkout/zahlung") redirect(ROUTE("/checkout/zahlung"));
  return { status: "ok", message: `Rabattcode ${row.code} ist eingelöst.` };
}

export async function removeDiscountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const back = String(formData.get("back") ?? "/checkout");
  const state = await loadCheckoutState();
  if (!state) redirect(ROUTE("/cart"));
  await setCartDiscount(state.cart.id, null);
  await syncSessionDiscount(state, null);
  revalidatePath("/checkout");
  revalidatePath("/checkout/zahlung");
  if (back === "/checkout/zahlung") redirect(ROUTE("/checkout/zahlung"));
  return { status: "ok", message: "Rabattcode entfernt." };
}

async function syncSessionDiscount(state: CheckoutState, code: string | null) {
  if (!state.session) return;
  await checkoutDb()
    .from("checkout_sessions")
    .update({ discount_code: code })
    .eq("id", state.session.id);
}

/* ---------- Schritt 2: Zahlung ---------- */

const paymentSchema = z.object({
  paymentMethod: z.enum(["card", "apple_pay", "google_pay", "paypal", "klarna"], {
    message: "Bitte wähl eine Zahlart.",
  }),
  newsletter: z.boolean(),
});

/**
 * Gemeinsamer Teil vor jeder Zahlung: Beträge neu rechnen, Reservierung erneuern, Rechtstexte
 * und Einwilligungen an der Session speichern, Status processing.
 */
async function beginPayment(formData: FormData) {
  const parsed = paymentSchema.safeParse({
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    newsletter: formData.get("newsletter") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      state: {
        status: "error",
        message: "Bitte wähl eine Zahlart.",
        fieldErrors: { paymentMethod: "Bitte wähl eine Zahlart." },
      } satisfies FormState,
    };
  }

  const limit = await checkRateLimit({ action: "checkout-pay", limit: 20, windowSeconds: 600 });
  if (!limit.allowed) {
    return {
      ok: false as const,
      state: { status: "error", message: RATE_LIMIT_MESSAGE } satisfies FormState,
    };
  }

  const state = await loadCheckoutState();
  if (!state) redirect(ROUTE("/cart"));
  if (!state.session?.shipping_address) redirect(ROUTE("/checkout"));

  // Hat sich der Warenkorb seit dem Laden der Seite geändert, zeigen wir die Übersicht neu
  const shownTotal = Number(formData.get("shownTotal") ?? NaN);
  const prepared = await preparePayment(state);
  if (!prepared.ok) {
    if (prepared.reason === "missing_details" || prepared.reason === "shipping_unavailable") {
      redirect(ROUTE(`/checkout?fehler=${encodeURIComponent(prepared.message)}`));
    }
    return {
      ok: false as const,
      state: { status: "error", message: prepared.message } satisfies FormState,
    };
  }
  if (Number.isFinite(shownTotal) && shownTotal !== prepared.snapshot.totalCents) {
    redirect(ROUTE("/checkout/zahlung?fehler=geaendert"));
  }
  // Abo (Paket Abo, H25): Zahlungsmittel wird gespeichert, Klarna ist dafür nicht möglich
  if (hasSubscriptionLines(prepared.snapshot) && parsed.data.paymentMethod === "klarna") {
    return {
      ok: false as const,
      state: {
        status: "error",
        message: "Klarna geht beim Abo nicht. Bitte wähl Karte, Apple Pay, Google Pay oder PayPal.",
        fieldErrors: { paymentMethod: "Klarna geht beim Abo nicht." },
      } satisfies FormState,
    };
  }

  const legal = await currentLegalVersions();
  await checkoutDb()
    .from("checkout_sessions")
    .update({
      marketing_opt_in: parsed.data.newsletter,
      legal_versions: asJson(legalVersionsSnapshot(legal)),
      status: "processing",
    })
    .eq("id", prepared.session.id);

  await emitTrackingEvent(
    buildCheckoutEvent(
      "add_payment_info",
      `add_payment_info_${prepared.session.id}`,
      trackingSource(prepared.snapshot),
      { payment_type: parsed.data.paymentMethod },
    ),
  );

  return { ok: true as const, method: parsed.data.paymentMethod, prepared };
}

async function setSessionStatus(sessionId: string, status: "open" | "failed") {
  await checkoutDb().from("checkout_sessions").update({ status }).eq("id", sessionId);
}

/**
 * Mock-Zahlung (APP_INTEGRATIONS=mock): Testkarten auswerten, bei Erfolg den Webhook-Weg mit
 * einem simulierten payment_intent.succeeded durchlaufen und zur Bestätigung weiterleiten.
 */
export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    paymentMethod: String(formData.get("paymentMethod") ?? "card"),
    cardNumber: String(formData.get("cardNumber") ?? ""),
    cardExpiry: String(formData.get("cardExpiry") ?? ""),
    newsletter: formData.get("newsletter") === "on" ? "on" : "",
  };
  const payments = integrations().payments;
  if (payments.name !== "mock") {
    return { status: "error", message: "Bitte lade die Seite neu, um sicher zu bezahlen.", values };
  }

  const begun = await beginPayment(formData);
  if (!begun.ok) return { ...begun.state, values };
  const { prepared, method } = begun;

  let details: PaymentDetails = { method };
  if (method === "card") {
    const card = checkTestCard({
      number: values.cardNumber,
      expiry: values.cardExpiry,
      cvc: String(formData.get("cardCvc") ?? ""),
    });
    if (!card.ok) {
      await setSessionStatus(prepared.session.id, "open");
      return {
        status: "error",
        message: card.message,
        fieldErrors: { [card.field]: card.message },
        values,
      };
    }
    if (card.outcome === "declined") {
      await setSessionStatus(prepared.session.id, "failed");
      return {
        status: "error",
        message: "declined",
        fieldErrors: { cardNumber: "Diese Karte wurde abgelehnt." },
        values,
      };
    }
    if (card.outcome === "requires_action") {
      redirect(
        ROUTE(
          `/checkout/zahlung/bestaetigen?marke=${encodeURIComponent(card.brand)}&endung=${card.last4}`,
        ),
      );
    }
    details = { method: "card", brand: card.brand, last4: card.last4 };
  }

  const orderSessionId = await completeMockPayment(prepared.paymentIntentId, details);
  redirect(ROUTE(`/checkout/danke/${orderSessionId}`));
}

async function completeMockPayment(
  paymentIntentId: string,
  details: PaymentDetails,
): Promise<string> {
  const payments = integrations().payments as MockPaymentProvider;
  const stripeType = PAYMENT_METHODS.find((m) => m.id === details.method)?.stripeType ?? "card";
  const simulated = payments.simulateSuccess(paymentIntentId, stripeType);
  // Gleicher Weg wie der echte Webhook: Signatur prüfen, Event idempotent verarbeiten
  const event = await payments.verifyWebhook(simulated.body, simulated.signature);
  const result = await processPaymentEvent(event, details);
  if (result.status === "failed") throw new Error(result.message);
  if ("sessionId" in result) return result.sessionId;
  // Duplikat: Session über den Intent finden
  const { data } = await checkoutDb()
    .from("checkout_sessions")
    .select("id")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!data) throw new Error("Checkout-Session zur Zahlung nicht gefunden");
  return data.id;
}

/** 3-D-Secure-Simulation: Kunde bestätigt die Zahlung bei seiner "Bank". */
export async function confirm3dsAction(formData: FormData): Promise<void> {
  const state = await loadCheckoutState();
  if (!state?.session?.payment_intent_id || state.session.status !== "processing") {
    redirect(ROUTE("/checkout/zahlung"));
  }
  const brand = String(formData.get("marke") ?? "Visa").slice(0, 30);
  const last4 = String(formData.get("endung") ?? "")
    .replace(/\D/g, "")
    .slice(-4);
  const sessionId = await completeMockPayment(state.session.payment_intent_id, {
    method: "card",
    brand,
    last4: last4 || null,
  });
  redirect(ROUTE(`/checkout/danke/${sessionId}`));
}

export async function cancel3dsAction(): Promise<void> {
  const state = await loadCheckoutState();
  if (state?.session) await setSessionStatus(state.session.id, "failed");
  redirect(ROUTE("/checkout/zahlung?fehler=3ds"));
}

/**
 * Echte Zahlung (APP_INTEGRATIONS=live): Server bereitet vor, der Client bestätigt danach mit
 * stripe.confirmPayment. Die Bestellung entsteht ausschließlich im Webhook.
 */
export async function startLivePaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState & { clientSecret?: string; returnUrl?: string }> {
  const begun = await beginPayment(formData);
  if (!begun.ok) return begun.state;
  return {
    status: "ok",
    clientSecret: begun.prepared.clientSecret,
    returnUrl: `/checkout/danke/${begun.prepared.session.id}`,
  };
}
