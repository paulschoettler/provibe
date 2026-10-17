import "server-only";
import { z } from "zod";
import { hasRole, PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { addOrderEvent, ordersDb, requirePermission } from "./db";
import { AdminOrderError, validationError } from "./errors";
import { restockOrderItems } from "./restock";
import {
  checkTransition,
  MANUAL_PAYMENT_PROVIDER,
  ORDER_STATUSES,
  statusLabelLower,
  type OrderStatus,
  type PaymentStatus,
} from "./status";
import type { Database } from "@/lib/supabase/database.types";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

/** Wer darf welchen Zielstatus setzen (H19 und Briefing Abschnitt 8). */
export function canSetStatus(actor: StaffSession, to: OrderStatus): boolean {
  switch (to) {
    case "processing":
    case "shipped":
    case "delivered":
      return PERMISSIONS.fulfil(actor);
    case "cancelled":
    case "paid":
      return hasRole(actor, "admin");
    case "refunded":
    case "partially_refunded":
      return PERMISSIONS.refund(actor);
    default:
      return false;
  }
}

/** Sichtbar im Kundenkonto: Versand, Zustellung, Storno und Erstattung. */
const CUSTOMER_VISIBLE: OrderStatus[] = ["shipped", "delivered", "cancelled", "refunded"];

export interface OrderStateRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
}

export async function loadOrderState(orderId: string): Promise<OrderStateRow> {
  const { data } = await ordersDb()
    .from("orders")
    .select("id, order_number, status, payment_status, payment_provider")
    .eq("id", orderId)
    .maybeSingle();
  if (!data) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  return data;
}

/**
 * Einen Statuswechsel prüfen und schreiben (ohne Rollenprüfung, die macht der Aufrufer).
 * Optimistisch: Die Zeile wird nur geändert, wenn sie noch den erwarteten Ausgangsstatus hat.
 * Schreibt order_events (status_changed) und audit_log (order.status_change).
 */
export async function applyTransition(
  order: OrderStateRow,
  to: OrderStatus,
  actor: StaffSession | null,
  options: { reason?: string | null; extra?: OrderUpdate; paymentStatus?: PaymentStatus } = {},
): Promise<OrderStateRow> {
  const check = checkTransition(order.status, to, {
    paymentProvider: order.payment_provider,
    paymentStatus: options.paymentStatus ?? order.payment_status,
  });
  if (!check.ok) throw new AdminOrderError("invalid_transition", check.reason);

  const now = new Date().toISOString();
  const patch: OrderUpdate = { status: to, ...options.extra };
  if (to === "shipped") {
    patch.shipped_at = patch.shipped_at ?? now;
    patch.fulfillment_status = "fulfilled";
  }
  if (to === "delivered") patch.delivered_at = patch.delivered_at ?? now;
  if (to === "cancelled") {
    patch.cancelled_at = now;
    patch.cancel_reason = options.reason ?? null;
  }
  if (to === "paid" && order.payment_provider === MANUAL_PAYMENT_PROVIDER) {
    patch.payment_status = "paid";
    patch.paid_at = now;
  }

  const { data: updated, error } = await ordersDb()
    .from("orders")
    .update(patch)
    .eq("id", order.id)
    .eq("status", order.status)
    .select("id, order_number, status, payment_status, payment_provider");
  if (error) throw new Error(`Status konnte nicht gespeichert werden: ${error.message}`);
  if (!updated || updated.length === 0) {
    throw new AdminOrderError(
      "conflict",
      "Die Bestellung wurde inzwischen geändert. Bitte lade die Seite neu.",
    );
  }

  const message = `Status geändert: ${statusLabelLower(order.status)} → ${statusLabelLower(to)}`;
  await addOrderEvent(order.id, {
    kind: "status_changed",
    message,
    data: { from: order.status, to, ...(options.reason ? { reason: options.reason } : {}) },
    actor,
    visibleToCustomer: CUSTOMER_VISIBLE.includes(to),
  });
  await writeAudit(actor, {
    action: "order.status_change",
    entityType: "order",
    entityId: order.id,
    before: { status: order.status },
    after: { status: to, ...(options.reason ? { reason: options.reason } : {}) },
  });
  return updated[0];
}

const transitionSchema = z.object({
  orderId: z.uuid(),
  to: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
  reason: z.string().trim().max(500).optional(),
  restock: z.boolean().optional(),
});

/**
 * Statuswechsel aus dem Backoffice. Storno braucht einen Grund und bucht mit restock den Bestand
 * der noch nicht versendeten Ware zurück (reason correction). Eine bezahlte Bestellung bleibt nach
 * dem Storno "Erstattung offen", bis createRefund das Geld zurückgibt.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: StaffSession,
  reason?: string,
  options: { restock?: boolean } = {},
): Promise<{
  from: OrderStatus;
  to: OrderStatus;
  restocked: { variantId: string; quantity: number }[];
}> {
  const parsed = transitionSchema.safeParse({ orderId, to, reason, restock: options.restock });
  if (!parsed.success) throw validationError(parsed.error.issues);
  requirePermission(
    canSetStatus(actor, to),
    "Für diesen Statuswechsel fehlt dir die Berechtigung.",
  );
  if (to === "cancelled" && (!parsed.data.reason || parsed.data.reason.length < 3)) {
    throw new AdminOrderError("validation", "Bitte gib einen Grund für das Storno an.");
  }

  const order = await loadOrderState(orderId);
  await applyTransition(order, to, actor, { reason: parsed.data.reason ?? null });

  let restocked: { variantId: string; quantity: number }[] = [];
  if (to === "cancelled" && parsed.data.restock) {
    const { data: items } = await ordersDb()
      .from("order_items")
      .select("id, quantity, fulfilled_quantity, refunded_quantity")
      .eq("order_id", orderId);
    const capped = await restockOrderItems({
      orderId,
      orderNumber: order.order_number,
      lines: (items ?? []).map((i) => ({
        orderItemId: i.id,
        quantity: Math.max(0, i.quantity - i.fulfilled_quantity),
      })),
      reason: "correction",
      note: `Storno ${order.order_number}`,
      actor,
    });
    restocked = capped.apply;
    if (restocked.length > 0) {
      await addOrderEvent(orderId, {
        kind: "restock",
        message: `Bestand zurückgebucht (Storno): ${restocked.reduce((s, r) => s + r.quantity, 0)} Einheiten`,
        data: { restocked, skipped: capped.skipped },
        actor,
      });
      await writeAudit(actor, {
        action: "order.restock",
        entityType: "order",
        entityId: orderId,
        after: { reason: "correction", restocked },
      });
    }
  }
  return { from: order.status, to, restocked };
}

/**
 * Zahlungseingang einer manuellen Bestellung (Rechnung) verbuchen. Offen wird zu bezahlt,
 * eine bereits bearbeitete oder versendete Bestellung behält ihren Status.
 */
export async function markManualPaymentReceived(
  orderId: string,
  actor: StaffSession,
  note?: string,
): Promise<void> {
  requirePermission(hasRole(actor, "admin"), "Zahlungen verbuchen dürfen nur Owner und Admin.");
  const order = await loadOrderState(orderId);
  if (order.payment_provider !== MANUAL_PAYMENT_PROVIDER) {
    throw new AdminOrderError(
      "validation",
      "Nur manuelle Bestellungen werden von Hand als bezahlt markiert.",
    );
  }
  if (order.payment_status !== "unpaid") {
    throw new AdminOrderError(
      "validation",
      "Für diese Bestellung ist schon eine Zahlung verbucht.",
    );
  }
  if (order.status === "pending") {
    await applyTransition(order, "paid", actor, { reason: note ?? null });
  } else {
    const now = new Date().toISOString();
    const { data } = await ordersDb()
      .from("orders")
      .update({ payment_status: "paid", paid_at: now })
      .eq("id", orderId)
      .eq("payment_status", "unpaid")
      .select("id");
    if (!data || data.length === 0) {
      throw new AdminOrderError("conflict", "Die Bestellung wurde inzwischen geändert.");
    }
    await writeAudit(actor, {
      action: "order.payment_received",
      entityType: "order",
      entityId: orderId,
      before: { payment_status: "unpaid" },
      after: { payment_status: "paid" },
    });
  }
  await addOrderEvent(orderId, {
    kind: "paid",
    message: "Zahlungseingang verbucht (Rechnung)",
    data: { method: "invoice", manual: true, ...(note ? { note } : {}) },
    actor,
    visibleToCustomer: true,
  });
}

const noteSchema = z.object({
  orderId: z.uuid(),
  text: z.string().trim().min(1, "Die Notiz ist leer.").max(5000, "Höchstens 5000 Zeichen."),
});

/** Interne Notiz (nur Team, nie im Kundenkonto). */
export async function addOrderNote(
  orderId: string,
  text: string,
  actor: StaffSession,
): Promise<{ id: string; createdAt: string }> {
  const parsed = noteSchema.safeParse({ orderId, text });
  if (!parsed.success) throw validationError(parsed.error.issues);
  await loadOrderState(orderId);
  const { data, error } = await ordersDb()
    .from("order_notes")
    .insert({ order_id: orderId, author_user_id: actor.userId, body: parsed.data.text })
    .select("id, created_at")
    .single();
  if (error || !data) throw new Error(`Notiz konnte nicht gespeichert werden: ${error?.message}`);
  await writeAudit(actor, {
    action: "order.note_add",
    entityType: "order",
    entityId: orderId,
    after: { note_id: data.id, length: parsed.data.text.length },
  });
  return { id: data.id, createdAt: data.created_at };
}
