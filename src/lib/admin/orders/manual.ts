import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasRole, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { enqueueAndRun } from "@/lib/admin/jobs/runner";
import { loadCheckoutLines, loadShippingRates, loadTaxRates } from "@/lib/checkout/cart-data";
import { currentLegalVersions, legalVersionsSnapshot } from "@/lib/checkout/legal";
import { buildAmountsSnapshot, buildOrderItems, orderTaxLines } from "@/lib/checkout/snapshot";
import type { StoredAddress } from "@/lib/checkout/types";
import { serverEnv } from "@/lib/env/server";
import { addOrderEvent, asJson, ordersDb, requirePermission } from "./db";
import { AdminOrderError, validationError } from "./errors";
import { MANUAL_PAYMENT_METHOD, MANUAL_PAYMENT_PROVIDER } from "./status";

/**
 * Manuelle Bestellung (Telefon, B2B, Messe). Einzige Stelle im Backoffice, an der Preise aus dem
 * Katalog gelesen werden: Positionen laufen durch dieselbe Preislogik wie der Checkout
 * (loadCheckoutLines + buildAmountsSnapshot, src/lib/pricing), danach gilt der Snapshot.
 * Zahlart "Rechnung" (payment_provider manual), Status offen, Bestand wird reserviert und sofort
 * abgebucht (reserve_stock + commit_reservations, inventory_movements reason sale).
 *
 * Technisch entsteht dafür ein Warenkorb mit Status converted (Herkunft admin), damit die
 * Positionen exakt wie im Checkout aufgelöst werden (Bundles, Pfand, Grundpreis, Steuerklasse).
 */

const addressSchema = z.object({
  first_name: z.string().trim().min(1, "Vorname fehlt").max(80),
  last_name: z.string().trim().min(1, "Nachname fehlt").max(80),
  company: z.string().trim().max(120).nullish(),
  street: z.string().trim().min(2, "Straße fehlt").max(120),
  house_number: z.string().trim().max(20).nullish(),
  address_addition: z.string().trim().max(120).nullish(),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "PLZ mit fünf Ziffern"),
  city: z.string().trim().min(2, "Ort fehlt").max(80),
  phone: z.string().trim().max(40).nullish(),
});

export const manualOrderSchema = z.object({
  customer: z.object({
    email: z.email("Ungültige E-Mail").transform((v) => v.trim().toLowerCase()),
    phone: z.string().trim().max(40).nullish(),
    shippingAddress: addressSchema,
    billingAddress: addressSchema.nullish(),
  }),
  lines: z
    .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(999) }))
    .min(1, "Mindestens eine Position")
    .max(50),
  shipping: z
    .object({
      /** Versandtarif; ohne Angabe der günstigste passende wie im Checkout */
      rateId: z.uuid().nullish(),
      /** Versandkosten erlassen (Tarifname bleibt für Rechnung und Lieferschein) */
      waive: z.boolean().default(false),
    })
    .default({ waive: false }),
  /** interne Notiz (order_notes) */
  note: z.string().trim().max(2000).nullish(),
  /** Hinweis des Kunden, steht auf dem Lieferschein */
  customerNote: z.string().trim().max(1000).nullish(),
  /** Testbestellung; vor dem Go-live ohnehin immer */
  isTest: z.boolean().default(false),
});

export type ManualOrderInput = z.input<typeof manualOrderSchema>;

export interface ManualOrderResult {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  isTest: boolean;
}

function toStored(a: z.output<typeof addressSchema>): StoredAddress {
  return {
    first_name: a.first_name,
    last_name: a.last_name,
    company: a.company || null,
    street: a.street,
    house_number: a.house_number || null,
    address_addition: a.address_addition || null,
    postal_code: a.postal_code,
    city: a.city,
    country_code: "DE",
    phone: a.phone || null,
  };
}

function stockError(error: { message: string; details?: string }): AdminOrderError {
  let detail: { variant_id?: string; requested?: number; available?: number } = {};
  try {
    detail = JSON.parse(error.details ?? "{}");
  } catch {
    // ohne Details
  }
  return new AdminOrderError(
    "insufficient_stock",
    `Nicht genug Bestand${detail.available !== undefined ? ` (verfügbar ${detail.available}, benötigt ${detail.requested})` : ""}.`,
    detail,
  );
}

export async function createManualOrder(
  input: ManualOrderInput,
  actor: StaffSession,
): Promise<ManualOrderResult> {
  requirePermission(hasRole(actor, "admin"), "Manuelle Bestellungen legen Owner und Admin an.");
  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const data = parsed.data;
  const db = ordersDb();
  const env = serverEnv();

  // Gleiche Variante zusammenfassen (ein Warenkorb kennt jede Variante einmal)
  const merged = new Map<string, number>();
  for (const l of data.lines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);

  const { data: cart, error: cartError } = await db
    .from("carts")
    .insert({
      status: "converted",
      email: data.customer.email,
      note: "Manuelle Bestellung (Backoffice)",
      attribution: asJson({ source: "admin", created_by: actor.userId }),
    })
    .select("id")
    .single();
  if (cartError || !cart) throw new Error(`Warenkorb nicht angelegt: ${cartError?.message}`);

  const reservationId = randomUUID();
  let reserved = false;
  let orderId: string | null = null;
  try {
    const { error: itemsError } = await db
      .from("cart_items")
      .insert(
        [...merged].map(([variant_id, quantity]) => ({ cart_id: cart.id, variant_id, quantity })),
      );
    if (itemsError)
      throw new AdminOrderError("validation", `Positionen ungültig: ${itemsError.message}`);

    const lines = await loadCheckoutLines(cart.id);
    if (lines.length !== merged.size) {
      throw new AdminOrderError(
        "validation",
        "Mindestens ein Artikel ist nicht aktiv oder existiert nicht.",
      );
    }

    const [rates, taxRates] = await Promise.all([loadShippingRates(), loadTaxRates()]);
    let shippingRates = rates;
    if (data.shipping.rateId) {
      const rate = rates.find((r) => r.id === data.shipping.rateId);
      if (!rate)
        throw new AdminOrderError("validation", "Dieser Versandtarif ist nicht verfügbar.");
      shippingRates = [rate];
    }
    if (data.shipping.waive) shippingRates = shippingRates.map((r) => ({ ...r, priceCents: 0 }));
    const { snapshot } = buildAmountsSnapshot({
      lines,
      discount: null,
      shippingRates,
      depositTaxRateBp: taxRates.get("standard") ?? 1900,
    });
    if (!snapshot.shipping && !data.shipping.waive) {
      throw new AdminOrderError("validation", "Für diese Bestellung passt kein Versandtarif.");
    }

    // Bestand reservieren (prüft Verfügbarkeit, wirft INSUFFICIENT_STOCK)
    const { error: reserveError } = await db.rpc("reserve_stock", {
      p_checkout_session_id: reservationId,
      p_items: asJson(lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity }))),
      p_ttl: "30 minutes",
    });
    if (reserveError) {
      if (reserveError.message.includes("INSUFFICIENT_STOCK")) throw stockError(reserveError);
      throw new Error(`Bestand nicht reserviert: ${reserveError.message}`);
    }
    reserved = true;

    // Kunde anlegen oder finden (wie im Checkout)
    const ship = toStored(data.customer.shippingAddress);
    await db.from("customers").upsert(
      {
        email: data.customer.email,
        first_name: ship.first_name,
        last_name: ship.last_name,
        phone: data.customer.phone ?? ship.phone,
        acquisition_source: "admin",
      },
      { onConflict: "email", ignoreDuplicates: true },
    );
    const { data: customer } = await db
      .from("customers")
      .select("id")
      .eq("email", data.customer.email)
      .maybeSingle();

    const isTest = data.isTest || env.APP_STAGE !== "production";
    const legal = legalVersionsSnapshot(await currentLegalVersions());
    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        status: "pending",
        payment_status: "unpaid",
        customer_id: customer?.id ?? null,
        email: data.customer.email,
        phone: data.customer.phone ?? ship.phone,
        subtotal_cents: snapshot.subtotalCents,
        discount_cents: snapshot.discountCents,
        shipping_cents: snapshot.shippingCents,
        deposit_cents: snapshot.depositCents,
        tax_cents: snapshot.taxCents,
        total_cents: snapshot.totalCents,
        tax_lines: asJson(orderTaxLines(snapshot)),
        shipping_address: asJson(ship),
        billing_address: data.customer.billingAddress
          ? asJson(toStored(data.customer.billingAddress))
          : null,
        shipping_rate_id: snapshot.shipping?.id ?? null,
        shipping_rate_name: snapshot.shipping
          ? `${snapshot.shipping.name}${data.shipping.waive ? " (erlassen)" : ""}`
          : null,
        payment_provider: MANUAL_PAYMENT_PROVIDER,
        payment_method_type: MANUAL_PAYMENT_METHOD,
        cart_id: cart.id,
        legal_versions: asJson(legal),
        attribution: asJson({ source: "admin" }),
        customer_note: data.customerNote ?? null,
        is_test: isTest,
        source: "admin",
      })
      .select("id, order_number")
      .single();
    if (orderError || !order) throw new Error(`Bestellung nicht angelegt: ${orderError?.message}`);
    orderId = order.id;

    const items = buildOrderItems(snapshot, order.id);
    const { error: insertItemsError } = await db
      .from("order_items")
      .insert(items.map((i) => ({ ...i, components: i.components ? asJson(i.components) : null })));
    if (insertItemsError) throw new Error(`Positionen nicht angelegt: ${insertItemsError.message}`);

    // Reservierung in Abgang wandeln (inventory_movements, reason sale, Bezug order)
    const { error: commitError } = await db.rpc("commit_reservations", {
      p_checkout_session_id: reservationId,
      p_order_id: order.id,
    });
    if (commitError) throw new Error(`Bestand nicht abgebucht: ${commitError.message}`);
    reserved = false;

    await db.from("carts").update({ converted_order_id: order.id }).eq("id", cart.id);
    await addOrderEvent(order.id, {
      kind: "created",
      message: `Bestellung ${order.order_number} manuell angelegt (Rechnung)`,
      data: {
        source: "admin",
        lines: lines.length,
        total_cents: snapshot.totalCents,
        waive_shipping: data.shipping.waive,
      },
      actor,
      visibleToCustomer: true,
    });
    const notes = [
      ...(isTest ? ["TEST (manuelle Testbestellung)"] : []),
      ...(data.note ? [data.note] : []),
    ];
    if (notes.length > 0) {
      await db
        .from("order_notes")
        .insert(notes.map((body) => ({ order_id: order.id, author_user_id: actor.userId, body })));
    }
    await writeAudit(actor, {
      action: "order.create_manual",
      entityType: "order",
      entityId: order.id,
      after: {
        order_number: order.order_number,
        total_cents: snapshot.totalCents,
        lines: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        shipping_rate_id: snapshot.shipping?.id ?? null,
        waive_shipping: data.shipping.waive,
        is_test: isTest,
      },
    });

    // Rechnung (Entwurf bis LEXWARE_INVOICE_MODE=final), Zahlungsziel 14 Tage
    await enqueueAndRun({
      kind: "invoice.create",
      payload: { order_id: order.id },
      idempotencyKey: `invoice.create:${order.id}`,
      orderId: order.id,
      priority: 40,
    });

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      totalCents: snapshot.totalCents,
      isTest,
    };
  } catch (error) {
    // Aufräumen: nur die gerade angelegten Zeilen (enges WHERE auf die neuen IDs)
    if (reserved) await db.rpc("release_reservations", { p_checkout_session_id: reservationId });
    if (orderId) await db.from("orders").delete().eq("id", orderId).eq("source", "admin");
    await db.from("carts").delete().eq("id", cart.id).eq("status", "converted");
    throw error;
  }
}
