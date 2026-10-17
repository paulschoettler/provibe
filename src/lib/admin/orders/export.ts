import "server-only";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { readAddress } from "@/lib/checkout/session";
import { buildOrdersCsv, type OrderCsvRow } from "./csv";
import { ordersDb, requirePermission } from "./db";
import { parseOrderFilter, sortColumn, type OrderFilterInput } from "./filters";
import { PAYMENT_METHOD_FILTERS } from "./filters";
import { applyOrderFilter } from "./read";
import {
  deriveOrderBadges,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
} from "./status";

/**
 * CSV-Export der Bestellliste mit denselben Filtern wie die Liste (ohne Seitenbegrenzung,
 * höchstens 10 000 Zeilen). UTF-8 mit BOM, Semikolon, Dezimalkomma (csv.ts).
 * Enthält Kundendaten: nur für Rollen mit viewCustomers, jeder Export steht im Audit-Log.
 */

const MAX_ROWS = 10_000;
const PAGE = 1000;

const EXPORT_SELECT =
  "id, order_number, placed_at, email, status, payment_status, payment_provider, payment_method_type, subtotal_cents, discount_cents, discount_code, deposit_cents, shipping_cents, tax_cents, total_cents, invoice_number, shipping_address, billing_address, source, is_test, order_items (count), shipments (status, shipped_at, delivered_at, is_return, tracking_number), refunds (amount_cents, status)";

type ExportRow = {
  id: string;
  order_number: string;
  placed_at: string;
  email: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
  payment_method_type: string | null;
  subtotal_cents: number;
  discount_cents: number;
  discount_code: string | null;
  deposit_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  invoice_number: string | null;
  shipping_address: unknown;
  billing_address: unknown;
  source: string;
  is_test: boolean;
  order_items: { count: number }[] | null;
  shipments:
    | {
        status: ShipmentStatus;
        shipped_at: string | null;
        delivered_at: string | null;
        is_return: boolean;
        tracking_number: string | null;
      }[]
    | null;
  refunds: { amount_cents: number; status: string }[] | null;
};

export interface OrdersCsvExport {
  filename: string;
  csv: string;
  rowCount: number;
  truncated: boolean;
}

export async function exportOrdersCsv(
  input: OrderFilterInput | Record<string, unknown>,
  actor: StaffSession,
): Promise<OrdersCsvExport> {
  requirePermission(
    PERMISSIONS.viewCustomers(actor),
    "Der Export enthält Kundendaten und ist für deine Rolle gesperrt.",
  );
  const filter = parseOrderFilter(input as Record<string, unknown>);
  const { column, ascending } = sortColumn(filter.sort);
  const db = ordersDb();

  const rows: ExportRow[] = [];
  let truncated = false;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await applyOrderFilter(db.from("orders").select(EXPORT_SELECT), filter)
      .order(column, { ascending })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Export fehlgeschlagen: ${error.message}`);
    const batch = (data ?? []) as unknown as ExportRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    if (offset + PAGE >= MAX_ROWS) truncated = true;
  }

  const csvRows: OrderCsvRow[] = rows.map((r) => {
    const address = readAddress(r.shipping_address) ?? readAddress(r.billing_address);
    const badges = deriveOrderBadges({
      status: r.status,
      paymentStatus: r.payment_status,
      paymentProvider: r.payment_provider,
      isTest: r.is_test,
      shipments: (r.shipments ?? []).map((s) => ({
        status: s.status,
        shippedAt: s.shipped_at,
        deliveredAt: s.delivered_at,
        isReturn: s.is_return,
      })),
    });
    const method = r.payment_method_type ?? "";
    return {
      orderNumber: r.order_number,
      placedAt: r.placed_at,
      status: ORDER_STATUS_LABELS[r.status],
      paymentBadge: badges.payment.label,
      fulfilmentBadge: badges.fulfilment.label,
      customerName: address ? `${address.first_name} ${address.last_name}`.trim() : "",
      email: r.email,
      itemCount: r.order_items?.[0]?.count ?? 0,
      subtotalCents: r.subtotal_cents,
      discountCents: r.discount_cents,
      discountCode: r.discount_code,
      depositCents: r.deposit_cents,
      shippingCents: r.shipping_cents,
      taxCents: r.tax_cents,
      totalCents: r.total_cents,
      refundedCents: (r.refunds ?? [])
        .filter((f) => f.status === "succeeded" || f.status === "pending")
        .reduce((s, f) => s + f.amount_cents, 0),
      paymentMethod:
        PAYMENT_METHOD_FILTERS[method as keyof typeof PAYMENT_METHOD_FILTERS] ?? method,
      invoiceNumber: r.invoice_number,
      trackingNumbers: (r.shipments ?? [])
        .filter((s) => !s.is_return && s.tracking_number)
        .map((s) => s.tracking_number)
        .join(", "),
      postalCode: address?.postal_code ?? "",
      city: address?.city ?? "",
      country: address?.country_code ?? "",
      source: r.source,
      isTest: r.is_test,
    };
  });

  await writeAudit(actor, {
    action: "order.export_csv",
    entityType: "order",
    after: {
      rows: csvRows.length,
      truncated,
      filter: { ...filter, search: filter.search ? "[gesetzt]" : undefined },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `bestellungen-${stamp}.csv`,
    csv: buildOrdersCsv(csvRows),
    rowCount: csvRows.length,
    truncated,
  };
}
