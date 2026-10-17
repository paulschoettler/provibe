import "server-only";
import { randomUUID } from "node:crypto";
import { integrations } from "@/lib/integrations";
import { asJson, checkoutDb } from "./db";
import { enqueueJob } from "./jobs";
import {
  readSnapshot,
  SESSION_TTL_MINUTES,
  sessionExpiry,
  type CheckoutSessionRow,
  type CheckoutState,
} from "./session";
import { buildAmountsSnapshot, hasSubscriptionLines } from "./snapshot";
import type { AmountsSnapshot } from "./types";

/**
 * Eintritt in Schritt 2: Beträge neu rechnen, Bestand reservieren, PaymentIntent anlegen oder
 * anpassen. Idempotent, wird bei jedem Aufruf von Schritt 2 und unmittelbar vor der Zahlung
 * ausgeführt. Der Client bekommt höchstens das client_secret, nie einen Betrag zum Zurücksenden.
 */

export type PrepareResult =
  | {
      ok: true;
      session: CheckoutSessionRow;
      snapshot: AmountsSnapshot;
      paymentIntentId: string;
      clientSecret: string;
    }
  | {
      ok: false;
      reason: "missing_details" | "shipping_unavailable" | "insufficient_stock";
      message: string;
    };

export async function preparePayment(state: CheckoutState): Promise<PrepareResult> {
  const session = state.session;
  if (!session || !session.email || !session.shipping_address || !session.shipping_rate_id) {
    return { ok: false, reason: "missing_details", message: "Bitte gib zuerst deine Adresse an." };
  }
  const rate = state.shippingRates.find((r) => r.id === session.shipping_rate_id);
  if (!rate) {
    return {
      ok: false,
      reason: "shipping_unavailable",
      message: "Die gewählte Versandart ist nicht mehr verfügbar. Bitte wähl eine andere.",
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
      ok: false,
      reason: "shipping_unavailable",
      message: "Für diesen Warenkorb passt die gewählte Versandart nicht. Bitte wähl eine andere.",
    };
  }

  const db = checkoutDb();

  // Bestand reservieren (löst Bundles auf Komponenten auf, wirft INSUFFICIENT_STOCK).
  // Unveränderter Warenkorb mit noch lange gültiger Reservierung: nicht neu reservieren.
  const items = snapshot.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));
  const reserveError = (await reservationStillValid(session, snapshot))
    ? null
    : (
        await db.rpc("reserve_stock", {
          p_checkout_session_id: session.id,
          p_items: asJson(items),
          p_ttl: `${SESSION_TTL_MINUTES} minutes`,
        })
      ).error;
  if (reserveError) {
    if (reserveError.message.includes("INSUFFICIENT_STOCK")) {
      return {
        ok: false,
        reason: "insufficient_stock",
        message:
          "Ein Artikel in deinem Warenkorb ist gerade nicht mehr in der gewünschten Menge da. Bitte prüf deinen Warenkorb.",
      };
    }
    throw new Error(`Reservierung fehlgeschlagen: ${reserveError.message}`);
  }

  const payments = integrations().payments;
  const intent = await ensurePaymentIntent(session, snapshot);
  const expiresAt = sessionExpiry();

  const { data: updated, error } = await db
    .from("checkout_sessions")
    .update({
      amounts: asJson(snapshot),
      discount_code: snapshot.discountCode,
      payment_intent_id: intent.id,
      payment_provider: payments.name,
      expires_at: expiresAt,
      status: "open",
    })
    .eq("id", session.id)
    .select("*")
    .single();
  if (error || !updated) throw new Error(`Session nicht aktualisiert: ${error?.message}`);

  // Freigabe nach Ablauf: ein Job je Session und Zehn-Minuten-Fenster (idempotent)
  const bucket = Math.floor(new Date(expiresAt).getTime() / 600_000);
  await enqueueJob({
    kind: "checkout.release_reservation",
    payload: { checkout_session_id: session.id },
    runAt: expiresAt,
    idempotencyKey: `checkout.release:${session.id}:${bucket}`,
    priority: 50,
  });

  return {
    ok: true,
    session: updated,
    snapshot,
    paymentIntentId: intent.id,
    clientSecret: intent.clientSecret,
  };
}

/** Gleiche Positionen wie beim letzten Mal und aktive Reservierung mit mehr als 10 Minuten Restzeit? */
async function reservationStillValid(
  session: CheckoutSessionRow,
  snapshot: AmountsSnapshot,
): Promise<boolean> {
  const previous = readSnapshot(session.amounts);
  if (!previous || session.status === "expired") return false;
  const key = (s: AmountsSnapshot) =>
    s.lines
      .map((l) => `${l.variantId}:${l.quantity}`)
      .sort()
      .join(",");
  if (key(previous) !== key(snapshot)) return false;
  const { data } = await checkoutDb()
    .from("inventory_reservations")
    .select("expires_at")
    .eq("checkout_session_id", session.id)
    .eq("status", "active")
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return Boolean(data && new Date(data.expires_at).getTime() - Date.now() > 10 * 60_000);
}

/**
 * Vorhandenen PaymentIntent wiederverwenden und den Betrag angleichen, sonst neu anlegen.
 * Der Mock hält Intents nur im Speicher; nach einem Neustart des Servers wird neu angelegt.
 */
async function ensurePaymentIntent(session: CheckoutSessionRow, snapshot: AmountsSnapshot) {
  const payments = integrations().payments;
  const metadata = {
    checkout_session_id: session.id,
    cart_id: session.cart_id,
    discount_code: snapshot.discountCode ?? "",
  };
  // Abo-Positionen (Paket Abo): Zahlungsmittel am Stripe-Kunden für spätere Lieferungen
  // speichern, nur Karte (inklusive Apple Pay, Google Pay) und PayPal, kein Klarna (H25)
  const subscription = hasSubscriptionLines(snapshot);
  const providerCustomerId =
    subscription && session.email && payments.name !== "mock"
      ? (await payments.ensureCustomer({ email: session.email })).id
      : null;

  if (session.payment_intent_id) {
    try {
      const existing = await payments.retrievePaymentIntent(session.payment_intent_id);
      const reusable = ["requires_payment_method", "requires_confirmation", "requires_action"];
      // Wechsel zwischen Einmalkauf und Abo ändert die Speicherung: dann neuen Intent anlegen
      const wasSubscription = existing.metadata?.has_subscription === "1";
      if (reusable.includes(existing.status) && wasSubscription === subscription) {
        if (existing.amountCents !== snapshot.totalCents) {
          return await payments.updatePaymentIntentAmount(
            existing.id,
            snapshot.totalCents,
            metadata,
          );
        }
        return existing;
      }
    } catch {
      // unbekannt (Mock nach Neustart) oder nicht mehr abrufbar: neu anlegen
    }
  }

  return payments.createPaymentIntent({
    amountCents: snapshot.totalCents,
    currency: "eur",
    checkoutSessionId: session.id,
    email: session.email ?? undefined,
    customerId: session.customer_id,
    description: subscription ? "provibe Bestellung mit Abo" : "provibe Bestellung",
    metadata: subscription ? { ...metadata, has_subscription: "1" } : metadata,
    ...(subscription
      ? {
          saveForFutureUse: true,
          providerCustomerId,
          paymentMethodTypes: ["card", "paypal"],
        }
      : {}),
    // Je Session und Betrag eindeutig; bei Neuanlage nach Abbruch mit frischem Suffix
    idempotencyKey: `checkout:${session.id}:${snapshot.totalCents}:${session.payment_intent_id ? randomUUID() : "1"}`,
  });
}
