"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasRole, PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import {
  actionError,
  actionOk,
  fieldErrorsOf,
  formDataToObject,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { addShipment, createDhlLabel, markDelivered } from "@/lib/admin/fulfilment/shipments";
import { ensureInvoice } from "@/lib/admin/invoices/invoices";
import { formatEur } from "@/lib/money";
import { updateOrderAddresses } from "./address";
import { isAdminOrderError, toActionError } from "./errors";
import { isChecked, parseCount, parseEuroToCents, parseKgToGrams } from "./form-input";
import { searchCustomers, type CustomerHit } from "./lookup";
import { createManualOrder } from "./manual";
import { createRefund, loadRefundState } from "./refund";
import { resendOrderMail } from "./resend";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "./status";
import { addOrderNote, markManualPaymentReceived, transitionOrder } from "./transition";

/**
 * Server Actions der Bestellseiten (/admin/bestellungen, /[id], /neu). Jede Action prüft die
 * Sitzung (requireStaff) und das Recht; die Serverlogik prüft es zusätzlich selbst, schreibt
 * order_events und audit_log. Beträge kommen nie vom Client, außer dem bewusst abweichenden
 * Erstattungsbetrag (Kulanz), den computeRefund auf den erstattbaren Rest begrenzt.
 */

const LIST = "/admin/bestellungen";
const uuid = z.uuid();

function detailPath(orderId: string) {
  return `${LIST}/${orderId}`;
}

async function staff(next: string): Promise<StaffSession> {
  return requireStaff("support", { next });
}

function orderIdFrom(formData: FormData): string | null {
  const parsed = uuid.safeParse(formData.get("orderId"));
  return parsed.success ? parsed.data : null;
}

function fail(error: unknown, values?: Record<string, string>): ActionState {
  const e = toActionError(error);
  const fieldErrors =
    isAdminOrderError(error) && error.code === "validation" && Array.isArray(error.details)
      ? fieldErrorsOf({ issues: error.details } as unknown as z.ZodError)
      : undefined;
  return actionError(e.message, { fieldErrors, values });
}

function refresh(orderId?: string) {
  revalidatePath(LIST);
  if (orderId) revalidatePath(detailPath(orderId));
}

/* --- Statuswechsel ----------------------------------------------------------------------------- */

export async function transitionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const to = z
    .enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]])
    .safeParse(formData.get("to"));
  if (!to.success) return actionError("Ungültiger Status.");
  try {
    if (to.data === "paid") {
      await markManualPaymentReceived(orderId, session, undefined);
    } else if (to.data === "delivered") {
      await markDelivered(orderId, session);
    } else if (to.data === "cancelled") {
      return actionError("Bitte storniere über den Dialog mit Grund.");
    } else {
      await transitionOrder(orderId, to.data, session);
    }
  } catch (error) {
    return fail(error);
  }
  await flashToast(`Status: ${ORDER_STATUS_LABELS[to.data]}`);
  refresh(orderId);
  return actionOk();
}

const CANCEL_REASONS = {
  customer: "Kunde hat storniert",
  payment: "Zahlung nicht eingegangen",
  stock: "Ware nicht lieferbar",
  fraud: "Verdacht auf Betrug",
  test: "Testbestellung",
  other: "Anderer Grund",
} as const;

export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const values = {
    reasonKey: String(formData.get("reasonKey") ?? ""),
    reasonText: String(formData.get("reasonText") ?? ""),
  };
  const key = values.reasonKey as keyof typeof CANCEL_REASONS;
  if (!(key in CANCEL_REASONS)) {
    return actionError("Bitte wähle einen Grund.", {
      fieldErrors: { reasonKey: "Bitte wähle einen Grund." },
      values,
    });
  }
  const text = values.reasonText.trim();
  if (key === "other" && text.length < 3) {
    return actionError("Bitte beschreibe den Grund.", {
      fieldErrors: { reasonText: "Bitte beschreibe den Grund (mindestens 3 Zeichen)." },
      values,
    });
  }
  const reason = [CANCEL_REASONS[key], text].filter(Boolean).join(": ").slice(0, 500);
  try {
    const result = await transitionOrder(orderId, "cancelled", session, reason, {
      restock: isChecked(formData.get("restock")),
    });
    const units = result.restocked.reduce((s, r) => s + r.quantity, 0);
    await flashToast(
      units > 0 ? `Bestellung storniert, ${units} Einheiten zurückgebucht` : "Bestellung storniert",
    );
  } catch (error) {
    return fail(error, values);
  }
  refresh(orderId);
  return actionOk();
}

export async function markPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 300) || undefined;
  try {
    await markManualPaymentReceived(orderId, session, note);
  } catch (error) {
    return fail(error);
  }
  await flashToast("Zahlungseingang verbucht");
  refresh(orderId);
  return actionOk();
}

/** Sammelaktion "Als bezahlt markieren": nur manuelle, unbezahlte Bestellungen. */
export async function bulkMarkPaidAction(formData: FormData): Promise<void> {
  const session = await staff(LIST);
  if (!hasRole(session, "admin")) {
    await flashToast("Zahlungen verbuchen dürfen nur Owner und Admin.", "error");
    return;
  }
  const ids = [...new Set(formData.getAll("ids").map(String))].filter(
    (v) => uuid.safeParse(v).success,
  );
  if (ids.length === 0) {
    await flashToast("Bitte wähle mindestens eine Bestellung.", "error");
    return;
  }
  let done = 0;
  let skipped = 0;
  for (const id of ids.slice(0, 200)) {
    try {
      await markManualPaymentReceived(id, session, "Sammelaktion");
      done += 1;
    } catch (error) {
      if (!isAdminOrderError(error)) console.error("[admin/orders] Sammelaktion bezahlt", error);
      skipped += 1;
    }
  }
  await flashToast(
    skipped > 0
      ? `${done} als bezahlt markiert, ${skipped} übersprungen (nur manuelle, offene Bestellungen)`
      : `${done} als bezahlt markiert`,
    done === 0 ? "error" : "success",
  );
  revalidatePath(LIST);
}

/* --- Erstattung -------------------------------------------------------------------------------- */

const REFUND_REASONS = {
  damaged: "Ware beschädigt angekommen",
  missing: "Ware fehlt im Paket",
  wrong: "Falscher Artikel geliefert",
  withdrawal: "Widerruf",
  goodwill: "Kulanz",
  cancelled: "Storno vor Versand",
  other: "Anderer Grund",
} as const;

export async function refundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  if (!PERMISSIONS.refund(session)) {
    return actionError("Erstattungen dürfen nur Owner und Admin auslösen.");
  }
  // Der Dialog hält seine Eingaben selbst (kontrollierte Felder), deshalb keine values zurück
  const values: Record<string, string> | undefined = undefined;

  const lines: { orderItemId: string; quantity: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const itemId = key.slice(4);
    if (!uuid.safeParse(itemId).success) continue;
    const quantity = parseCount(raw);
    if (quantity === null) {
      return actionError("Bitte gib ganze Mengen an.", {
        fieldErrors: { [key]: "Ganze Zahl" },
        values,
      });
    }
    if (quantity > 0) lines.push({ orderItemId: itemId, quantity });
  }

  const reasonKey = String(formData.get("reasonKey") ?? "") as keyof typeof REFUND_REASONS;
  const reasonText = String(formData.get("reasonText") ?? "").trim();
  if (!(reasonKey in REFUND_REASONS)) {
    return actionError("Bitte wähle einen Grund.", {
      fieldErrors: { reasonKey: "Bitte wähle einen Grund." },
      values,
    });
  }
  if (reasonKey === "other" && reasonText.length < 3) {
    return actionError("Bitte beschreibe den Grund.", {
      fieldErrors: { reasonText: "Bitte beschreibe den Grund (mindestens 3 Zeichen)." },
      values,
    });
  }

  // Versandkosten immer der offene Rest laut Bestellung, nie ein Betrag aus dem Formular
  let shippingCents = 0;
  if (isChecked(formData.get("shipping"))) {
    try {
      const { state } = await loadRefundState(orderId);
      shippingCents = Math.max(0, state.shippingCents - state.refundedShippingCents);
    } catch (error) {
      return fail(error, values);
    }
  }
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = amountRaw ? parseEuroToCents(amountRaw) : null;
  if (amountRaw && amountCents === null) {
    return actionError("Der Betrag ist ungültig.", {
      fieldErrors: { amount: "Betrag in Euro, zum Beispiel 26,10" },
      values,
    });
  }
  // Abweichender Betrag nur, wenn er sich vom Vorschlag unterscheidet (die Vorschau setzt ihn vor)
  const suggested = String(formData.get("suggested") ?? "");
  const override =
    amountCents !== null && amountRaw !== suggested && amountCents > 0 ? amountCents : undefined;

  try {
    const result = await createRefund(
      orderId,
      {
        lines,
        shippingCents,
        amountCents: override,
        reason: [REFUND_REASONS[reasonKey], reasonText].filter(Boolean).join(": ").slice(0, 500),
        restock: isChecked(formData.get("restock")),
        notifyCustomer: isChecked(formData.get("notify")),
      },
      session,
    );
    await flashToast(
      `${formatEur(result.amountCents)} erstattet${result.status === "pending" ? " (in Bearbeitung beim Zahlungsanbieter)" : ""}`,
    );
  } catch (error) {
    return fail(error, values);
  }
  refresh(orderId);
  return actionOk();
}

/* --- Versand ----------------------------------------------------------------------------------- */

export async function addShipmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const values = {
    trackingNumber: String(formData.get("trackingNumber") ?? ""),
    carrier: String(formData.get("carrier") ?? "dhl"),
  };
  if (!values.trackingNumber.trim()) {
    return actionError("Bitte gib eine Trackingnummer ein.", {
      fieldErrors: { trackingNumber: "Trackingnummer fehlt" },
      values,
    });
  }
  try {
    const result = await addShipment(
      orderId,
      {
        carrier: values.carrier as "dhl",
        trackingNumber: values.trackingNumber,
        notifyCustomer: isChecked(formData.get("notify")),
      },
      session,
    );
    await flashToast(
      result.mail === "succeeded"
        ? "Versendet, Versandmail ist raus"
        : result.mail === "retry"
          ? "Versendet, die Versandmail wird erneut versucht"
          : "Versendet (ohne Versandmail)",
    );
  } catch (error) {
    const state = fail(error, values);
    if (isAdminOrderError(error) && error.code === "validation") {
      state.fieldErrors = { ...state.fieldErrors, trackingNumber: error.message };
    }
    return state;
  }
  refresh(orderId);
  return actionOk();
}

export async function createLabelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const values = {
    weightKg: String(formData.get("weightKg") ?? ""),
    product: String(formData.get("product") ?? "V01PAK"),
  };
  const grams = values.weightKg.trim() ? parseKgToGrams(values.weightKg) : null;
  if (values.weightKg.trim() && grams === null) {
    return actionError("Bitte prüf das Gewicht.", {
      fieldErrors: { weightKg: "Gewicht in kg, zum Beispiel 4,2" },
      values,
    });
  }
  try {
    const label = await createDhlLabel(orderId, session, {
      product: values.product === "V62KP" ? "V62KP" : "V01PAK",
      withReturnLabel: isChecked(formData.get("withReturnLabel")),
      weightGrams: grams ?? undefined,
    });
    await flashToast(`DHL-Label erstellt, Sendungsnummer ${label.shipmentNumber}`);
  } catch (error) {
    const state = fail(error, values);
    if (state.fieldErrors?.weightGrams) {
      state.fieldErrors = { weightKg: state.fieldErrors.weightGrams };
    }
    return state;
  }
  refresh(orderId);
  return actionOk();
}

/* --- Notizen, Adressen, Mails, Rechnung -------------------------------------------------------- */

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const text = String(formData.get("text") ?? "");
  if (!text.trim()) {
    return actionError("Die Notiz ist leer.", {
      fieldErrors: { text: "Bitte schreib eine Notiz." },
    });
  }
  try {
    await addOrderNote(orderId, text, session);
  } catch (error) {
    return fail(error, { text });
  }
  await flashToast("Notiz gespeichert");
  refresh(orderId);
  return actionOk();
}

function addressFrom(formData: FormData, prefix: "ship" | "bill") {
  const get = (k: string) => String(formData.get(`${prefix}_${k}`) ?? "").trim();
  return {
    first_name: get("first_name"),
    last_name: get("last_name"),
    company: get("company") || null,
    street: get("street"),
    house_number: get("house_number") || null,
    address_addition: get("address_addition") || null,
    postal_code: get("postal_code"),
    city: get("city"),
    phone: get("phone") || null,
  };
}

/** Feldfehler "shipping.street" → "ship_street" (Namen der Formularfelder). */
function addressFieldErrors(errors: Record<string, string> | undefined) {
  if (!errors) return undefined;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const m = /^(shipping|billing|customer\.shippingAddress|customer\.billingAddress)\.(.+)$/.exec(
      key,
    );
    if (m) {
      const prefix = m[1].includes("illing") ? "bill" : "ship";
      out[`${prefix}_${m[2]}`] = message;
    } else out[key] = message;
  }
  return out;
}

export async function updateAddressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  const values = formDataToObject(formData) as Record<string, string>;
  const sameBilling = isChecked(formData.get("billingSame"));
  try {
    const result = await updateOrderAddresses(
      {
        orderId,
        shipping: addressFrom(formData, "ship"),
        billing: sameBilling ? null : addressFrom(formData, "bill"),
      },
      session,
    );
    await flashToast(
      !result.changed
        ? "Keine Änderung"
        : result.labelWarning
          ? "Adresse gespeichert. Bitte das DHL-Label neu erstellen."
          : "Adresse gespeichert",
    );
  } catch (error) {
    const state = fail(error, values);
    state.fieldErrors = addressFieldErrors(state.fieldErrors);
    return state;
  }
  refresh(orderId);
  return actionOk();
}

export async function resendMailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  try {
    const result = await resendOrderMail(orderId, String(formData.get("kind") ?? ""), session);
    await flashToast(`${result.label} erneut gesendet`);
  } catch (error) {
    if (error instanceof z.ZodError) return actionError("Bitte wähle eine Mail.");
    return fail(error);
  }
  refresh(orderId);
  return actionOk();
}

export async function ensureInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderId = orderIdFrom(formData);
  const session = await staff(orderId ? detailPath(orderId) : LIST);
  if (!orderId) return actionError("Ungültige Bestellung.");
  if (!PERMISSIONS.viewCustomers(session)) {
    return actionError("Rechnungen sind für deine Rolle nicht freigegeben.");
  }
  try {
    const result = await ensureInvoice(orderId, session);
    await flashToast(
      result.invoiceNumber
        ? `Rechnung ${result.invoiceNumber} bereit`
        : result.created
          ? "Rechnungsentwurf erstellt (Testmodus)"
          : "Rechnung ist bereits vorhanden",
    );
  } catch (error) {
    return fail(error);
  }
  refresh(orderId);
  return actionOk();
}

/* --- Manuelle Bestellung ----------------------------------------------------------------------- */

export async function searchCustomersAction(query: string): Promise<CustomerHit[]> {
  const session = await staff(`${LIST}/neu`);
  if (!hasRole(session, "admin")) return [];
  if (typeof query !== "string") return [];
  try {
    return await searchCustomers(query.slice(0, 100));
  } catch (error) {
    console.error("[admin/orders] Kundensuche", error);
    return [];
  }
}

export async function createManualOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await staff(`${LIST}/neu`);
  if (!hasRole(session, "admin")) {
    return actionError("Manuelle Bestellungen legen Owner und Admin an.");
  }
  const values = formDataToObject(formData) as Record<string, string>;
  // Mehrfachwerte (Positionen) nicht als values zurückgeben, das Formular hält sie selbst
  delete (values as Record<string, unknown>).line_variant;
  delete (values as Record<string, unknown>).line_qty;

  const variants = formData.getAll("line_variant").map(String);
  const quantities = formData.getAll("line_qty").map(String);
  const lines: { variantId: string; quantity: number }[] = [];
  for (let i = 0; i < variants.length; i++) {
    if (!variants[i]) continue;
    const quantity = Number(quantities[i]);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return actionError("Bitte prüf die Mengen (1 bis 999).", {
        fieldErrors: { lines: "Menge 1 bis 999" },
        values,
      });
    }
    lines.push({ variantId: variants[i], quantity });
  }
  if (lines.length === 0) {
    return actionError("Bitte füge mindestens eine Position hinzu.", {
      fieldErrors: { lines: "Mindestens eine Position" },
      values,
    });
  }

  const discountRaw = String(formData.get("discountAmount") ?? "").trim();
  const discountCents = discountRaw ? parseEuroToCents(discountRaw) : null;
  if (discountRaw && (discountCents === null || discountCents <= 0)) {
    return actionError("Bitte prüf den Rabatt.", {
      fieldErrors: { discountAmount: "Betrag in Euro, zum Beispiel 5,00" },
      values,
    });
  }
  const discountReason = String(formData.get("discountReason") ?? "").trim();
  if (discountCents && discountReason.length < 3) {
    return actionError("Bitte gib einen Grund für den Rabatt an.", {
      fieldErrors: { discountReason: "Grund fehlt (mindestens 3 Zeichen)" },
      values,
    });
  }

  const billingSame = isChecked(formData.get("billingSame"));
  const customerId = String(formData.get("customerId") ?? "");
  const rateId = String(formData.get("shippingRateId") ?? "");
  let result;
  try {
    result = await createManualOrder(
      {
        customer: {
          email: String(formData.get("email") ?? ""),
          phone: String(formData.get("phone") ?? "").trim() || null,
          shippingAddress: addressFrom(formData, "ship"),
          billingAddress: billingSame ? null : addressFrom(formData, "bill"),
        },
        customerId: uuid.safeParse(customerId).success ? customerId : null,
        lines,
        shipping: {
          rateId: uuid.safeParse(rateId).success ? rateId : null,
          waive: isChecked(formData.get("waiveShipping")),
        },
        discount: discountCents ? { amountCents: discountCents, reason: discountReason } : null,
        payment: formData.get("payment") === "paid" ? "paid" : "invoice",
        note: String(formData.get("note") ?? "").trim() || null,
        customerNote: String(formData.get("customerNote") ?? "").trim() || null,
        isTest: isChecked(formData.get("isTest")),
      },
      session,
    );
  } catch (error) {
    const state = fail(error, values);
    state.fieldErrors = addressFieldErrors(state.fieldErrors);
    if (state.fieldErrors?.["customer.email"])
      state.fieldErrors.email = state.fieldErrors["customer.email"];
    return state;
  }
  await flashToast(
    `Bestellung ${result.orderNumber} angelegt (${formatEur(result.totalCents)}${result.isTest ? ", Test" : ""})`,
  );
  revalidatePath(LIST);
  redirect(detailPath(result.orderId));
}
