import "server-only";
import { z } from "zod";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { readAddress } from "@/lib/checkout/session";
import type { StoredAddress } from "@/lib/checkout/types";
import { addOrderEvent, asJson, ordersDb, requirePermission } from "./db";
import { AdminOrderError, validationError } from "./errors";
import { addressSchema, toStored } from "./manual";
import type { OrderStatus } from "./status";

/**
 * Adressen einer Bestellung korrigieren (Tippfehler, Umzug vor dem Versand). Nur solange nichts
 * versendet ist; danach gilt die Adresse auf dem Paket. Vorher und Nachher stehen im Audit-Log,
 * der Verlauf zeigt die Änderung ohne Adressdaten. Recht: Rollen mit Kundendaten (nicht Fulfillment).
 */

const EDITABLE: OrderStatus[] = ["pending", "paid", "processing", "partially_refunded"];

export const orderAddressSchema = z.object({
  orderId: z.uuid(),
  shipping: addressSchema,
  /** null = Rechnungsadresse wie Lieferadresse */
  billing: addressSchema.nullable(),
});

export type OrderAddressInput = z.input<typeof orderAddressSchema>;

/** Darf die Adresse noch geändert werden? (für die Anzeige des Knopfs) */
export function canEditAddress(status: OrderStatus, hasShippedShipment: boolean): boolean {
  return EDITABLE.includes(status) && !hasShippedShipment;
}

function sameAddress(a: StoredAddress | null, b: StoredAddress | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function updateOrderAddresses(
  input: OrderAddressInput,
  actor: StaffSession,
): Promise<{ changed: boolean; labelWarning: boolean }> {
  requirePermission(
    PERMISSIONS.viewCustomers(actor),
    "Adressen ändern dürfen Owner, Admin und Support.",
  );
  const parsed = orderAddressSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const { orderId } = parsed.data;
  const db = ordersDb();
  const [{ data: order }, { data: shipments }] = await Promise.all([
    db
      .from("orders")
      .select("id, status, shipping_address, billing_address, updated_at")
      .eq("id", orderId)
      .maybeSingle(),
    db
      .from("shipments")
      .select("status, shipped_at, is_return")
      .eq("order_id", orderId)
      .eq("is_return", false),
  ]);
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  const outbound = (shipments ?? []).filter((s) => s.status !== "cancelled");
  const shipped = outbound.some((s) => Boolean(s.shipped_at) || s.status !== "label_created");
  if (!canEditAddress(order.status, shipped)) {
    throw new AdminOrderError(
      "invalid_transition",
      "Die Adresse lässt sich nur ändern, solange die Bestellung noch nicht versendet ist.",
    );
  }

  const beforeShipping = readAddress(order.shipping_address);
  const beforeBilling = readAddress(order.billing_address);
  const shipping = toStored(parsed.data.shipping);
  const billing = parsed.data.billing ? toStored(parsed.data.billing) : null;
  if (sameAddress(beforeShipping, shipping) && sameAddress(beforeBilling, billing)) {
    return { changed: false, labelWarning: false };
  }

  const { data: updated, error } = await db
    .from("orders")
    .update({
      shipping_address: asJson(shipping),
      billing_address: billing ? asJson(billing) : null,
    })
    .eq("id", orderId)
    .eq("updated_at", order.updated_at)
    .select("id");
  if (error) throw new Error(`Adresse nicht gespeichert: ${error.message}`);
  if (!updated || updated.length === 0) {
    throw new AdminOrderError(
      "conflict",
      "Die Bestellung wurde inzwischen geändert. Bitte lade die Seite neu.",
    );
  }

  const labelWarning = outbound.some((s) => s.status === "label_created");
  const parts = [
    !sameAddress(beforeShipping, shipping) ? "Lieferadresse" : null,
    !sameAddress(beforeBilling, billing) ? "Rechnungsadresse" : null,
  ].filter(Boolean);
  await addOrderEvent(orderId, {
    kind: "address_changed",
    message: `${parts.join(" und ")} geändert${labelWarning ? " (vorhandenes DHL-Label neu erstellen)" : ""}`,
    data: { fields: parts },
    actor,
  });
  await writeAudit(actor, {
    action: "order.address_update",
    entityType: "order",
    entityId: orderId,
    before: { shipping_address: beforeShipping, billing_address: beforeBilling },
    after: { shipping_address: shipping, billing_address: billing },
  });
  return { changed: true, labelWarning };
}
