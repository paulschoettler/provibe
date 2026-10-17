import "server-only";
import { sendLoginLink } from "@/lib/auth/links";
import { readAddress, readSnapshot, type CheckoutSessionRow } from "@/lib/checkout/session";
import type { SnapshotLine } from "@/lib/checkout/types";
import { integrations } from "@/lib/integrations";
import type { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import type { SavedPaymentMethod } from "@/lib/integrations/payments/types";
import { loadPricingContext, loadVariants, quoteDelivery } from "./catalog";
import { aboDb, applySubscription, asJson } from "./db";
import { subscriptionStartedEmail } from "./emails";
import {
  loadCustomerContact,
  mailBase,
  mailSubscription,
  paymentMethodLabel,
  sendAboMail,
} from "./mailer";
import { firstNextOrderAt, nextOrderAfterDelivery } from "./schedule";
import type { PaymentMethodRow, SubscriptionRow } from "./types";

/**
 * Verbindung zwischen Bestellanlage (src/lib/checkout/finalize.ts) und Abo. Läuft nach jeder
 * neu angelegten Bestellung, im Webhook wie im Mock-Pfad, und ist idempotent:
 *
 *  - Erste Bestellung mit Abo-Positionen: je Position ein Abo anlegen (draft → active), das
 *    Zahlungsmittel speichern, Mail "Abo gestartet", Kunden ohne Login bekommen den Magic Link.
 *  - Folgelieferung (PaymentIntent mit metadata.subscription_id aus dem Abo-Lauf): Bestellung
 *    verknüpfen und den nächsten Termin fortschreiben.
 *
 * Ein Fehler hier lässt die Bestellung bestehen (sie ist bezahlt) und wird an der Bestellung
 * vermerkt, damit das Backoffice nacharbeiten kann.
 */

export interface FinalizedOrderContext {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  session: CheckoutSessionRow;
  intent: {
    id: string;
    metadata?: Record<string, string>;
    payment_method?: unknown;
    customer?: unknown;
  };
  details: { method?: string | null; brand?: string | null; last4?: string | null };
}

export async function onOrderFinalized(ctx: FinalizedOrderContext): Promise<void> {
  try {
    const subscriptionId = ctx.intent.metadata?.subscription_id;
    if (subscriptionId) {
      await completeRenewal(subscriptionId, ctx);
      return;
    }
    const snapshot = readSnapshot(ctx.session.amounts);
    const aboLines = snapshot?.lines.filter((l) => l.subscription) ?? [];
    if (aboLines.length > 0) await createSubscriptionsFromOrder(ctx, aboLines);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[abo] Abo zur Bestellung nicht verarbeitet", ctx.orderId, message);
    await aboDb()
      .from("order_events")
      .insert({
        order_id: ctx.orderId,
        kind: "subscription_error",
        message: `Abo konnte nicht verarbeitet werden: ${message.slice(0, 300)}`,
        data: asJson({ intent_id: ctx.intent.id }),
        visible_to_customer: false,
      });
  }
}

/* ---------- Erste Bestellung: Abos anlegen ---------- */

async function createSubscriptionsFromOrder(ctx: FinalizedOrderContext, lines: SnapshotLine[]) {
  const db = aboDb();
  const { data: existing } = await db
    .from("subscription_orders")
    .select("subscription_id")
    .eq("order_id", ctx.orderId)
    .eq("kind", "initial");
  if ((existing ?? []).length > 0) return; // schon angelegt (paralleler Webhook)
  if (!ctx.customerId) throw new Error("Bestellung ohne Kunde, Abo braucht ein Konto");

  const customer = await loadCustomerContact(ctx.customerId);
  if (!customer) throw new Error("Kunde zur Bestellung nicht gefunden");
  const paymentMethod = await savePaymentMethodFromOrder(ctx, customer.email);
  const now = new Date();
  const address = readAddress(ctx.session.shipping_address);

  const created: SubscriptionRow[] = [];
  for (const line of lines) {
    const info = line.subscription!;
    const { data: row, error } = await db
      .from("subscriptions")
      .insert({
        customer_id: ctx.customerId,
        status: "draft",
        variant_id: line.variantId,
        quantity: line.quantity,
        interval_unit: "week",
        interval_count: info.intervalWeeks,
        discount_bp: info.discountBp,
        stripe_customer_id: paymentMethod?.stripe_customer_id ?? null,
        payment_method_id: paymentMethod?.id ?? null,
        shipping_address: asJson(address),
        // Variantenpreis inklusive Pfand, wie er im Katalog steht (Preisbindung)
        locked_price_cents: info.listUnitPriceCents + line.unitDepositCents,
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(`Abo nicht angelegt: ${error?.message}`);
    const sub = row as SubscriptionRow;
    await db
      .from("subscription_orders")
      .insert({ subscription_id: sub.id, order_id: ctx.orderId, kind: "initial" });
    const active = await applySubscription({
      id: sub.id,
      expected: ["draft"],
      patch: {
        status: "active",
        last_order_at: now.toISOString(),
        next_order_at: firstNextOrderAt(now, info.intervalWeeks).toISOString(),
      },
      event: {
        kind: "created",
        data: {
          order_id: ctx.orderId,
          order_number: ctx.orderNumber,
          interval_weeks: info.intervalWeeks,
          discount_bp: info.discountBp,
          quantity: line.quantity,
          variant_id: line.variantId,
        },
      },
      actor: { type: "customer", id: customer.authUserId },
    });
    created.push(active);
  }

  await db.from("order_events").insert({
    order_id: ctx.orderId,
    kind: "subscription_created",
    message: `Abo ${created.map((s) => s.number).join(", ")} angelegt`,
    data: asJson({ subscription_ids: created.map((s) => s.id) }),
    visible_to_customer: true,
  });

  // Konto-Pflicht: Wer nicht eingeloggt bestellt hat, bekommt den Link ins Konto (Magic Link).
  let loginHint = false;
  if (!customer.authUserId) {
    const result = await sendLoginLink(customer.email, "/account/abo").catch(
      () => "error" as const,
    );
    loginHint = result === "sent" || result === "activation";
  }

  const [variants, pricing] = await Promise.all([
    loadVariants(created.map((s) => s.variant_id)),
    loadPricingContext(),
  ]);
  const base = await mailBase(customer.firstName ?? address?.first_name ?? null);
  for (const sub of created) {
    const variant = variants.get(sub.variant_id);
    if (!variant) continue;
    const quote = quoteDelivery(sub, variant, pricing, now);
    const mail = subscriptionStartedEmail(base, mailSubscription(sub, quote), {
      nextDelivery: new Date(sub.next_order_at!),
      orderNumber: ctx.orderNumber,
      paymentLabel: paymentMethodLabel(paymentMethod),
      loginHint,
    });
    await sendAboMail({
      to: customer.email,
      mail,
      template: "subscription_started",
      idempotencyKey: `subscription_started:${sub.id}`,
    });
  }
}

/**
 * Zahlungsmittel der ersten Bestellung speichern. Live: Stripe hat es über setup_future_usage am
 * Kunden hinterlegt (intent.payment_method, intent.customer). Mock: Testzahlungsmittel aus den
 * Angaben der Testkarte, damit der Abo-Lauf dieselben Fälle simulieren kann.
 */
async function savePaymentMethodFromOrder(
  ctx: FinalizedOrderContext,
  email: string,
): Promise<PaymentMethodRow | null> {
  const payments = integrations().payments;
  let method: SavedPaymentMethod | null = null;
  let providerCustomerId: string | null =
    typeof ctx.intent.customer === "string" ? ctx.intent.customer : null;

  if (payments.name === "mock") {
    const mock = payments as MockPaymentProvider;
    const wallet =
      ctx.details.method === "apple_pay"
        ? "Apple Pay"
        : ctx.details.method === "google_pay"
          ? "Google Pay"
          : null;
    method = mock.createTestPaymentMethod({
      type: ctx.details.method === "paypal" ? "paypal" : "card",
      last4: ctx.details.last4 ?? "4242",
      brand: wallet ?? ctx.details.brand ?? "Visa",
    });
    providerCustomerId = (await payments.ensureCustomer({ email })).id;
  } else {
    const pmId = typeof ctx.intent.payment_method === "string" ? ctx.intent.payment_method : null;
    if (!pmId) return null;
    method = await payments.retrievePaymentMethod(pmId);
    providerCustomerId ??= (await payments.ensureCustomer({ email })).id;
  }
  if (!method || !providerCustomerId) return null;
  return storePaymentMethod(ctx.customerId!, providerCustomerId, method);
}

/** Zahlungsmittel in customer_payment_methods speichern (idempotent über die Stripe-ID). */
export async function storePaymentMethod(
  customerId: string,
  providerCustomerId: string,
  method: SavedPaymentMethod,
): Promise<PaymentMethodRow> {
  const db = aboDb();
  const { data, error } = await db
    .from("customer_payment_methods")
    .upsert(
      {
        customer_id: customerId,
        stripe_customer_id: providerCustomerId,
        stripe_payment_method_id: method.id,
        type: method.type,
        brand: method.brand,
        last4: method.last4,
        exp_month: method.expMonth,
        exp_year: method.expYear,
        is_default: true,
      },
      { onConflict: "stripe_payment_method_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error(`Zahlungsmittel nicht gespeichert: ${error?.message}`);
  const row = data as PaymentMethodRow;
  await db
    .from("customer_payment_methods")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .neq("id", row.id);
  return row;
}

/* ---------- Folgelieferung: verknüpfen und Termin fortschreiben ---------- */

async function completeRenewal(subscriptionId: string, ctx: FinalizedOrderContext) {
  const db = aboDb();
  const { error: linkError } = await db
    .from("subscription_orders")
    .insert({ subscription_id: subscriptionId, order_id: ctx.orderId, kind: "renewal" });
  if (linkError) {
    if (linkError.code === "23505") return; // schon verknüpft (Webhook und Abo-Lauf parallel)
    throw new Error(`Abo-Bestellung nicht verknüpft: ${linkError.message}`);
  }
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  const row = data as SubscriptionRow | null;
  if (!row) throw new Error(`Abo ${subscriptionId} nicht gefunden`);

  const now = new Date();
  const scheduled = ctx.intent.metadata?.scheduled_for
    ? new Date(ctx.intent.metadata.scheduled_for)
    : row.next_order_at
      ? new Date(row.next_order_at)
      : null;
  const locked = Number(ctx.intent.metadata?.locked_price_cents ?? NaN);
  const clearNotice = ctx.intent.metadata?.clear_notice === "1";
  await applySubscription({
    id: row.id,
    expected: ["active", "past_due", "paused"],
    patch: {
      status: row.status === "cancelled" ? row.status : "active",
      last_order_at: now.toISOString(),
      next_order_at: nextOrderAfterDelivery(scheduled, now, row.interval_count).toISOString(),
      retry_count: 0,
      last_payment_error: null,
      last_payment_failed_at: null,
      past_due_since: null,
      next_retry_at: null,
      pending_payment_intent_id: null,
      pause_reason: null,
      paused_until: null,
      processing_started_at: null,
      ...(Number.isFinite(locked) ? { locked_price_cents: locked } : {}),
      ...(clearNotice ? { price_notice_sent_at: null, price_change_effective_at: null } : {}),
    },
    event: {
      kind: "order_created",
      data: { order_id: ctx.orderId, order_number: ctx.orderNumber, intent_id: ctx.intent.id },
    },
    actor: { type: "system" },
  });
}
