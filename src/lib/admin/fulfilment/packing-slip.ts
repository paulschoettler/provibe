import "server-only";
import { loadLegalEntity, ordersDb, resolveOrderId } from "@/lib/admin/orders/db";
import { AdminOrderError } from "@/lib/admin/orders/errors";
import { readAddress } from "@/lib/checkout/session";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import { renderPackingSlipHtml } from "./packing-slip-html";

/**
 * Lieferschein einer Bestellung als druckfertiges HTML. Welle 2 liefert es aus einer Route unter
 * /admin/bestellungen/[id]/lieferschein mit Content-Type text/html aus (requireStaff davor);
 * PDF entsteht über "Drucken → Als PDF sichern" im Browser, ohne neue Abhängigkeit.
 */
export async function renderPackingSlip(
  idOrNumber: string,
): Promise<{ html: string; filename: string; orderNumber: string }> {
  const orderId = await resolveOrderId(idOrNumber);
  if (!orderId) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  const db = ordersDb();
  const [{ data: order }, { data: items }, entity] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, placed_at, email, shipping_address, billing_address, shipping_rate_name, customer_note, is_test",
      )
      .eq("id", orderId)
      .maybeSingle(),
    db
      .from("order_items")
      .select("product_title, variant_title, sku, quantity, components")
      .eq("order_id", orderId)
      .order("position"),
    loadLegalEntity(),
  ]);
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  const shipping = readAddress(order.shipping_address);
  const billing = readAddress(order.billing_address);

  const html = renderPackingSlipHtml({
    orderNumber: order.order_number,
    placedAt: order.placed_at,
    shippingAddressLines: shipping ? formatAddressLines(shipping) : [],
    billingAddressLines: billing ? formatAddressLines(billing) : null,
    email: order.email,
    shippingName: order.shipping_rate_name,
    items: (items ?? []).map((i) => ({
      title: i.product_title,
      variantTitle: i.variant_title,
      sku: i.sku,
      quantity: i.quantity,
      components: Array.isArray(i.components)
        ? (i.components as { title?: string; sku?: string | null; quantity?: number }[]).map(
            (c) => ({
              title: c.title ?? "",
              sku: c.sku ?? null,
              quantity: c.quantity ?? 1,
            }),
          )
        : null,
    })),
    customerNote: order.customer_note,
    isTest: order.is_test,
    entity,
  });
  return {
    html,
    filename: `Lieferschein-${order.order_number}.html`,
    orderNumber: order.order_number,
  };
}
