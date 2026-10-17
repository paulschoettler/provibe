import "server-only";
import type { TaxLine } from "@/lib/pricing";
import { checkoutDb } from "./db";
import { DELIVERY_TIME_TEXT } from "./delivery";
import { paymentLabel, type OrderView } from "./order-view";
import { readAddress, readSnapshot } from "./session";
import { depositLabel } from "./snapshot";

/** Bestellung mit Positionen und Snapshot für Bestätigungsseite, Mails und Rechnung laden. */
export async function loadOrderView(orderId: string): Promise<OrderView | null> {
  const db = checkoutDb();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return null;

  const [items, paidEvent, session] = await Promise.all([
    db
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("position", { ascending: true }),
    db
      .from("order_events")
      .select("data")
      .eq("order_id", orderId)
      .eq("kind", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    order.checkout_session_id
      ? db
          .from("checkout_sessions")
          .select("amounts, marketing_opt_in")
          .eq("id", order.checkout_session_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const snapshot = readSnapshot(session.data?.amounts ?? null);
  const descByVariant = new Map(snapshot?.lines.map((l) => [l.variantId, l.description]) ?? []);
  const details = (paidEvent.data?.data ?? {}) as {
    method?: string;
    brand?: string;
    last4?: string;
  };
  const shippingAddress = readAddress(order.shipping_address);
  if (!shippingAddress) return null;
  const rawTax = (order.tax_lines ?? []) as {
    rate_bp: number;
    taxable_cents: number;
    tax_cents: number;
  }[];
  const taxLines: TaxLine[] = rawTax.map((t) => ({
    rateBp: t.rate_bp,
    grossCents: t.taxable_cents,
    taxCents: t.tax_cents,
  }));
  const legal = (order.legal_versions ?? {}) as Record<string, unknown>;

  const viewItems = (items.data ?? []).map((i) => ({
    title: i.product_title,
    description: (i.variant_id && descByVariant.get(i.variant_id)) || i.variant_title || "",
    quantity: i.quantity,
    displayTotalCents: i.quantity * (i.unit_price_cents + i.unit_deposit_cents),
    unitPriceCents: i.unit_price_cents,
    unitDepositCents: i.unit_deposit_cents,
    basePriceText: i.base_price_text,
    imageUrl: i.image_path,
  }));

  return {
    id: order.id,
    orderNumber: order.order_number,
    email: order.email,
    placedAt: order.placed_at,
    paidAt: order.paid_at,
    paymentStatus: order.payment_status,
    paymentLabel: paymentLabel({
      method: details.method ?? order.payment_method_type,
      brand: details.brand,
      last4: details.last4,
    }),
    items: viewItems,
    itemCount: viewItems.reduce((s, i) => s + i.quantity, 0),
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    discountCode: order.discount_code,
    depositCents: order.deposit_cents,
    depositLabel: snapshot ? depositLabel(snapshot) : "Pfand",
    shippingCents: order.shipping_cents,
    shippingName: order.shipping_rate_name ?? "Versand",
    shippingFree: order.shipping_cents === 0,
    deliveryTimeText: snapshot?.shipping?.deliveryTimeText ?? DELIVERY_TIME_TEXT,
    taxLines,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    shippingAddress,
    billingAddress: readAddress(order.billing_address),
    legalVersionIds: ["agb", "widerruf", "datenschutz"]
      .map((k) => legal[k])
      .filter((v): v is string => typeof v === "string"),
    isTest: order.is_test,
    marketingOptIn: session.data?.marketing_opt_in ?? false,
  };
}
