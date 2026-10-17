import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { PERMISSIONS } from "@/lib/admin/auth";
import { readAddress } from "@/lib/checkout/session";
import type { StoredAddress } from "@/lib/checkout/types";
import { paymentLabel } from "@/lib/checkout/order-view";
import { carrierLabel } from "@/lib/admin/fulfilment/tracking";
import { ordersDb, resolveOrderId, staffNames } from "./db";
import {
  classifySearch,
  parseOrderFilter,
  rangeEnd,
  rangeStart,
  sortColumn,
  type OrderFilter,
  type OrderFilterInput,
} from "./filters";
import { refundedShippingFromItems } from "./refund-calc";
import {
  allowedTransitions,
  deriveOrderBadges,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TABS,
  type OrderBadges,
  type OrderStatus,
  type PaymentStatus,
  type ShipmentStatus,
} from "./status";

/**
 * Lesen der Bestellungen fürs Backoffice. Beträge kommen ausschließlich aus orders und
 * order_items (Snapshots). Testbestellungen sind enthalten und über isTest/badges.test markiert.
 */

const LIST_SELECT =
  "id, order_number, placed_at, email, shipping_address, billing_address, total_cents, status, payment_status, fulfillment_status, payment_provider, payment_method_type, is_test, source, customer_id, customers (first_name, last_name), order_items (count), shipments (status, shipped_at, delivered_at, is_return)";

export interface OrderListRow {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  email: string;
  customerId: string | null;
  /** Anzahl der Positionen (Figma "Positionen") */
  lineCount: number;
  totalCents: number;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  badges: OrderBadges;
  isTest: boolean;
  source: string;
}

export interface OrderListResult {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Zähler der Status-Tabs bei gleichen übrigen Filtern; "all" = alle Status */
  counts: Record<OrderStatus | "all", number>;
  filter: OrderFilter;
}

type ListRow = {
  id: string;
  order_number: string;
  placed_at: string;
  email: string;
  shipping_address: unknown;
  billing_address: unknown;
  total_cents: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
  payment_method_type: string | null;
  is_test: boolean;
  source: string;
  customer_id: string | null;
  customers: { first_name: string | null; last_name: string | null } | null;
  order_items: { count: number }[] | null;
  shipments:
    | {
        status: ShipmentStatus;
        shipped_at: string | null;
        delivered_at: string | null;
        is_return: boolean;
      }[]
    | null;
};

/** Gemeinsame Filter für Liste, Zähler und Export (eine Stelle für die Filterlogik). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyOrderFilter<Q extends { [k: string]: any }>(
  query: Q,
  filter: OrderFilter,
  options: { ignoreStatus?: boolean } = {},
): Q {
  let q = query;
  if (filter.status && !options.ignoreStatus) q = q.eq("status", filter.status);
  if (filter.paymentStatus) q = q.eq("payment_status", filter.paymentStatus);
  if (filter.fulfilmentStatus) q = q.eq("fulfillment_status", filter.fulfilmentStatus);
  if (filter.paymentMethod) q = q.eq("payment_method_type", filter.paymentMethod);
  if (filter.from) q = q.gte("placed_at", rangeStart(filter.from));
  if (filter.to) q = q.lte("placed_at", rangeEnd(filter.to));
  if (filter.test === "only") q = q.eq("is_test", true);
  if (filter.test === "exclude") q = q.eq("is_test", false);
  const search = classifySearch(filter.search);
  if (search.kind === "order_number") {
    q = q.or(`order_number.ilike.%${search.value}%,shopify_order_name.ilike.%${search.value}%`);
  } else if (search.kind === "text") {
    const v = search.value;
    const parts = [
      `email.ilike.%${v}%`,
      `order_number.ilike.%${v}%`,
      `shipping_address->>last_name.ilike.%${v}%`,
      `shipping_address->>first_name.ilike.%${v}%`,
      `shipping_address->>company.ilike.%${v}%`,
      `billing_address->>last_name.ilike.%${v}%`,
    ];
    // "Paul Schöttler": Vor- und Nachname getrennt prüfen
    const words = v.split(" ").filter(Boolean);
    if (words.length >= 2) {
      parts.push(
        `and(shipping_address->>first_name.ilike.%${words[0]}%,shipping_address->>last_name.ilike.%${words.slice(1).join(" ")}%)`,
      );
    }
    q = q.or(parts.join(","));
  }
  return q;
}

function customerName(row: {
  shipping_address: unknown;
  billing_address: unknown;
  customers: { first_name: string | null; last_name: string | null } | null;
  email: string;
}): string {
  const a = readAddress(row.shipping_address) ?? readAddress(row.billing_address);
  if (a) return `${a.first_name} ${a.last_name}`.trim();
  const c = row.customers;
  const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ");
  return name || row.email;
}

export async function listOrders(
  input: OrderFilterInput | Record<string, unknown> = {},
): Promise<OrderListResult> {
  const filter = parseOrderFilter(input as Record<string, unknown>);
  const db = ordersDb();
  const { column, ascending } = sortColumn(filter.sort);
  const fromIdx = (filter.page - 1) * filter.pageSize;

  const listQuery = applyOrderFilter(
    db.from("orders").select(LIST_SELECT, { count: "exact" }),
    filter,
  )
    .order(column, { ascending })
    .order("placed_at", { ascending: false })
    .range(fromIdx, fromIdx + filter.pageSize - 1);

  const countFor = (status: OrderStatus | null) => {
    let q = applyOrderFilter(
      db.from("orders").select("id", { count: "exact", head: true }),
      filter,
      { ignoreStatus: true },
    );
    if (status) q = q.eq("status", status);
    return q;
  };

  const [list, allCount, ...statusCounts] = await Promise.all([
    listQuery,
    countFor(null),
    ...ORDER_STATUS_TABS.map((s) => countFor(s)),
  ]);
  if (list.error)
    throw new Error(`Bestellungen konnten nicht geladen werden: ${list.error.message}`);

  const counts = { all: allCount.count ?? 0 } as Record<OrderStatus | "all", number>;
  ORDER_STATUS_TABS.forEach((s, i) => (counts[s] = statusCounts[i].count ?? 0));
  counts.partially_refunded = 0;

  const rows = ((list.data ?? []) as unknown as ListRow[]).map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    placedAt: r.placed_at,
    customerName: customerName(r),
    email: r.email,
    customerId: r.customer_id,
    lineCount: r.order_items?.[0]?.count ?? 0,
    totalCents: r.total_cents,
    status: r.status,
    statusLabel: ORDER_STATUS_LABELS[r.status],
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method_type,
    badges: deriveOrderBadges({
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
    }),
    isTest: r.is_test,
    source: r.source,
  }));

  const total = list.count ?? rows.length;
  return {
    rows,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filter.pageSize)),
    counts,
    filter,
  };
}

// ---------------------------------------------------------------------------------------------
// Detail

export interface OrderDetailItem {
  id: string;
  variantId: string | null;
  productId: string | null;
  productHandle: string | null;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imagePath: string | null;
  quantity: number;
  unitCount: number;
  unitPriceCents: number;
  unitDepositCents: number;
  discountCents: number;
  lineTotalCents: number;
  /** Menge × (Preis + Pfand), vor Rabatt */
  displayTotalCents: number;
  taxRateBp: number;
  basePriceText: string | null;
  components: { variant_id: string; sku: string | null; title: string; quantity: number }[] | null;
  fulfilledQuantity: number;
  refundedQuantity: number;
  refundableQuantity: number;
}

export interface OrderDetailEvent {
  id: number;
  kind: string;
  message: string | null;
  data: Record<string, unknown>;
  actorName: string | null;
  visibleToCustomer: boolean;
  createdAt: string;
}

export interface OrderDetailNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface OrderDetailShipment {
  id: string;
  carrier: string;
  carrierLabel: string;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  hasLabel: boolean;
  isReturn: boolean;
  shippedAt: string | null;
  deliveredAt: string | null;
  customerNotifiedAt: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface OrderDetailRefund {
  id: string;
  provider: string;
  providerRefundId: string | null;
  amountCents: number;
  reason: string | null;
  restock: boolean;
  status: string;
  items: unknown;
  createdByName: string | null;
  createdAt: string;
}

export interface OrderDetailLegalVersion {
  kind: string;
  id: string;
  version: number;
  title: string;
  effectiveFrom: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: string;
  badges: OrderBadges;
  allowedTransitions: OrderStatus[];
  isTest: boolean;
  source: string;
  email: string;
  phone: string | null;
  locale: string;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  customerNote: string | null;
  shopifyOrderName: string | null;
  amounts: {
    subtotalCents: number;
    discountCents: number;
    discountCode: string | null;
    depositCents: number;
    shippingCents: number;
    shippingName: string | null;
    taxCents: number;
    taxLines: { rateBp: number; taxableCents: number; taxCents: number }[];
    totalCents: number;
    refundedCents: number;
    refundableCents: number;
    refundableShippingCents: number;
  };
  items: OrderDetailItem[];
  events: OrderDetailEvent[];
  notes: OrderDetailNote[];
  shipments: OrderDetailShipment[];
  refunds: OrderDetailRefund[];
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    ordersCount: number;
    totalSpentCents: number;
    tags: string[];
    hasAccount: boolean;
  } | null;
  shippingAddress: StoredAddress | null;
  billingAddress: StoredAddress | null;
  legalVersions: OrderDetailLegalVersion[];
  payment: {
    provider: string;
    method: string | null;
    label: string;
    brand: string | null;
    last4: string | null;
    intentId: string | null;
    amountCents: number;
    paidAt: string | null;
    /** Link ins Stripe-Dashboard (Testmodus bei Testbestellungen), null bei Mock und manuell */
    dashboardUrl: string | null;
  };
  invoice: {
    status: string;
    number: string | null;
    providerInvoiceId: string | null;
    hasPdf: boolean;
    isDraftPdf: boolean;
    error: string | null;
  };
  attribution: Record<string, unknown>;
}

function stripeDashboardUrl(
  provider: string,
  intentId: string | null,
  isTest: boolean,
): string | null {
  if (
    provider !== "stripe" ||
    !intentId ||
    !intentId.startsWith("pi_") ||
    intentId.includes("_mock_")
  ) {
    return null;
  }
  return `https://dashboard.stripe.com/${isTest ? "test/" : ""}payments/${intentId}`;
}

/**
 * Bestellung mit allem, was die Detailseite braucht (Figma 35:12228). id als UUID oder
 * Bestellnummer. Kundendaten nur für Rollen mit viewCustomers, sonst customer = null und
 * keine Kundenkennzahlen (Fulfillment sieht Adressen und Positionen, aber kein CRM).
 */
export async function getOrder(
  idOrNumber: string,
  viewer?: StaffSession | null,
): Promise<OrderDetail | null> {
  const orderId = await resolveOrderId(idOrNumber);
  if (!orderId) return null;
  const db = ordersDb();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return null;

  const [items, events, notes, shipments, refunds, customer, paidEvent] = await Promise.all([
    db.from("order_items").select("*").eq("order_id", orderId).order("position"),
    db
      .from("order_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    db
      .from("order_notes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    db
      .from("shipments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    db.from("refunds").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    order.customer_id
      ? db
          .from("customers")
          .select(
            "id, email, first_name, last_name, phone, orders_count, total_spent_cents, tags, auth_user_id",
          )
          .eq("id", order.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("order_events")
      .select("data")
      .eq("order_id", orderId)
      .eq("kind", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const legal = (order.legal_versions ?? {}) as Record<string, unknown>;
  const legalIds = Object.entries(legal)
    .filter(([k, v]) => !k.endsWith("_version") && typeof v === "string")
    .map(([k, v]) => ({ kind: k, id: v as string }));
  const { data: legalRows } = legalIds.length
    ? await db
        .from("legal_document_versions")
        .select("id, version, title, effective_from")
        .in(
          "id",
          legalIds.map((l) => l.id),
        )
    : {
        data: [] as { id: string; version: number; title: string; effective_from: string | null }[],
      };
  const legalById = new Map((legalRows ?? []).map((r) => [r.id, r]));

  const names = await staffNames([
    ...(events.data ?? []).map((e) => e.actor_user_id),
    ...(notes.data ?? []).map((n) => n.author_user_id),
    ...(shipments.data ?? []).map((s) => s.created_by),
    ...(refunds.data ?? []).map((r) => r.created_by),
  ]);

  const activeRefunds = (refunds.data ?? []).filter(
    (r) => r.status === "succeeded" || r.status === "pending",
  );
  const refundedCents = activeRefunds.reduce((s, r) => s + r.amount_cents, 0);
  const refundedShipping = activeRefunds.reduce(
    (s, r) => s + refundedShippingFromItems(r.items),
    0,
  );
  const details = (paidEvent.data?.data ?? {}) as {
    method?: string;
    brand?: string;
    last4?: string;
  };
  const shipmentRows = shipments.data ?? [];
  const canSeeCustomer = viewer ? PERMISSIONS.viewCustomers(viewer) : true;
  const c = customer.data;

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    badges: deriveOrderBadges({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentProvider: order.payment_provider,
      isTest: order.is_test,
      shipments: shipmentRows.map((s) => ({
        status: s.status,
        shippedAt: s.shipped_at,
        deliveredAt: s.delivered_at,
        isReturn: s.is_return,
      })),
    }),
    allowedTransitions: allowedTransitions(order.status, {
      paymentProvider: order.payment_provider,
      paymentStatus: order.payment_status,
    }),
    isTest: order.is_test,
    source: order.source,
    email: order.email,
    phone: order.phone,
    locale: order.locale,
    placedAt: order.placed_at,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
    cancelReason: order.cancel_reason,
    customerNote: order.customer_note,
    shopifyOrderName: order.shopify_order_name,
    amounts: {
      subtotalCents: order.subtotal_cents,
      discountCents: order.discount_cents,
      discountCode: order.discount_code,
      depositCents: order.deposit_cents,
      shippingCents: order.shipping_cents,
      shippingName: order.shipping_rate_name,
      taxCents: order.tax_cents,
      taxLines: (
        (order.tax_lines ?? []) as { rate_bp: number; taxable_cents: number; tax_cents: number }[]
      ).map((t) => ({ rateBp: t.rate_bp, taxableCents: t.taxable_cents, taxCents: t.tax_cents })),
      totalCents: order.total_cents,
      refundedCents,
      refundableCents: Math.max(0, order.total_cents - refundedCents),
      refundableShippingCents: Math.max(0, order.shipping_cents - refundedShipping),
    },
    items: (items.data ?? []).map((i) => ({
      id: i.id,
      variantId: i.variant_id,
      productId: i.product_id,
      productHandle: i.product_handle,
      title: i.product_title,
      variantTitle: i.variant_title,
      sku: i.sku,
      imagePath: i.image_path,
      quantity: i.quantity,
      unitCount: i.unit_count,
      unitPriceCents: i.unit_price_cents,
      unitDepositCents: i.unit_deposit_cents,
      discountCents: i.discount_cents,
      lineTotalCents: i.line_total_cents,
      displayTotalCents: i.quantity * (i.unit_price_cents + i.unit_deposit_cents),
      taxRateBp: i.tax_rate_bp,
      basePriceText: i.base_price_text,
      components: (i.components as OrderDetailItem["components"]) ?? null,
      fulfilledQuantity: i.fulfilled_quantity,
      refundedQuantity: i.refunded_quantity,
      refundableQuantity: Math.max(0, i.quantity - i.refunded_quantity),
    })),
    events: (events.data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      message: e.message,
      data: (e.data ?? {}) as Record<string, unknown>,
      actorName: e.actor_user_id ? (names.get(e.actor_user_id) ?? "Team") : null,
      visibleToCustomer: e.visible_to_customer,
      createdAt: e.created_at,
    })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author_user_id ? (names.get(n.author_user_id) ?? "Team") : null,
      createdAt: n.created_at,
    })),
    shipments: shipmentRows.map((s) => ({
      id: s.id,
      carrier: s.carrier,
      carrierLabel: carrierLabel(s.carrier),
      service: s.service,
      trackingNumber: s.tracking_number,
      trackingUrl: s.tracking_url,
      status: s.status,
      hasLabel: Boolean(s.label_path),
      isReturn: s.is_return,
      shippedAt: s.shipped_at,
      deliveredAt: s.delivered_at,
      customerNotifiedAt: s.customer_notified_at,
      createdByName: s.created_by ? (names.get(s.created_by) ?? "Team") : null,
      createdAt: s.created_at,
    })),
    refunds: (refunds.data ?? []).map((r) => ({
      id: r.id,
      provider: r.provider,
      providerRefundId: r.provider_refund_id,
      amountCents: r.amount_cents,
      reason: r.reason,
      restock: r.restock,
      status: r.status,
      items: r.items,
      createdByName: r.created_by ? (names.get(r.created_by) ?? "Team") : null,
      createdAt: r.created_at,
    })),
    customer:
      c && canSeeCustomer
        ? {
            id: c.id,
            name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email,
            email: c.email,
            phone: c.phone,
            ordersCount: c.orders_count,
            totalSpentCents: Number(c.total_spent_cents),
            tags: c.tags ?? [],
            hasAccount: Boolean(c.auth_user_id),
          }
        : null,
    shippingAddress: readAddress(order.shipping_address),
    billingAddress: readAddress(order.billing_address),
    legalVersions: legalIds
      .map((l) => {
        const row = legalById.get(l.id);
        return row
          ? {
              kind: l.kind,
              id: row.id,
              version: row.version,
              title: row.title,
              effectiveFrom: row.effective_from,
            }
          : null;
      })
      .filter((v): v is OrderDetailLegalVersion => v !== null),
    payment: {
      provider: order.payment_provider,
      method: details.method ?? order.payment_method_type,
      label:
        order.payment_provider === "manual"
          ? "Rechnung (manuelle Bestellung)"
          : paymentLabel({
              method: details.method ?? order.payment_method_type,
              brand: details.brand,
              last4: details.last4,
            }),
      brand: details.brand ?? null,
      last4: details.last4 ?? null,
      intentId: order.payment_intent_id,
      amountCents: order.total_cents,
      paidAt: order.paid_at,
      dashboardUrl: stripeDashboardUrl(
        order.payment_provider,
        order.payment_intent_id,
        order.is_test,
      ),
    },
    invoice: {
      status: order.invoice_status,
      number: order.invoice_number,
      providerInvoiceId: order.lexware_invoice_id,
      hasPdf: Boolean(order.invoice_pdf_path),
      isDraftPdf: Boolean(order.invoice_pdf_path?.startsWith("entwuerfe/")),
      error: order.invoice_error,
    },
    attribution: (order.attribution ?? {}) as Record<string, unknown>,
  };
}
