import "server-only";
import type { StoredAddress } from "@/lib/checkout/types";
import { integrations } from "@/lib/integrations";
import { planCancellation, type CancelTiming, type CancellationPlan } from "./cancellation";
import { loadPricingContext, loadVariants, quoteDelivery } from "./catalog";
import { aboDb, applySubscription, asJson, loadSubscriptionRow } from "./db";
import { subscriptionCancelledEmail } from "./emails";
import { loadCustomerContact, mailBase, mailSubscription, sendAboMail } from "./mailer";
import { chargeNow, type RenewalOutcome } from "./renewal";
import { isAllowedInterval, isSubscribable, MAX_SUBSCRIPTION_QUANTITY } from "./rules";
import { resumeNextOrderAt, validatePauseUntil } from "./schedule";
import { loadSubscriptionSettings } from "./settings";
import { allowedFrom, nextStatus } from "./state";
import type {
  ActorType,
  CancelKind,
  PaymentMethodRow,
  PauseReason,
  SubscriptionRow,
  SubscriptionStatus,
} from "./types";

/**
 * Fachliche Aktionen auf einem Abo, gemeinsam für Portal (Server Actions mit Besitzprüfung) und
 * Backoffice (mit Audit-Log). Jede Aktion prüft den Zustand über die Zustandsmaschine und
 * schreibt atomar über subscription_apply (Patch und Ereignis in einer Transaktion).
 */

export interface Actor {
  type: ActorType;
  id?: string | null;
}

export class SubscriptionActionError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "SubscriptionActionError";
  }
}

function expected(event: Parameters<typeof allowedFrom>[0]): SubscriptionStatus[] {
  return allowedFrom(event);
}

function ensure(row: SubscriptionRow, event: Parameters<typeof allowedFrom>[0], message: string) {
  try {
    return nextStatus(row.status, event);
  } catch {
    throw new SubscriptionActionError(message);
  }
}

/* ---------- Sorte, Packgröße, Menge, Intervall ---------- */

export interface PlanChange {
  variantId?: string;
  quantity?: number;
  intervalWeeks?: number;
}

export async function updatePlan(
  row: SubscriptionRow,
  change: PlanChange,
  actor: Actor,
): Promise<SubscriptionRow> {
  const to = ensure(row, "change", "Ein gekündigtes Abo lässt sich nicht mehr ändern.");
  const patch: Record<string, unknown> = {};
  const diff: Record<string, unknown> = {};

  if (change.variantId && change.variantId !== row.variant_id) {
    const variant = (await loadVariants([change.variantId])).get(change.variantId);
    const p = variant?.products;
    if (
      !variant ||
      !p ||
      !isSubscribable({
        productKind: p.kind,
        productStatus: p.status,
        variantActive: variant.is_active,
        unitCount: variant.unit_count,
        depositCentsPerUnit: p.deposit_cents_per_unit,
      })
    ) {
      throw new SubscriptionActionError(
        "Diese Sorte oder Packgröße gibt es nicht im Abo.",
        "variantId",
      );
    }
    patch.variant_id = variant.id;
    // Wechsel auf Wunsch des Kunden: es gilt der aktuelle Katalogpreis der neuen Variante
    patch.locked_price_cents = variant.price_cents;
    patch.price_notice_sent_at = null;
    patch.price_change_effective_at = null;
    diff.variant_id = { from: row.variant_id, to: variant.id };
  }
  if (change.quantity !== undefined && change.quantity !== row.quantity) {
    if (
      !Number.isInteger(change.quantity) ||
      change.quantity < 1 ||
      change.quantity > MAX_SUBSCRIPTION_QUANTITY
    ) {
      throw new SubscriptionActionError(
        `Die Menge muss zwischen 1 und ${MAX_SUBSCRIPTION_QUANTITY} liegen.`,
        "quantity",
      );
    }
    patch.quantity = change.quantity;
    diff.quantity = { from: row.quantity, to: change.quantity };
  }
  if (change.intervalWeeks !== undefined && change.intervalWeeks !== row.interval_count) {
    const settings = await loadSubscriptionSettings();
    if (!isAllowedInterval(settings, change.intervalWeeks)) {
      throw new SubscriptionActionError("Bitte wähl ein Lieferintervall.", "intervalWeeks");
    }
    patch.interval_count = change.intervalWeeks;
    patch.interval_unit = "week";
    diff.interval_weeks = { from: row.interval_count, to: change.intervalWeeks };
  }
  if (Object.keys(patch).length === 0) return row;
  return applySubscription({
    id: row.id,
    expected: expected("change"),
    patch: { ...patch, status: to },
    event: { kind: "changed", data: diff },
    actor,
  });
}

/* ---------- Überspringen ---------- */

export async function setSkipNext(row: SubscriptionRow, skip: boolean, actor: Actor) {
  ensure(row, "skip", "Überspringen geht nur bei einem laufenden Abo.");
  if (row.skip_next === skip) return row;
  return applySubscription({
    id: row.id,
    expected: ["active"],
    patch: { skip_next: skip, reminder_sent_for: skip ? row.reminder_sent_for : null },
    event: { kind: skip ? "skipped" : "unskipped", data: { delivery: row.next_order_at } },
    actor,
  });
}

/* ---------- Pausieren und Fortsetzen ---------- */

export async function pause(
  row: SubscriptionRow,
  untilDay: string,
  actor: Actor,
  reason: PauseReason = actor.type === "staff" ? "staff" : "customer",
  now: Date = new Date(),
) {
  const to = ensure(row, "pause", "Pausieren geht nur bei einem laufenden Abo.");
  const settings = await loadSubscriptionSettings();
  const check = validatePauseUntil(untilDay, now, settings.pauseMaxDays);
  if (!check.ok) throw new SubscriptionActionError(check.message, "until");
  return applySubscription({
    id: row.id,
    expected: expected("pause"),
    patch: {
      status: to,
      paused_until: check.until.toISOString(),
      next_order_at: check.until.toISOString(),
      pause_reason: reason,
      skip_next: false,
      reminder_sent_for: null,
    },
    event: { kind: "paused", data: { until: check.until.toISOString(), reason } },
    actor,
  });
}

export async function resume(
  row: SubscriptionRow,
  actor: Actor,
  now: Date = new Date(),
): Promise<{ row: SubscriptionRow; charge?: RenewalOutcome }> {
  if (row.status === "paused" && row.pause_reason === "payment_failed") {
    // Pause wegen Zahlungsfehler: erst ein Versuch mit dem hinterlegten Zahlungsmittel
    const charge = await chargeNow(row.id, now);
    return { row: (await loadSubscriptionRow(row.id)) ?? row, charge };
  }
  const to = ensure(row, "resume", "Dieses Abo ist nicht pausiert.");
  const updated = await applySubscription({
    id: row.id,
    expected: expected("resume"),
    patch: {
      status: to,
      paused_until: null,
      pause_reason: null,
      next_order_at: resumeNextOrderAt(now).toISOString(),
      reminder_sent_for: null,
    },
    event: { kind: "resumed", data: {} },
    actor,
  });
  return { row: updated };
}

/* ---------- Adresse und Zahlungsmittel ---------- */

export async function changeAddress(row: SubscriptionRow, address: StoredAddress, actor: Actor) {
  const to = ensure(row, "change", "Ein gekündigtes Abo lässt sich nicht mehr ändern.");
  return applySubscription({
    id: row.id,
    expected: expected("change"),
    patch: { status: to, shipping_address: asJson(address) },
    event: {
      kind: "address_changed",
      data: { postal_code: address.postal_code, city: address.city },
    },
    actor,
  });
}

/**
 * Neues Zahlungsmittel setzen. Ist eine Zahlung offen (past_due oder Pause wegen Zahlungsfehler),
 * wird sofort neu abgebucht ("Aktualisier dein Zahlungsmittel, dann schicken wir sofort los").
 */
export async function setPaymentMethod(
  row: SubscriptionRow,
  method: PaymentMethodRow,
  actor: Actor,
): Promise<{ row: SubscriptionRow; charge?: RenewalOutcome }> {
  if (row.status === "cancelled") {
    throw new SubscriptionActionError("Ein gekündigtes Abo lässt sich nicht mehr ändern.");
  }
  if (method.customer_id !== row.customer_id) {
    throw new SubscriptionActionError("Dieses Zahlungsmittel gehört nicht zu deinem Konto.");
  }
  const previous = row.payment_method_id;
  const updated = await applySubscription({
    id: row.id,
    expected: ["active", "paused", "past_due"],
    patch: { payment_method_id: method.id, stripe_customer_id: method.stripe_customer_id },
    event: {
      kind: "payment_method_changed",
      data: { brand: method.brand, last4: method.last4, type: method.type },
    },
    actor,
  });
  await detachIfUnused(previous, row.customer_id);
  const needsCharge =
    updated.status === "past_due" ||
    (updated.status === "paused" && updated.pause_reason === "payment_failed");
  if (!needsCharge) return { row: updated };
  const charge = await chargeNow(row.id);
  return { row: (await loadSubscriptionRow(row.id)) ?? updated, charge };
}

/** Altes Zahlungsmittel lösen, wenn kein anderes offenes Abo es nutzt. */
async function detachIfUnused(paymentMethodId: string | null, customerId: string) {
  if (!paymentMethodId) return;
  const db = aboDb();
  const { count } = await db
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("payment_method_id", paymentMethodId)
    .neq("status", "cancelled");
  if ((count ?? 0) > 0) return;
  const { data } = await db
    .from("customer_payment_methods")
    .select("stripe_payment_method_id")
    .eq("id", paymentMethodId)
    .maybeSingle();
  const pmId = (data as { stripe_payment_method_id: string } | null)?.stripe_payment_method_id;
  if (!pmId) return;
  try {
    await integrations().payments.detachPaymentMethod(pmId);
  } catch (error) {
    console.error("[abo] Zahlungsmittel nicht gelöst", error);
  }
}

/* ---------- Kündigen ---------- */

export interface CancelInput {
  kind: CancelKind;
  timing: CancelTiming;
  desiredDay?: string | null;
  /** Grund-Kennung aus dem Dialog oder Freitext (außerordentlich) */
  reason?: string | null;
  note?: string | null;
  /** Kündigungsmail an den Kunden schicken (Portal ja, /abo-kuendigen nein: dort Sammelbestätigung) */
  sendMail?: boolean;
  /** Vorgang aus subscription_cancellation_requests */
  requestId?: string | null;
}

export async function cancel(
  row: SubscriptionRow,
  input: CancelInput,
  actor: Actor,
  now: Date = new Date(),
): Promise<{ row: SubscriptionRow; plan: CancellationPlan }> {
  if (row.status === "cancelled") {
    return {
      row,
      plan: {
        mode: "immediate",
        cancelledAt: new Date(row.cancelled_at ?? now),
        effectiveAt: new Date(row.cancel_effective_at ?? row.cancelled_at ?? now),
      },
    };
  }
  const plan = planCancellation({
    kind: input.kind,
    timing: input.timing,
    desiredDay: input.desiredDay ?? null,
    now,
    subscription: row,
  });
  const reasonText = [input.reason, input.note]
    .filter((s) => s && s.trim())
    .join(": ")
    .slice(0, 1000);
  const eventData = {
    kind: input.kind,
    timing: input.timing,
    desired_day: input.desiredDay ?? null,
    effective_at: plan.effectiveAt.toISOString(),
    request_id: input.requestId ?? null,
    reason: input.reason ?? null,
  };
  let updated: SubscriptionRow;
  if (plan.mode === "immediate") {
    updated = await applySubscription({
      id: row.id,
      expected: expected("cancel"),
      patch: {
        status: nextStatus(row.status, "cancel"),
        cancelled_at: plan.cancelledAt.toISOString(),
        cancel_effective_at: plan.effectiveAt.toISOString(),
        cancel_kind: input.kind,
        cancel_reason: reasonText || null,
        next_order_at: null,
        next_retry_at: null,
        skip_next: false,
        pending_payment_intent_id: null,
      },
      event: { kind: "cancelled", data: eventData },
      actor,
    });
    await abandonOpenPayment(row);
  } else {
    updated = await applySubscription({
      id: row.id,
      expected: ["active", "paused", "past_due"],
      patch: {
        cancel_effective_at: plan.effectiveAt.toISOString(),
        cancel_kind: input.kind,
        cancel_reason: reasonText || null,
      },
      event: { kind: "cancellation_scheduled", data: eventData },
      actor,
    });
  }
  if (input.sendMail !== false) await sendCancelledMail(updated, plan, now);
  return { row: updated, plan };
}

/** Offene Bestätigung (3-D Secure) beim Kündigen verwerfen: Reservierung lösen, Intent abbrechen. */
async function abandonOpenPayment(row: SubscriptionRow) {
  if (!row.pending_payment_intent_id) return;
  const db = aboDb();
  const { data } = await db
    .from("checkout_sessions")
    .select("id")
    .eq("payment_intent_id", row.pending_payment_intent_id)
    .maybeSingle();
  const sessionId = (data as { id: string } | null)?.id;
  if (sessionId) {
    await db.rpc("release_reservations", { p_checkout_session_id: sessionId });
    await db.from("checkout_sessions").update({ status: "cancelled" }).eq("id", sessionId);
  }
  try {
    await integrations().payments.cancelPaymentIntent(row.pending_payment_intent_id);
  } catch {
    // abgeschlossen oder unbekannt
  }
}

async function lastOrderOf(subscriptionId: string): Promise<{ number: string; date: Date } | null> {
  const { data } = await aboDb()
    .from("subscription_orders")
    .select("created_at, orders (order_number, placed_at)")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const o = (data as { orders?: { order_number: string; placed_at: string } | null } | null)
    ?.orders;
  return o ? { number: o.order_number, date: new Date(o.placed_at) } : null;
}

export async function sendCancelledMail(row: SubscriptionRow, plan: CancellationPlan, now: Date) {
  const [customer, variants, pricing, lastOrder] = await Promise.all([
    loadCustomerContact(row.customer_id),
    loadVariants([row.variant_id]),
    loadPricingContext(),
    lastOrderOf(row.id),
  ]);
  const variant = variants.get(row.variant_id);
  if (!customer || !variant) return;
  const quote = quoteDelivery(row, variant, pricing, now);
  await sendAboMail({
    to: customer.email,
    mail: subscriptionCancelledEmail(
      await mailBase(customer.firstName),
      mailSubscription(row, quote),
      {
        receivedAt: now,
        effectiveAt: plan.effectiveAt,
        immediate: plan.mode === "immediate",
        lastOrder,
      },
    ),
    template: "subscription_cancelled",
    idempotencyKey: `subscription_cancelled:${row.id}:${plan.effectiveAt.toISOString()}`,
  });
}

/* ---------- Rabatt (Backoffice) ---------- */

export async function setDiscount(row: SubscriptionRow, discountBp: number, actor: Actor) {
  if (!Number.isInteger(discountBp) || discountBp < 0 || discountBp > 5000) {
    throw new SubscriptionActionError(
      "Der Rabatt muss zwischen 0 und 50 Prozent liegen.",
      "discountBp",
    );
  }
  if (row.status === "cancelled") {
    throw new SubscriptionActionError("Ein gekündigtes Abo lässt sich nicht mehr ändern.");
  }
  return applySubscription({
    id: row.id,
    expected: ["draft", "active", "paused", "past_due"],
    patch: { discount_bp: discountBp },
    event: { kind: "discount_changed", data: { from: row.discount_bp, to: discountBp } },
    actor,
  });
}
