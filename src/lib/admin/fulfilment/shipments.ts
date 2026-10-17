import "server-only";
import { z } from "zod";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { enqueueAndRun } from "@/lib/admin/jobs/runner";
import { addOrderEvent, asJson, ordersDb, requirePermission } from "@/lib/admin/orders/db";
import { AdminOrderError, validationError } from "@/lib/admin/orders/errors";
import { pathToShipped } from "@/lib/admin/orders/status";
import { applyTransition, loadOrderState } from "@/lib/admin/orders/transition";
import { readAddress } from "@/lib/checkout/session";
import { integrations } from "@/lib/integrations";
import type { ShipmentAddress } from "@/lib/integrations/shipping/types";
import {
  carrierLabel,
  CARRIERS,
  isValidTrackingNumber,
  normalizeTrackingNumber,
  trackingUrl,
  type Carrier,
} from "./tracking";

/**
 * Versand: Trackingnummer eintragen (mit automatischer Versandmail), DHL-Label erzeugen
 * (bis zum Zugang Mock, PDF im privaten Bucket shipping-labels), Zustellung markieren.
 * Rechte: PERMISSIONS.fulfil (Owner, Admin, Fulfillment).
 */

export const LABEL_BUCKET = "shipping-labels";
const SIGNED_URL_SECONDS = 600;

const shipmentSchema = z.object({
  carrier: z.enum(Object.keys(CARRIERS) as [Carrier, ...Carrier[]]).default("dhl"),
  trackingNumber: z
    .string()
    .trim()
    .refine(
      isValidTrackingNumber,
      "Die Trackingnummer sieht nicht gültig aus (6 bis 40 Zeichen, Ziffern und Buchstaben).",
    ),
  service: z.string().trim().max(80).optional(),
  notifyCustomer: z.boolean().default(true),
});

export type AddShipmentInput = z.input<typeof shipmentSchema>;

export interface AddShipmentResult {
  shipmentId: string;
  trackingNumber: string;
  trackingUrl: string | null;
  orderStatus: string;
  mail: "succeeded" | "retry" | "skipped";
}

async function loadItems(orderId: string) {
  const { data } = await ordersDb()
    .from("order_items")
    .select("id, quantity, fulfilled_quantity, weight_grams")
    .eq("order_id", orderId);
  return data ?? [];
}

/**
 * Trackingnummer speichern: Sendung anlegen (oder die per DHL-Label vorbereitete Sendung mit
 * gleicher Nummer übernehmen), Bestellung auf "versendet" (über "in Bearbeitung"), Positionen als
 * versendet markieren, Versandmail mit Tracking-Link über die Job-Queue.
 */
export async function addShipment(
  orderId: string,
  input: AddShipmentInput,
  actor: StaffSession,
): Promise<AddShipmentResult> {
  requirePermission(
    PERMISSIONS.fulfil(actor),
    "Versand dürfen Owner, Admin und Fulfillment bearbeiten.",
  );
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const { carrier, service, notifyCustomer } = parsed.data;
  const trackingNumber = normalizeTrackingNumber(parsed.data.trackingNumber);
  const url = trackingUrl(carrier, trackingNumber);

  let order = await loadOrderState(orderId);
  const steps = pathToShipped(order.status, {
    paymentProvider: order.payment_provider,
    paymentStatus: order.payment_status,
  });
  if (steps === null) {
    throw new AdminOrderError(
      "invalid_transition",
      "In diesem Status kann die Bestellung nicht versendet werden.",
    );
  }

  const db = ordersDb();
  const items = await loadItems(orderId);
  const now = new Date().toISOString();
  const shipmentItems = items.map((i) => ({
    order_item_id: i.id,
    quantity: i.quantity - i.fulfilled_quantity,
  }));

  const { data: prepared } = await db
    .from("shipments")
    .select("id")
    .eq("order_id", orderId)
    .eq("tracking_number", trackingNumber)
    .eq("is_return", false)
    .maybeSingle();

  let shipmentId: string;
  if (prepared) {
    const { error } = await db
      .from("shipments")
      .update({
        status: "shipped",
        shipped_at: now,
        tracking_url: url,
        items: asJson(shipmentItems),
      })
      .eq("id", prepared.id);
    if (error) throw new Error(`Sendung nicht gespeichert: ${error.message}`);
    shipmentId = prepared.id;
  } else {
    const { data: created, error } = await db
      .from("shipments")
      .insert({
        order_id: orderId,
        carrier,
        service: service ?? null,
        tracking_number: trackingNumber,
        tracking_url: url,
        status: "shipped",
        shipped_at: now,
        items: asJson(shipmentItems),
        weight_grams: items.reduce((s, i) => s + (i.weight_grams ?? 0), 0) || null,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Sendung nicht gespeichert: ${error?.message}`);
    shipmentId = created.id;
  }

  for (const i of items) {
    if (i.fulfilled_quantity < i.quantity) {
      await db.from("order_items").update({ fulfilled_quantity: i.quantity }).eq("id", i.id);
    }
  }
  for (const step of steps) {
    order = await applyTransition(order, step, actor, {
      extra: step === "shipped" ? { shipped_at: now } : undefined,
    });
  }
  if (steps.length === 0) {
    await db.from("orders").update({ fulfillment_status: "fulfilled" }).eq("id", orderId);
  }

  await addOrderEvent(orderId, {
    kind: "shipment",
    message: `Versendet mit ${carrierLabel(carrier)}, Sendungsnummer ${trackingNumber}`,
    data: { shipment_id: shipmentId, carrier, tracking_number: trackingNumber, tracking_url: url },
    actor,
    visibleToCustomer: true,
  });
  await writeAudit(actor, {
    action: "order.shipment_add",
    entityType: "order",
    entityId: orderId,
    after: {
      shipment_id: shipmentId,
      carrier,
      tracking_number: trackingNumber,
      notify: notifyCustomer,
    },
  });

  let mail: AddShipmentResult["mail"] = "skipped";
  if (notifyCustomer) {
    mail = (
      await enqueueAndRun({
        kind: "order.shipping_mail",
        payload: { shipment_id: shipmentId, order_id: orderId },
        idempotencyKey: `order.shipping_mail:${shipmentId}`,
        orderId,
        priority: 20,
      })
    ).result;
  }
  return { shipmentId, trackingNumber, trackingUrl: url, orderStatus: order.status, mail };
}

function toShipmentAddress(value: unknown, email: string, phone: string | null): ShipmentAddress {
  const a = readAddress(value);
  if (!a) throw new AdminOrderError("validation", "Die Lieferadresse ist unvollständig.");
  return {
    name1: `${a.first_name} ${a.last_name}`.trim(),
    name2: a.company ?? undefined,
    street: a.street,
    houseNumber: a.house_number ?? undefined,
    addressAddition: a.address_addition ?? undefined,
    postalCode: a.postal_code,
    city: a.city,
    countryCode: a.country_code,
    email,
    phone: a.phone ?? phone ?? undefined,
  };
}

const labelSchema = z.object({
  product: z.enum(["V01PAK", "V62KP"]).default("V01PAK"),
  withReturnLabel: z.boolean().default(false),
  /** Paketgewicht in Gramm (gewogen); ohne Angabe Summe der Positionsgewichte, mindestens 500 g */
  weightGrams: z
    .number()
    .int()
    .min(100, "Mindestens 100 g")
    .max(31_500, "Höchstens 31,5 kg")
    .optional(),
});

/** DHL-Produkte für das Label (Auswahl im Backoffice). */
export const DHL_PRODUCTS = { V01PAK: "DHL Paket", V62KP: "DHL Kleinpaket" } as const;

export interface DhlLabelResult {
  shipmentId: string;
  shipmentNumber: string;
  trackingUrl: string;
  labelUrl: string;
}

/**
 * DHL-Label erzeugen. Legt eine Sendung im Status label_created an, speichert das PDF im privaten
 * Bucket shipping-labels und liefert eine signierte URL (10 Minuten). Die Bestellung geht auf
 * "in Bearbeitung"; versendet wird sie erst mit addShipment (gleiche Sendungsnummer).
 */
export async function createDhlLabel(
  orderId: string,
  actor: StaffSession,
  options: z.input<typeof labelSchema> = {},
): Promise<DhlLabelResult> {
  requirePermission(
    PERMISSIONS.fulfil(actor),
    "Labels dürfen Owner, Admin und Fulfillment erstellen.",
  );
  const parsedOpts = labelSchema.safeParse(options);
  if (!parsedOpts.success) throw validationError(parsedOpts.error.issues);
  const opts = parsedOpts.data;
  const db = ordersDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_provider, email, phone, shipping_address, placed_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  const steps = pathToShipped(order.status, {
    paymentProvider: order.payment_provider,
    paymentStatus: order.payment_status,
  });
  if (steps === null || steps.length === 0) {
    throw new AdminOrderError(
      "invalid_transition",
      "Für diese Bestellung kann kein Label mehr erstellt werden.",
    );
  }
  const recipient = toShipmentAddress(order.shipping_address, order.email, order.phone);
  const items = await loadItems(orderId);
  const weightGrams =
    opts.weightGrams ??
    Math.max(
      items.reduce((s, i) => s + (i.weight_grams ?? 0), 0),
      500,
    );

  const { data: shipment, error } = await db
    .from("shipments")
    .insert({
      order_id: orderId,
      carrier: "dhl",
      service: opts.product,
      status: "label_created",
      weight_grams: weightGrams,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !shipment) throw new Error(`Sendung nicht angelegt: ${error?.message}`);

  const shipping = integrations().shipping;
  let label;
  try {
    label = await shipping.createLabel({
      orderNumber: order.order_number,
      shipmentId: shipment.id,
      recipient,
      weightGrams,
      product: opts.product,
      withReturnLabel: opts.withReturnLabel,
      labelFormat: "910-300-700",
    });
  } catch (err) {
    await db.from("shipments").update({ status: "cancelled" }).eq("id", shipment.id);
    const message = err instanceof Error ? err.message : String(err);
    throw new AdminOrderError("provider", `DHL-Label konnte nicht erstellt werden: ${message}`);
  }

  const year = new Date(order.placed_at).getUTCFullYear();
  const path = `${year}/${order.order_number}/${label.shipmentNumber}.pdf`;
  const upload = await db.storage
    .from(LABEL_BUCKET)
    .upload(path, label.labelPdf, { contentType: "application/pdf", upsert: true });
  if (upload.error) throw new Error(`Label nicht gespeichert: ${upload.error.message}`);
  if (label.returnLabelPdf && label.returnShipmentNumber) {
    await db.storage
      .from(LABEL_BUCKET)
      .upload(
        `${year}/${order.order_number}/${label.returnShipmentNumber}-retoure.pdf`,
        label.returnLabelPdf,
        {
          contentType: "application/pdf",
          upsert: true,
        },
      );
  }

  await db
    .from("shipments")
    .update({
      tracking_number: label.shipmentNumber,
      dhl_shipment_number: label.shipmentNumber,
      tracking_url: label.trackingUrl,
      label_bucket: LABEL_BUCKET,
      label_path: path,
    })
    .eq("id", shipment.id);

  if (order.status !== "processing") {
    await applyTransition(
      {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_provider: order.payment_provider,
      },
      "processing",
      actor,
    );
  }
  await addOrderEvent(orderId, {
    kind: "label_created",
    message: `DHL-Label erstellt (${shipping.name}), Sendungsnummer ${label.shipmentNumber}`,
    data: {
      shipment_id: shipment.id,
      shipment_number: label.shipmentNumber,
      product: opts.product,
    },
    actor,
  });
  await writeAudit(actor, {
    action: "order.label_create",
    entityType: "order",
    entityId: orderId,
    after: {
      shipment_id: shipment.id,
      shipment_number: label.shipmentNumber,
      provider: shipping.name,
    },
  });

  const labelUrl = await signedLabelUrl(path);
  return {
    shipmentId: shipment.id,
    shipmentNumber: label.shipmentNumber,
    trackingUrl: label.trackingUrl,
    labelUrl,
  };
}

async function signedLabelUrl(path: string): Promise<string> {
  const { data, error } = await ordersDb()
    .storage.from(LABEL_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data)
    throw new AdminOrderError("provider", `Label-Link fehlgeschlagen: ${error?.message}`);
  return data.signedUrl;
}

/** Signierte URL (10 Minuten) auf das Label einer Sendung. */
export async function getShippingLabelUrl(
  shipmentId: string,
  actor: StaffSession,
): Promise<string | null> {
  requirePermission(PERMISSIONS.fulfil(actor), "Labels sehen Owner, Admin und Fulfillment.");
  const { data } = await ordersDb()
    .from("shipments")
    .select("label_path")
    .eq("id", shipmentId)
    .maybeSingle();
  return data?.label_path ? signedLabelUrl(data.label_path) : null;
}

/** Zustellung markieren: alle ausgehenden Sendungen zugestellt, Bestellung "zugestellt". */
export async function markDelivered(
  orderId: string,
  actor: StaffSession,
  options: { deliveredAt?: string } = {},
): Promise<void> {
  requirePermission(
    PERMISSIONS.fulfil(actor),
    "Zustellungen dürfen Owner, Admin und Fulfillment markieren.",
  );
  const deliveredAt = options.deliveredAt
    ? z.iso.datetime({ offset: true }).parse(options.deliveredAt)
    : new Date().toISOString();
  const order = await loadOrderState(orderId);
  if (order.status !== "shipped") {
    throw new AdminOrderError(
      "invalid_transition",
      "Zugestellt geht nur bei versendeten Bestellungen.",
    );
  }
  await ordersDb()
    .from("shipments")
    .update({ status: "delivered", delivered_at: deliveredAt })
    .eq("order_id", orderId)
    .eq("is_return", false)
    .in("status", ["shipped", "in_transit", "manual"]);
  await applyTransition(order, "delivered", actor, { extra: { delivered_at: deliveredAt } });
}

/** Vorschlag für das Paketgewicht im Label-Dialog: Summe der Positionsgewichte, mindestens 500 g. */
export async function suggestedParcelWeightGrams(orderId: string): Promise<number> {
  const items = await loadItems(orderId);
  return Math.max(
    items.reduce((s, i) => s + (i.weight_grams ?? 0), 0),
    500,
  );
}
