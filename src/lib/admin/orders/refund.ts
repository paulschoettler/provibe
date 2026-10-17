import "server-only";
import { z } from "zod";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { enqueueAndRun } from "@/lib/admin/jobs/runner";
import { integrations } from "@/lib/integrations";
import { formatEur } from "@/lib/money";
import { addOrderEvent, asJson, ordersDb, requirePermission } from "./db";
import { AdminOrderError, validationError } from "./errors";
import {
  computeRefund,
  refundedShippingFromItems,
  toStoredRefundItems,
  type RefundComputation,
  type RefundOrderState,
} from "./refund-calc";
import { restockOrderItems } from "./restock";
import { checkTransition, MANUAL_PAYMENT_PROVIDER, type OrderStatus } from "./status";
import { applyTransition } from "./transition";

/**
 * Erstattung (Teil oder voll). Betrag serverseitig aus den Positions-Snapshots (refund-calc.ts),
 * Rückzahlung über den Zahlungsanbieter (Stripe, bis zur Freigabe Mock), bei manuellen
 * Bestellungen nur Verbuchung (Überweisung macht das Team). Danach payment_status
 * partially_refunded oder refunded, bei Vollerstattung Status "erstattet", optional Bestand
 * zurückbuchen (reason refund_restock), Mail "Erstattung" über die Job-Queue, Verlauf und Audit.
 */

export const refundInputSchema = z.object({
  lines: z
    .array(
      z.object({
        orderItemId: z.uuid(),
        quantity: z.number().int().min(0).max(10_000),
      }),
    )
    .max(200)
    .default([]),
  shippingCents: z.number().int().min(0).max(1_000_000).optional(),
  /** abweichender Betrag in Cent (Kulanz), höchstens der erstattbare Rest */
  amountCents: z.number().int().min(1).max(100_000_000).optional(),
  reason: z.string().trim().min(3, "Bitte gib einen Grund an.").max(500),
  restock: z.boolean(),
  /** Kunden per E-Mail informieren (Standard ja) */
  notifyCustomer: z.boolean().default(true),
});

export type RefundInput = z.input<typeof refundInputSchema>;

export interface RefundResult {
  refundId: string;
  amountCents: number;
  status: "succeeded" | "pending";
  paymentStatus: "partially_refunded" | "refunded";
  orderStatus: OrderStatus;
  restocked: { variantId: string; quantity: number }[];
  calculation: RefundComputation;
}

/** Erstattungsstand einer Bestellung laden (auch für die Vorschau im Erstattungsdialog). */
export async function loadRefundState(orderId: string) {
  const db = ordersDb();
  const [{ data: order }, { data: items }, { data: refunds }] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_provider, payment_intent_id, total_cents, shipping_cents, email, is_test",
      )
      .eq("id", orderId)
      .maybeSingle(),
    db
      .from("order_items")
      .select(
        "id, product_title, quantity, refunded_quantity, unit_price_cents, unit_deposit_cents, discount_cents",
      )
      .eq("order_id", orderId)
      .order("position"),
    db
      .from("refunds")
      .select("amount_cents, items, status")
      .eq("order_id", orderId)
      .in("status", ["pending", "succeeded"]),
  ]);
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  const state: RefundOrderState = {
    totalCents: order.total_cents,
    shippingCents: order.shipping_cents,
    refundedCents: (refunds ?? []).reduce((s, r) => s + r.amount_cents, 0),
    refundedShippingCents: (refunds ?? []).reduce(
      (s, r) => s + refundedShippingFromItems(r.items),
      0,
    ),
    items: (items ?? []).map((i) => ({
      id: i.id,
      title: i.product_title,
      quantity: i.quantity,
      refundedQuantity: i.refunded_quantity,
      unitPriceCents: i.unit_price_cents,
      unitDepositCents: i.unit_deposit_cents,
      discountCents: i.discount_cents,
    })),
  };
  return { order, state };
}

/** Vorschau für den Dialog: Vorschlag und Maximum ohne zu buchen. */
export async function previewRefund(
  orderId: string,
  input: Pick<RefundInput, "lines" | "shippingCents" | "amountCents">,
) {
  const { state } = await loadRefundState(orderId);
  return computeRefund(state, {
    lines: input.lines ?? [],
    shippingCents: input.shippingCents,
    amountCents: input.amountCents,
  });
}

function refundIdempotencyKey(
  orderId: string,
  refundedBefore: number,
  calc: RefundComputation,
): string {
  const sig = calc.lines.map((l) => `${l.orderItemId.slice(0, 8)}x${l.quantity}`).join(".");
  return `refund:${orderId}:${refundedBefore}:${calc.amountCents}:${calc.shippingCents}:${sig}`.slice(
    0,
    250,
  );
}

export async function createRefund(
  orderId: string,
  input: RefundInput,
  actor: StaffSession,
): Promise<RefundResult> {
  requirePermission(PERMISSIONS.refund(actor), "Erstattungen dürfen nur Owner und Admin auslösen.");
  if (!z.uuid().safeParse(orderId).success)
    throw new AdminOrderError("validation", "Ungültige Bestellung.");
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const data = parsed.data;

  const { order, state } = await loadRefundState(orderId);
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    throw new AdminOrderError(
      "validation",
      "Für diese Bestellung gibt es keine Zahlung, die erstattet werden kann.",
    );
  }
  const result = computeRefund(state, {
    lines: data.lines,
    shippingCents: data.shippingCents,
    amountCents: data.amountCents,
  });
  if (!result.ok) throw new AdminOrderError("validation", result.error);
  const calc = result.value;

  const manual = order.payment_provider === MANUAL_PAYMENT_PROVIDER;
  const payments = integrations().payments;
  if (!manual && !order.payment_intent_id) {
    throw new AdminOrderError("validation", "Zu dieser Bestellung fehlt die Zahlungsreferenz.");
  }
  const db = ordersDb();
  const storedItems = toStoredRefundItems(calc);

  // Doppelklick-Schutz: gleiche Erstattung, die gerade erst angestoßen wurde
  const { data: recent } = await db
    .from("refunds")
    .select("id")
    .eq("order_id", orderId)
    .eq("amount_cents", calc.amountCents)
    .in("status", ["pending", "succeeded"])
    .gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .limit(1);
  if (recent && recent.length > 0) {
    throw new AdminOrderError(
      "conflict",
      "Eine gleich hohe Erstattung wurde gerade erst ausgelöst. Bitte prüfe den Verlauf, bevor du es erneut versuchst.",
    );
  }

  // 1. Erstattung vormerken (pending), damit parallele Erstattungen den Betrag schon sehen
  const { data: row, error: insertError } = await db
    .from("refunds")
    .insert({
      order_id: orderId,
      provider: manual ? MANUAL_PAYMENT_PROVIDER : payments.name,
      amount_cents: calc.amountCents,
      reason: data.reason,
      items: asJson(storedItems),
      restock: data.restock,
      status: "pending",
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (insertError || !row) throw new Error(`Erstattung nicht angelegt: ${insertError?.message}`);

  // 2. Geld zurück (Stripe) oder bei Rechnung nur verbuchen
  let status: "succeeded" | "pending" = "succeeded";
  let providerRefundId: string | null = null;
  if (!manual) {
    try {
      const ref = await payments.createRefund({
        paymentIntentId: order.payment_intent_id!,
        amountCents: calc.amountCents,
        reason: "requested_by_customer",
        idempotencyKey: refundIdempotencyKey(orderId, state.refundedCents, calc),
        metadata: { order_id: orderId, order_number: order.order_number, refund_id: row.id },
      });
      if (ref.status === "failed" || ref.status === "canceled") {
        throw new Error(`Zahlungsanbieter meldet ${ref.status}`);
      }
      status = ref.status === "succeeded" ? "succeeded" : "pending";
      providerRefundId = ref.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.from("refunds").update({ status: "failed" }).eq("id", row.id);
      await addOrderEvent(orderId, {
        kind: "refund_failed",
        message: `Erstattung über ${formatEur(calc.amountCents)} fehlgeschlagen`,
        data: { refund_id: row.id, error: message.slice(0, 500) },
        actor,
      });
      await writeAudit(actor, {
        action: "order.refund_failed",
        entityType: "order",
        entityId: orderId,
        after: { refund_id: row.id, amount_cents: calc.amountCents },
      });
      throw new AdminOrderError("provider", `Die Erstattung wurde abgelehnt: ${message}`);
    }
  }

  const { error: updateError } = await db
    .from("refunds")
    .update({ status, provider_refund_id: providerRefundId })
    .eq("id", row.id);
  if (updateError) {
    // Doppelklick: derselbe Stripe-Refund ist schon an einer anderen Zeile verbucht
    if (updateError.code === "23505") {
      await db.from("refunds").delete().eq("id", row.id).eq("status", "pending");
      throw new AdminOrderError("conflict", "Diese Erstattung wurde bereits ausgeführt.");
    }
    throw new Error(`Erstattung nicht gespeichert: ${updateError.message}`);
  }

  // 3. Positionen fortschreiben (optimistisch je Position)
  for (const line of calc.lines) {
    const item = state.items.find((i) => i.id === line.orderItemId)!;
    await db
      .from("order_items")
      .update({ refunded_quantity: item.refundedQuantity + line.quantity })
      .eq("id", item.id)
      .eq("refunded_quantity", item.refundedQuantity);
  }

  // 4. Zahl- und Bestellstatus
  const paymentStatus = calc.isFull ? "refunded" : "partially_refunded";
  await db.from("orders").update({ payment_status: paymentStatus }).eq("id", orderId);
  let orderStatus = order.status as OrderStatus;
  if (
    calc.isFull &&
    checkTransition(orderStatus, "refunded", {
      paymentProvider: order.payment_provider,
      paymentStatus: "refunded",
    }).ok
  ) {
    const next = await applyTransition(
      { ...order, payment_status: "refunded" },
      "refunded",
      actor,
      { reason: data.reason, paymentStatus: "refunded" },
    );
    orderStatus = next.status;
  }

  // 5. Bestand zurückbuchen
  let restocked: { variantId: string; quantity: number }[] = [];
  if (data.restock && calc.lines.length > 0) {
    const capped = await restockOrderItems({
      orderId,
      orderNumber: order.order_number,
      lines: calc.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
      reason: "refund_restock",
      note: `Erstattung ${order.order_number}`,
      actor,
    });
    restocked = capped.apply;
  }

  // 6. Verlauf und Audit
  await addOrderEvent(orderId, {
    kind: "refund",
    message: `${calc.isFull ? "Vollerstattung" : "Teilerstattung"} über ${formatEur(calc.amountCents)}${manual ? " (manuell verbucht)" : ""}`,
    data: {
      refund_id: row.id,
      amount_cents: calc.amountCents,
      suggested_cents: calc.suggestedCents,
      overridden: calc.overridden,
      shipping_cents: calc.shippingCents,
      lines: storedItems,
      restock: data.restock,
      restocked,
      provider_refund_id: providerRefundId,
      status,
      reason: data.reason,
    },
    actor,
    visibleToCustomer: true,
  });
  await writeAudit(actor, {
    action: "order.refund",
    entityType: "order",
    entityId: orderId,
    before: { payment_status: order.payment_status, refunded_cents: state.refundedCents },
    after: {
      refund_id: row.id,
      amount_cents: calc.amountCents,
      payment_status: paymentStatus,
      status: orderStatus,
      restock: data.restock,
    },
  });

  // 7. Mail "Erstattung" (Queue, sofort versucht)
  if (data.notifyCustomer) {
    await enqueueAndRun({
      kind: "order.refund_mail",
      payload: { refund_id: row.id, order_id: orderId },
      idempotencyKey: `order.refund_mail:${row.id}`,
      orderId,
      priority: 20,
    });
  }

  return {
    refundId: row.id,
    amountCents: calc.amountCents,
    status,
    paymentStatus,
    orderStatus,
    restocked,
    calculation: calc,
  };
}
