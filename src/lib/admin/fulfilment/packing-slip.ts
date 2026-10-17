import "server-only";
import { loadLegalEntity, ordersDb, resolveOrderId } from "@/lib/admin/orders/db";
import { AdminOrderError } from "@/lib/admin/orders/errors";
import { readAddress } from "@/lib/checkout/session";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import {
  renderPackingSlipHtml,
  renderPackingSlipsHtml,
  type PackingSlipData,
} from "./packing-slip-html";

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
  const data = await loadPackingSlipData(orderId);
  return {
    html: renderPackingSlipHtml(data),
    filename: `Lieferschein-${data.orderNumber}.html`,
    orderNumber: data.orderNumber,
  };
}

/**
 * Sammeldruck aus der Bestellliste: mehrere Lieferscheine in einem Dokument (Seitenumbruch je
 * Bestellung), in der übergebenen Reihenfolge. Unbekannte IDs werden übersprungen.
 */
export async function renderPackingSlips(
  orderIds: string[],
): Promise<{ html: string; count: number; orderNumbers: string[] }> {
  const ids = [...new Set(orderIds)].slice(0, 200);
  const list: PackingSlipData[] = [];
  for (const id of ids) {
    try {
      list.push(await loadPackingSlipData(id));
    } catch (error) {
      if (!(error instanceof AdminOrderError)) throw error;
    }
  }
  if (list.length === 0) throw new AdminOrderError("not_found", "Keine Bestellung gefunden.");
  return {
    html: renderPackingSlipsHtml(list),
    count: list.length,
    orderNumbers: list.map((d) => d.orderNumber),
  };
}

async function loadPackingSlipData(orderId: string): Promise<PackingSlipData> {
  const db = ordersDb();
  const [{ data: order }, { data: items }, entity] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, placed_at, shipping_address, billing_address, shipping_rate_name, customer_note, is_test",
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

  return {
    orderNumber: order.order_number,
    placedAt: order.placed_at,
    shippingAddressLines: shipping ? formatAddressLines(shipping) : [],
    billingAddressLines: billing ? formatAddressLines(billing) : null,
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
  };
}
