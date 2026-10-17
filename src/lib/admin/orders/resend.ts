import "server-only";
import { z } from "zod";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { sendOrderConfirmation } from "@/lib/checkout/post-order";
import { ordersDb, requirePermission } from "./db";
import { AdminOrderError } from "./errors";
import { sendRefundMail, sendShippingMail } from "./notifications";

/**
 * "Mail erneut senden" im Bestelldetail: Bestellbestätigung, Versandbestätigung (letzte Sendung mit
 * Trackingnummer) oder Erstattungsbestätigung (letzte erfolgreiche Erstattung). Versand läuft über
 * dieselben Funktionen wie die Jobs, also mit Allowlist und Sperrliste; jede Mail landet im
 * Verlauf (email_sent) und im Audit-Log.
 *
 * Rechte: Versandbestätigung alle mit Versandrecht, die übrigen nur Rollen mit Kundendaten.
 */

export const RESEND_KINDS = {
  order_confirmation: "Bestellbestätigung",
  shipping_confirmation: "Versandbestätigung",
  refund_confirmation: "Erstattungsbestätigung",
} as const;

export type ResendKind = keyof typeof RESEND_KINDS;

const kindSchema = z.enum(Object.keys(RESEND_KINDS) as [ResendKind, ...ResendKind[]]);

export function canResend(actor: StaffSession, kind: ResendKind): boolean {
  return kind === "shipping_confirmation"
    ? PERMISSIONS.fulfil(actor) || PERMISSIONS.viewCustomers(actor)
    : PERMISSIONS.viewCustomers(actor);
}

export async function resendOrderMail(
  orderId: string,
  kindInput: string,
  actor: StaffSession,
): Promise<{ kind: ResendKind; label: string }> {
  const kind = kindSchema.parse(kindInput);
  requirePermission(canResend(actor, kind), "Diese Mail darf deine Rolle nicht senden.");
  if (!z.uuid().safeParse(orderId).success) {
    throw new AdminOrderError("validation", "Ungültige Bestellung.");
  }
  const db = ordersDb();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");

  let reference: string | null = null;
  if (kind === "order_confirmation") {
    await sendOrderConfirmation(orderId);
  } else if (kind === "shipping_confirmation") {
    const { data: shipment } = await db
      .from("shipments")
      .select("id")
      .eq("order_id", orderId)
      .eq("is_return", false)
      .not("tracking_number", "is", null)
      .in("status", ["shipped", "in_transit", "delivered"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!shipment) {
      throw new AdminOrderError("validation", "Es gibt noch keine Sendung mit Trackingnummer.");
    }
    reference = shipment.id;
    await sendShippingMail(shipment.id, { force: true });
  } else {
    const { data: refund } = await db
      .from("refunds")
      .select("id")
      .eq("order_id", orderId)
      .in("status", ["succeeded", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!refund) throw new AdminOrderError("validation", "Es gibt keine Erstattung.");
    reference = refund.id;
    await sendRefundMail(refund.id, { force: true });
  }

  await writeAudit(actor, {
    action: "order.mail_resend",
    entityType: "order",
    entityId: orderId,
    after: { template: kind, reference },
  });
  return { kind, label: RESEND_KINDS[kind] };
}
