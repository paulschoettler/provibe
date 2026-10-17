import "server-only";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import type { VerifiedWebhookEvent } from "@/lib/integrations/payments/types";
import { asJson, checkoutDb, UNIQUE_VIOLATION } from "./db";
import { enqueueJob, runJobsNow, type CheckoutJobKind } from "./jobs";
import { readSnapshot, type CheckoutSessionRow } from "./session";
import { buildOrderItems, orderTaxLines } from "./snapshot";

/**
 * Bestellung anlegen. Einziger Weg: ein bestätigtes payment_intent.succeeded (Stripe-Webhook mit
 * Signaturprüfung; beim Mock ruft die Server Action denselben Weg mit einem simulierten Event auf).
 * Idempotent über webhook_events(provider, event_id), orders.payment_intent_id (unique) und
 * checkout_sessions.order_id. Kein Auftrag nur aufgrund eines Client-Redirects (Briefing 4).
 */

export interface PaymentDetails {
  /** card, paypal, klarna, apple_pay, google_pay, ... */
  method?: string | null;
  brand?: string | null;
  last4?: string | null;
}

interface IntentObject {
  id: string;
  amount: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, string>;
  payment_method_types?: string[];
}

export type ProcessResult =
  | { status: "order_created" | "order_exists"; orderId: string; sessionId: string }
  | { status: "duplicate" | "ignored" }
  | { status: "failed"; message: string };

/** Verifiziertes Zahlungs-Event verarbeiten (Webhook-Route und Mock-Pfad). */
export async function processPaymentEvent(
  event: VerifiedWebhookEvent,
  details: PaymentDetails = {},
): Promise<ProcessResult> {
  const db = checkoutDb();
  const provider = integrations().payments.name;

  const { error: insertError } = await db.from("webhook_events").insert({
    provider,
    event_id: event.id,
    event_type: event.type,
    payload: asJson(event.data),
  });
  if (insertError) {
    if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
    const { data: existing } = await db
      .from("webhook_events")
      .select("processed_at, order_id")
      .eq("provider", provider)
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing?.processed_at) return { status: "duplicate" };
  }

  let result: ProcessResult = { status: "ignored" };
  let processingError: string | null = null;
  try {
    const intent = (event.data as { object?: IntentObject })?.object;
    if (event.type === "payment_intent.succeeded" && intent) {
      result = await finalizeOrder(intent, details);
    } else if (event.type === "payment_intent.payment_failed" && intent) {
      await markSessionFailed(intent.metadata?.checkout_session_id, intent.id);
    }
  } catch (error) {
    processingError = error instanceof Error ? error.message : String(error);
    result = { status: "failed", message: processingError };
  }

  await db
    .from("webhook_events")
    .update({
      processed_at: processingError ? null : new Date().toISOString(),
      processing_error: processingError,
      order_id: "orderId" in result ? result.orderId : null,
    })
    .eq("provider", provider)
    .eq("event_id", event.id);

  return result;
}

async function markSessionFailed(sessionId: string | undefined, intentId: string) {
  if (!sessionId) return;
  await checkoutDb()
    .from("checkout_sessions")
    .update({ status: "failed" })
    .eq("id", sessionId)
    .eq("payment_intent_id", intentId)
    .in("status", ["open", "processing"]);
}

export async function finalizeOrder(
  intent: IntentObject,
  details: PaymentDetails,
): Promise<ProcessResult> {
  const db = checkoutDb();
  const sessionId = intent.metadata?.checkout_session_id;
  if (!sessionId) throw new Error(`PaymentIntent ${intent.id} ohne checkout_session_id`);

  // Schon verarbeitet? (paralleler Webhook oder Wiederholung)
  const { data: existingOrder } = await db
    .from("orders")
    .select("id")
    .eq("payment_intent_id", intent.id)
    .maybeSingle();
  if (existingOrder) return { status: "order_exists", orderId: existingOrder.id, sessionId };

  const { data: session } = await db
    .from("checkout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new Error(`Checkout-Session ${sessionId} nicht gefunden`);
  if (session.order_id) return { status: "order_exists", orderId: session.order_id, sessionId };

  const snapshot = readSnapshot(session.amounts);
  if (!snapshot || !session.email || !session.shipping_address) {
    throw new Error(`Checkout-Session ${sessionId} unvollständig`);
  }
  // Bezahlt ist bezahlt: Abweichungen werden markiert, die Bestellung entsteht trotzdem
  const amountMismatch = intent.amount !== snapshot.totalCents;

  const env = serverEnv();
  const isTest =
    integrations().payments.name === "mock" ||
    !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "") ||
    env.APP_STAGE !== "production";

  const customerId = await upsertCustomer(session);
  const paidAt = new Date().toISOString();
  const method = details.method ?? intent.payment_method_types?.[0] ?? "card";

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      status: "paid",
      payment_status: "paid",
      customer_id: customerId,
      email: session.email,
      phone: session.phone,
      subtotal_cents: snapshot.subtotalCents,
      discount_cents: snapshot.discountCents,
      shipping_cents: snapshot.shippingCents,
      deposit_cents: snapshot.depositCents,
      tax_cents: snapshot.taxCents,
      total_cents: snapshot.totalCents,
      tax_lines: asJson(orderTaxLines(snapshot)),
      shipping_address: session.shipping_address,
      billing_address: session.billing_address,
      shipping_rate_id: snapshot.shipping?.id ?? session.shipping_rate_id,
      shipping_rate_name: snapshot.shipping?.name ?? null,
      discount_code: snapshot.discountCode,
      discount_code_id: snapshot.discountCodeId,
      payment_provider: session.payment_provider,
      payment_intent_id: intent.id,
      payment_method_type: method === "apple_pay" || method === "google_pay" ? "card" : method,
      paid_at: paidAt,
      checkout_session_id: session.id,
      cart_id: session.cart_id,
      legal_versions: session.legal_versions ?? {},
      attribution: session.attribution,
      is_test: isTest,
      source: "web",
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    if (orderError?.code === UNIQUE_VIOLATION) {
      const { data: raced } = await db
        .from("orders")
        .select("id")
        .eq("payment_intent_id", intent.id)
        .maybeSingle();
      if (raced) return { status: "order_exists", orderId: raced.id, sessionId };
    }
    throw new Error(`Bestellung nicht angelegt: ${orderError?.message}`);
  }

  const items = buildOrderItems(snapshot, order.id);
  const { error: itemsError } = await db
    .from("order_items")
    .insert(items.map((i) => ({ ...i, components: i.components ? asJson(i.components) : null })));
  if (itemsError) throw new Error(`Positionen nicht angelegt: ${itemsError.message}`);

  // Reservierung in Abgang wandeln (inventory_movements, reason sale)
  const { error: commitError } = await db.rpc("commit_reservations", {
    p_checkout_session_id: session.id,
    p_order_id: order.id,
  });
  if (commitError)
    console.error("[checkout] Bestandsabbuchung fehlgeschlagen", commitError.message);

  if (snapshot.discountCodeId) {
    await db.from("discount_redemptions").insert({
      discount_code_id: snapshot.discountCodeId,
      order_id: order.id,
      customer_id: customerId,
      email: session.email,
      amount_cents: snapshot.discountCents,
    });
  }

  await db.from("order_events").insert([
    {
      order_id: order.id,
      kind: "created",
      message: `Bestellung ${order.order_number} angelegt`,
      data: asJson({ checkout_session_id: session.id, source: "web" }),
      visible_to_customer: true,
    },
    {
      order_id: order.id,
      kind: "paid",
      message: amountMismatch
        ? `Zahlung erhalten, Betrag weicht ab (${intent.amount} statt ${snapshot.totalCents} Cent)`
        : "Zahlung erhalten",
      data: asJson({
        payment_intent_id: intent.id,
        amount_cents: intent.amount,
        method,
        brand: details.brand ?? null,
        last4: details.last4 ?? null,
        amount_mismatch: amountMismatch,
      }),
      visible_to_customer: true,
    },
  ]);
  if (isTest) {
    await db.from("order_notes").insert({
      order_id: order.id,
      body: "TEST (automatisch: Testmodus, keine echte Zahlung)",
    });
  }

  await Promise.all([
    db
      .from("checkout_sessions")
      .update({ status: "completed", order_id: order.id, completed_at: paidAt })
      .eq("id", session.id),
    db
      .from("carts")
      .update({ status: "converted", converted_order_id: order.id })
      .eq("id", session.cart_id),
  ]);

  await runPostOrderJobs(order.id, session.marketing_opt_in);
  return { status: "order_created", orderId: order.id, sessionId: session.id };
}

/** Kunde anhand der E-Mail finden oder als Gast anlegen (Mini-CRM, Konto bleibt optional). */
async function upsertCustomer(session: CheckoutSessionRow): Promise<string | null> {
  if (session.customer_id) return session.customer_id;
  const db = checkoutDb();
  const email = session.email!.toLowerCase();
  const address = (session.shipping_address ?? {}) as { first_name?: string; last_name?: string };
  const attribution = (session.attribution ?? {}) as Record<string, unknown>;

  await db.from("customers").upsert(
    {
      email,
      first_name: address.first_name ?? null,
      last_name: address.last_name ?? null,
      phone: session.phone,
      acquisition_source:
        typeof attribution.utm_source === "string" ? attribution.utm_source : "web",
      acquisition_details: asJson(attribution),
    },
    { onConflict: "email", ignoreDuplicates: true },
  );
  const { data } = await db.from("customers").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

/** Mails, Rechnung, Newsletter und Tracking als Jobs anlegen und sofort einmal versuchen. */
async function runPostOrderJobs(orderId: string, marketingOptIn: boolean): Promise<void> {
  const jobs: { kind: CheckoutJobKind; priority: number }[] = [
    { kind: "email.order_confirmation", priority: 10 },
    { kind: "email.payment_confirmation", priority: 20 },
    { kind: "email.order_internal", priority: 30 },
    { kind: "lexware.create_invoice", priority: 40 },
    ...(marketingOptIn ? [{ kind: "newsletter.checkout_opt_in" as const, priority: 60 }] : []),
    { kind: "tracking.purchase", priority: 80 },
  ];
  const ids: (string | null)[] = [];
  for (const job of jobs) {
    ids.push(
      await enqueueJob({
        kind: job.kind,
        payload: { order_id: orderId },
        idempotencyKey: `${job.kind}:${orderId}`,
        priority: job.priority,
        orderId,
      }),
    );
  }
  await runJobsNow(ids);
}
