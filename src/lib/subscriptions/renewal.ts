import "server-only";
import { finalizeOrder } from "@/lib/checkout/finalize";
import { formatAddressLine } from "@/lib/checkout/snapshot";
import { readAddress } from "@/lib/checkout/session";
import { integrations } from "@/lib/integrations";
import type { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { loadPricingContext, loadVariants, quoteDelivery, type DeliveryQuote } from "./catalog";
import {
  aboDb,
  applySubscription,
  asJson,
  loadSubscriptionRow,
  lockSubscription,
  recordSubscriptionEvent,
  releaseSubscription,
} from "./db";
import { authenticationRequiredEmail, nextDeliveryEmail, paymentFailedEmail } from "./emails";
import { enqueueSubscriptionJob } from "./jobs-queue";
import {
  loadCustomerContact,
  loadPaymentMethod,
  mailBase,
  mailSubscription,
  paymentMethodLabel,
  sendAboMail,
} from "./mailer";
import {
  addDeliveryDays,
  nextOrderAfterSkip,
  reminderDue,
  remainingRetryDates,
  retryDecision,
} from "./schedule";
import { loadSubscriptionSettings } from "./settings";
import type { PaymentMethodRow, SubscriptionRow, SubscriptionSettings } from "./types";

/**
 * Abo-Lauf: fällige Abos in Bestellungen verwandeln.
 *
 * Je Lieferung entsteht wie im Checkout ein Warenkorb (Status converted, nur als Klammer) und eine
 * Checkout-Session mit Betrags-Snapshot. Darauf laufen dieselben Bausteine wie bei jeder
 * Bestellung: reserve_stock, PaymentIntent (hier off_session mit gespeichertem Zahlungsmittel),
 * finalizeOrder (Bestellung, Positionen, Bestandsabbuchung, Mails, Rechnung, Tracking) und der
 * Abo-Hook, der die Bestellung in subscription_orders verknüpft und den Termin fortschreibt.
 * Kommt parallel der Stripe-Webhook, verhindert payment_intent_id (unique) die doppelte Bestellung.
 */

export type RenewalOutcome =
  | "ordered"
  | "skipped"
  | "cancelled"
  | "resumed_only"
  | "declined"
  | "paused_after_failures"
  | "action_required"
  | "stock_missing"
  | "not_due"
  | "locked"
  | "error";

export interface RunSummary {
  claimed: number;
  outcomes: Record<string, number>;
  errors: { subscriptionId: string; message: string }[];
  stoppedByDeadline: boolean;
}

/** Täglicher Lauf (Job subscription.run_due): alle fälligen Abos nacheinander. */
export async function runDueSubscriptions(
  options: { limit?: number; now?: Date; budgetMs?: number } = {},
): Promise<RunSummary> {
  const started = Date.now();
  const budget = options.budgetMs ?? 20_000;
  const now = options.now ?? new Date();
  const summary: RunSummary = { claimed: 0, outcomes: {}, errors: [], stoppedByDeadline: false };
  const { data, error } = await aboDb().rpc("subscription_claim_due", {
    p_limit: Math.min(Math.max(options.limit ?? 25, 1), 100),
    p_now: now.toISOString(),
  });
  if (error) throw new Error(`Fällige Abos nicht gesperrt: ${error.message}`);
  const ids = ((data ?? []) as (string | { subscription_claim_due: string })[]).map((r) =>
    typeof r === "string" ? r : r.subscription_claim_due,
  );
  summary.claimed = ids.length;
  const settings = await loadSubscriptionSettings();
  for (const id of ids) {
    if (Date.now() - started > budget) {
      summary.stoppedByDeadline = true;
      await releaseSubscription(id);
      continue;
    }
    try {
      const outcome = await processDue(id, now, settings);
      summary.outcomes[outcome] = (summary.outcomes[outcome] ?? 0) + 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[abo] Lieferung fehlgeschlagen", id, message);
      summary.errors.push({ subscriptionId: id, message: message.slice(0, 300) });
      summary.outcomes.error = (summary.outcomes.error ?? 0) + 1;
    } finally {
      await releaseSubscription(id);
    }
  }
  // Sind noch mehr fällig, holt der nächste Lauf sie (Job wird bei Bedarf erneut angelegt)
  if (ids.length >= (options.limit ?? 25) && !summary.stoppedByDeadline) {
    await enqueueSubscriptionJob({
      kind: "subscription.run_due",
      payload: {},
      idempotencyKey: `subscription.run_due:more:${now.toISOString().slice(0, 16)}`,
      runAt: new Date(Date.now() + 60_000).toISOString(),
    });
  }
  return summary;
}

/** Ein gesperrtes, fälliges Abo verarbeiten (Pause zu Ende, Kündigung, Überspringen, Lieferung). */
async function processDue(
  id: string,
  now: Date,
  settings: SubscriptionSettings,
): Promise<RenewalOutcome> {
  let row = await loadSubscriptionRow(id);
  if (!row) return "error";

  // Pause zu Ende: automatisch fortsetzen, die Lieferung kommt am Tag der Fortsetzung
  if (row.status === "paused") {
    if (row.pause_reason === "payment_failed" || !row.paused_until) return "not_due";
    if (new Date(row.paused_until).getTime() > now.getTime()) return "not_due";
    row = await applySubscription({
      id,
      expected: ["paused"],
      patch: {
        status: "active",
        next_order_at: row.paused_until,
        paused_until: null,
        pause_reason: null,
      },
      event: { kind: "resumed", data: { automatic: true } },
      actor: { type: "system" },
    });
  }
  if (row.status !== "active" || !row.next_order_at) return "not_due";
  if (new Date(row.next_order_at).getTime() > now.getTime()) return "resumed_only";

  // Kündigung zu einem Wunschdatum erreicht: keine weitere Lieferung
  if (row.cancel_effective_at && new Date(row.next_order_at) >= new Date(row.cancel_effective_at)) {
    await applySubscription({
      id,
      expected: ["active"],
      patch: { status: "cancelled", cancelled_at: now.toISOString(), next_order_at: null },
      event: {
        kind: "cancelled",
        data: { scheduled: true, effective_at: row.cancel_effective_at },
      },
      actor: { type: "system" },
    });
    return "cancelled";
  }

  if (row.skip_next) {
    await applySubscription({
      id,
      expected: ["active"],
      patch: {
        skip_next: false,
        next_order_at: nextOrderAfterSkip(
          new Date(row.next_order_at),
          row.interval_count,
        ).toISOString(),
        reminder_sent_for: null,
      },
      event: { kind: "skipped_delivery", data: { skipped_date: row.next_order_at } },
      actor: { type: "system" },
    });
    return "skipped";
  }

  return chargeAndOrder(row, now, settings);
}

/** Wiederholung nach abgelehnter Zahlung (Job subscription.retry, Tag 3 und Tag 7). */
export async function retrySubscriptionPayment(
  id: string,
  now: Date = new Date(),
): Promise<RenewalOutcome> {
  if (!(await lockSubscription(id))) return "locked";
  try {
    const row = await loadSubscriptionRow(id);
    if (!row || row.status !== "past_due") return "not_due";
    if (row.pending_payment_intent_id) return "action_required"; // wartet auf Bestätigung
    return await chargeAndOrder(row, now, await loadSubscriptionSettings());
  } finally {
    await releaseSubscription(id);
  }
}

/** Sofortiger neuer Versuch, z.B. nach einem neuen Zahlungsmittel (Portal) oder im Backoffice. */
export async function chargeNow(id: string, now: Date = new Date()): Promise<RenewalOutcome> {
  if (!(await lockSubscription(id))) return "locked";
  try {
    let row = await loadSubscriptionRow(id);
    if (!row) return "error";
    if (row.status === "paused" && row.pause_reason === "payment_failed") {
      row = await applySubscription({
        id,
        expected: ["paused"],
        patch: { status: "past_due", paused_until: null, pause_reason: null },
        event: { kind: "resumed", data: { reason: "payment_method_changed" } },
        actor: { type: "system" },
      });
    }
    if (row.status !== "past_due") return "not_due";
    if (row.pending_payment_intent_id) row = await abandonPendingPayment(row);
    return await chargeAndOrder(row, now, await loadSubscriptionSettings());
  } finally {
    await releaseSubscription(id);
  }
}

/** Offene Bestätigung verwerfen (neues Zahlungsmittel): Reservierung lösen, Intent abbrechen. */
async function abandonPendingPayment(row: SubscriptionRow): Promise<SubscriptionRow> {
  const intentId = row.pending_payment_intent_id!;
  const db = aboDb();
  const { data } = await db
    .from("checkout_sessions")
    .select("id")
    .eq("payment_intent_id", intentId)
    .maybeSingle();
  const sessionId = (data as { id: string } | null)?.id;
  if (sessionId) {
    await db.rpc("release_reservations", { p_checkout_session_id: sessionId });
    await db.from("checkout_sessions").update({ status: "cancelled" }).eq("id", sessionId);
  }
  try {
    await integrations().payments.cancelPaymentIntent(intentId);
  } catch {
    // schon abgeschlossen oder dem Mock unbekannt
  }
  return applySubscription({
    id: row.id,
    expected: ["past_due"],
    patch: { pending_payment_intent_id: null },
    event: { kind: "payment_action_abandoned", data: { intent_id: intentId } },
    actor: { type: "system" },
  });
}

interface InitialOrderInfo {
  legalVersions: unknown;
  phone: string | null;
}

async function initialOrderInfo(subscriptionId: string): Promise<InitialOrderInfo> {
  const { data } = await aboDb()
    .from("subscription_orders")
    .select("orders (legal_versions, phone)")
    .eq("subscription_id", subscriptionId)
    .eq("kind", "initial")
    .limit(1)
    .maybeSingle();
  const order = (
    data as { orders?: { legal_versions: unknown; phone: string | null } | null } | null
  )?.orders;
  return { legalVersions: order?.legal_versions ?? {}, phone: order?.phone ?? null };
}

/**
 * Lieferung abbuchen und Bestellung anlegen. Erfolg: Bestellung über finalizeOrder. Ablehnung:
 * past_due mit Wiederholung, nach dem letzten Versuch Pause. Bestätigung nötig: past_due mit
 * offenem PaymentIntent, Mail mit Link ins Portal, Bestand bleibt sieben Tage reserviert.
 */
async function chargeAndOrder(
  row: SubscriptionRow,
  now: Date,
  settings: SubscriptionSettings,
): Promise<RenewalOutcome> {
  const db = aboDb();
  const [customer, paymentMethod, variants, pricing, initial] = await Promise.all([
    loadCustomerContact(row.customer_id),
    loadPaymentMethod(row.payment_method_id),
    loadVariants([row.variant_id]),
    loadPricingContext(),
    initialOrderInfo(row.id),
  ]);
  if (!customer) throw new Error("Kunde zum Abo fehlt");
  const variant = variants.get(row.variant_id);
  const address = readAddress(row.shipping_address);
  if (!variant || !variant.is_active || variant.products?.status !== "active" || !address) {
    await postpone(row, now, variant ? "address_missing" : "variant_unavailable");
    return "stock_missing";
  }
  const quote = quoteDelivery(row, variant, pricing, now);
  if (!quote.snapshot.shipping) {
    await postpone(row, now, "no_shipping_rate");
    return "stock_missing";
  }
  if (!paymentMethod) {
    return handleDeclined(row, now, settings, quote, null, "no_payment_method", null);
  }

  // Warenkorb als Klammer (converted, erscheint nicht als Abbrecher) und Checkout-Session
  const { data: cart, error: cartError } = await db
    .from("carts")
    .insert({
      customer_id: row.customer_id,
      email: customer.email,
      status: "converted",
      note: `Abo ${row.number}`,
      attribution: asJson({ source: "subscription", subscription_id: row.id }),
    })
    .select("id")
    .single();
  if (cartError || !cart) throw new Error(`Warenkorb nicht angelegt: ${cartError?.message}`);
  const snapshot = quote.snapshot;
  const { data: session, error: sessionError } = await db
    .from("checkout_sessions")
    .insert({
      cart_id: (cart as { id: string }).id,
      customer_id: row.customer_id,
      email: customer.email,
      phone: initial.phone,
      status: "processing",
      payment_provider: integrations().payments.name,
      amounts: asJson(snapshot),
      shipping_address: asJson(address),
      shipping_rate_id: snapshot.shipping!.id,
      shipping_method: asJson({
        id: snapshot.shipping!.id,
        name: snapshot.shipping!.name,
        price_cents: snapshot.shippingCents,
        list_price_cents: snapshot.shipping!.listPriceCents,
        delivery_time_text: snapshot.shipping!.deliveryTimeText,
      }),
      legal_versions: asJson(initial.legalVersions),
      marketing_opt_in: false,
      attribution: asJson({ source: "subscription", subscription_id: row.id }),
      expires_at: new Date(now.getTime() + 30 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (sessionError || !session) throw new Error(`Session nicht angelegt: ${sessionError?.message}`);
  const sessionId = (session as { id: string }).id;

  const items = snapshot.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));
  const { error: reserveError } = await db.rpc("reserve_stock", {
    p_checkout_session_id: sessionId,
    p_items: items,
    p_ttl: "30 minutes",
  });
  if (reserveError) {
    await db.from("checkout_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    if (reserveError.message.includes("INSUFFICIENT_STOCK")) {
      await postpone(row, now, "stock_missing");
      return "stock_missing";
    }
    throw new Error(`Reservierung fehlgeschlagen: ${reserveError.message}`);
  }

  const attempt = row.retry_count + 1;
  const metadata: Record<string, string> = {
    checkout_session_id: sessionId,
    subscription_id: row.id,
    subscription_number: row.number,
    order_source: "subscription",
    scheduled_for: row.next_order_at ?? now.toISOString(),
    ...(quote.newLockedPriceCents !== null
      ? { locked_price_cents: String(quote.newLockedPriceCents) }
      : {}),
    ...(quote.clearNotice ? { clear_notice: "1" } : {}),
  };
  const payments = integrations().payments;
  const result = await payments.chargeOffSession({
    amountCents: snapshot.totalCents,
    currency: "eur",
    providerCustomerId: paymentMethod.stripe_customer_id,
    paymentMethodId: paymentMethod.stripe_payment_method_id,
    description: `provibe Abo ${row.number}`,
    metadata,
    // je Termin, Versuch und Zahlungsmittel eindeutig (neues Zahlungsmittel = neuer Versuch)
    idempotencyKey: `subscription:${row.id}:${row.next_order_at ?? "jetzt"}:${attempt}:${paymentMethod.id}`,
  });
  if (result.intentId) {
    await db
      .from("checkout_sessions")
      .update({ payment_intent_id: result.intentId })
      .eq("id", sessionId);
  }

  if (result.status === "succeeded") {
    const finalized = await finalizeOrder(
      {
        id: result.intentId,
        amount: result.amountCents,
        currency: "eur",
        status: "succeeded",
        metadata,
        payment_method_types: [result.paymentMethodType],
      },
      {
        method: paymentMethod.type === "paypal" ? "paypal" : "card",
        brand: paymentMethod.brand,
        last4: paymentMethod.last4,
      },
    );
    if (finalized.status === "failed") throw new Error(finalized.message);
    return "ordered";
  }

  if (result.status === "requires_action") {
    // Bestand bis zur Bestätigung halten (höchstens sieben Tage)
    await db.rpc("reserve_stock", {
      p_checkout_session_id: sessionId,
      p_items: items,
      p_ttl: "7 days",
    });
    await db
      .from("checkout_sessions")
      .update({ expires_at: new Date(now.getTime() + 7 * 86_400_000).toISOString() })
      .eq("id", sessionId);
    const updated = await applySubscription({
      id: row.id,
      expected: ["active", "past_due"],
      patch: {
        status: "past_due",
        pending_payment_intent_id: result.intentId,
        last_payment_error: "authentication_required",
        last_payment_failed_at: now.toISOString(),
        past_due_since: row.past_due_since ?? now.toISOString(),
        next_retry_at: null,
      },
      event: { kind: "payment_action_required", data: { intent_id: result.intentId } },
      actor: { type: "system" },
    });
    const base = await mailBase(customer.firstName);
    await sendAboMail({
      to: customer.email,
      mail: authenticationRequiredEmail(base, mailSubscription(updated, quote), {
        subscriptionId: row.id,
        dueDate: new Date(row.next_order_at ?? now),
      }),
      template: "subscription_authentication_required",
      idempotencyKey: `subscription_auth:${result.intentId}`,
    });
    return "action_required";
  }

  await db.rpc("release_reservations", { p_checkout_session_id: sessionId });
  await db.from("checkout_sessions").update({ status: "failed" }).eq("id", sessionId);
  return handleDeclined(row, now, settings, quote, paymentMethod, result.code, result.intentId);
}

async function handleDeclined(
  row: SubscriptionRow,
  now: Date,
  settings: SubscriptionSettings,
  quote: DeliveryQuote,
  paymentMethod: PaymentMethodRow | null,
  code: string,
  intentId: string | null,
): Promise<RenewalOutcome> {
  const failedAttempts = row.retry_count + 1;
  const firstFailed = row.past_due_since ? new Date(row.past_due_since) : now;
  const decision = retryDecision(settings.retryDays, failedAttempts, firstFailed);
  const customer = await loadCustomerContact(row.customer_id);
  let updated: SubscriptionRow;
  if (decision.action === "retry") {
    updated = await applySubscription({
      id: row.id,
      expected: ["active", "past_due"],
      patch: {
        status: "past_due",
        retry_count: failedAttempts,
        last_payment_error: code,
        last_payment_failed_at: now.toISOString(),
        past_due_since: firstFailed.toISOString(),
        next_retry_at: decision.at.toISOString(),
        pending_payment_intent_id: null,
      },
      event: {
        kind: "payment_failed",
        data: {
          code,
          intent_id: intentId,
          attempt: failedAttempts,
          next_retry_at: decision.at.toISOString(),
        },
      },
      actor: { type: "system" },
    });
    await enqueueSubscriptionJob({
      kind: "subscription.retry",
      payload: { subscription_id: row.id },
      idempotencyKey: `subscription.retry:${row.id}:${firstFailed.toISOString()}:${failedAttempts}`,
      runAt: decision.at.toISOString(),
    });
  } else {
    updated = await applySubscription({
      id: row.id,
      expected: ["active", "past_due"],
      patch: {
        status: "paused",
        pause_reason: "payment_failed",
        paused_until: null,
        retry_count: failedAttempts,
        last_payment_error: code,
        last_payment_failed_at: now.toISOString(),
        past_due_since: firstFailed.toISOString(),
        next_retry_at: null,
        pending_payment_intent_id: null,
      },
      event: { kind: "paused", data: { reason: "payment_failed", code, attempt: failedAttempts } },
      actor: { type: "system" },
    });
  }
  if (customer) {
    const base = await mailBase(customer.firstName);
    await sendAboMail({
      to: customer.email,
      mail: paymentFailedEmail(base, mailSubscription(updated, quote), {
        paymentLabel: paymentMethodLabel(paymentMethod),
        dueSince: firstFailed,
        retryDates:
          decision.action === "retry"
            ? remainingRetryDates(settings.retryDays, failedAttempts, firstFailed)
            : [],
        paused: decision.action === "pause",
        subscriptionId: row.id,
      }),
      template:
        decision.action === "pause" ? "subscription_paused_payment" : "subscription_payment_failed",
      idempotencyKey: `subscription_payment_failed:${row.id}:${firstFailed.toISOString()}:${failedAttempts}`,
    });
  }
  return decision.action === "pause" ? "paused_after_failures" : "declined";
}

/** Lieferung um einen Tag verschieben (Bestand fehlt, Variante nicht aktiv, Adresse fehlt). */
async function postpone(row: SubscriptionRow, now: Date, reason: string) {
  await applySubscription({
    id: row.id,
    expected: [row.status],
    patch: { next_order_at: addDeliveryDays(now, 1).toISOString() },
    event: { kind: "stock_missing", data: { reason, original_date: row.next_order_at } },
    actor: { type: "system" },
  });
}

/* ---------- Bestätigung einer offenen Zahlung (3-D Secure) ---------- */

export type ConfirmResult =
  | { status: "confirmed" }
  | { status: "client_action"; clientSecret: string }
  | { status: "nothing_pending" };

/**
 * Kunde bestätigt im Portal. Live: das client_secret geht an Stripe.js (handleNextAction), die
 * Bestellung entsteht danach im Webhook. Mock: die Bestätigung gilt als erfolgreich und die
 * Bestellung entsteht sofort über denselben Weg wie beim Webhook.
 */
export async function confirmPendingPayment(row: SubscriptionRow): Promise<ConfirmResult> {
  const intentId = row.pending_payment_intent_id;
  if (!intentId || row.status !== "past_due") return { status: "nothing_pending" };
  const payments = integrations().payments;
  if (payments.name !== "mock") {
    const intent = await payments.retrievePaymentIntent(intentId);
    if (intent.status === "succeeded") return { status: "confirmed" };
    return { status: "client_action", clientSecret: intent.clientSecret };
  }
  const { data: session } = await aboDb()
    .from("checkout_sessions")
    .select("id, amounts")
    .eq("payment_intent_id", intentId)
    .maybeSingle();
  const s = session as { id: string; amounts: { totalCents?: number } | null } | null;
  if (!s) return { status: "nothing_pending" };
  const mock = payments as MockPaymentProvider;
  if (mock.hasIntent(intentId)) mock.simulateSuccess(intentId, "card");
  const pm = await loadPaymentMethod(row.payment_method_id);
  const result = await finalizeOrder(
    {
      id: intentId,
      amount: s.amounts?.totalCents ?? 0,
      currency: "eur",
      status: "succeeded",
      metadata: {
        checkout_session_id: s.id,
        subscription_id: row.id,
        subscription_number: row.number,
        order_source: "subscription",
        scheduled_for: row.next_order_at ?? new Date().toISOString(),
      },
    },
    { method: pm?.type === "paypal" ? "paypal" : "card", brand: pm?.brand, last4: pm?.last4 },
  );
  if (result.status === "failed") throw new Error(result.message);
  return { status: "confirmed" };
}

/* ---------- Erinnerung "Deine nächste Lieferung" ---------- */

/** Täglich (Job subscription.reminder): Mail drei Tage vor der Lieferung. */
export async function sendDueReminders(now: Date = new Date()): Promise<{ sent: number }> {
  const settings = await loadSubscriptionSettings();
  const until = new Date(now.getTime() + (settings.reminderDays + 1) * 86_400_000);
  const { data, error } = await aboDb()
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .eq("skip_next", false)
    .gt("next_order_at", now.toISOString())
    .lte("next_order_at", until.toISOString())
    .limit(500);
  if (error) throw new Error(`Erinnerungen nicht geladen: ${error.message}`);
  const due = ((data ?? []) as SubscriptionRow[]).filter((s) =>
    reminderDue(s, now, settings.reminderDays),
  );
  if (due.length === 0) return { sent: 0 };
  const [variants, pricing] = await Promise.all([
    loadVariants(due.map((s) => s.variant_id)),
    loadPricingContext(),
  ]);
  let sent = 0;
  for (const row of due) {
    const variant = variants.get(row.variant_id);
    const customer = await loadCustomerContact(row.customer_id);
    if (!variant || !customer) continue;
    const quote = quoteDelivery(row, variant, pricing, now);
    const pm = await loadPaymentMethod(row.payment_method_id);
    const address = readAddress(row.shipping_address);
    const deliveryDate = new Date(row.next_order_at!);
    const daysBefore = Math.max(
      1,
      Math.round((deliveryDate.getTime() - now.getTime()) / 86_400_000),
    );
    const status = await sendAboMail({
      to: customer.email,
      mail: nextDeliveryEmail(await mailBase(customer.firstName), mailSubscription(row, quote), {
        deliveryDate,
        daysBefore,
        addressLine: address ? formatAddressLine(address) : "wie hinterlegt",
        paymentLabel: paymentMethodLabel(pm),
        subscriptionId: row.id,
      }),
      template: "subscription_next_delivery",
      idempotencyKey: `subscription_reminder:${row.id}:${row.next_order_at}`,
    });
    try {
      await applySubscription({
        id: row.id,
        expected: ["active"],
        patch: { reminder_sent_for: row.next_order_at },
        event: { kind: "reminder_sent", data: { delivery: row.next_order_at, mail: status } },
        actor: { type: "system" },
      });
      sent += 1;
    } catch (err) {
      await recordSubscriptionEvent(row.id, "reminder_error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { sent };
}
