import "server-only";
import { deriveOrderBadges, type OrderBadges } from "@/lib/admin/orders/status";
import { publicStorageUrl } from "@/lib/catalog/products";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  lowStock,
  percentDelta,
  revenueSeries,
  splitByPeriod,
  splitNewReturning,
  summarize,
  topProducts,
  type CustomerSplit,
  type Delta,
  type LowStockItem,
  type MetricItem,
  type MetricOrder,
  type SeriesPoint,
  type Summary,
  type TopProduct,
} from "./metrics";
import type { Period } from "./period";

/**
 * Datenzugriff des Dashboards (Service Role, nur serverseitig). Testbestellungen (is_test) sind
 * überall ausgeschlossen. Zeiträume kommen in UTC aus parsePeriod().
 */
type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const COUNTING_PAYMENT: PaymentStatus[] = ["paid", "partially_refunded"];
const PAGE = 1000;
const CHUNK = 150;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Zählende Bestellungen (bezahlt, nicht storniert, kein Test) im Zeitfenster, seitenweise geladen. */
async function countingOrders(from: Date, to: Date): Promise<MetricOrder[]> {
  const out: MetricOrder[] = [];
  for (let offset = 0; offset < 100_000; offset += PAGE) {
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("id, placed_at, total_cents, email")
      .eq("is_test", false)
      .in("payment_status", COUNTING_PAYMENT)
      .neq("status", "cancelled")
      .gte("placed_at", from.toISOString())
      .lt("placed_at", to.toISOString())
      .order("placed_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Dashboard orders: ${error.message}`);
    out.push(...((data ?? []) as MetricOrder[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** E-Mail-Adressen, die vor dem Zeitraum schon eine zählende Bestellung hatten. */
async function priorCustomerEmails(emails: string[], before: Date): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
  for (const part of chunks(unique)) {
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("email")
      .eq("is_test", false)
      .in("payment_status", COUNTING_PAYMENT)
      .neq("status", "cancelled")
      .lt("placed_at", before.toISOString())
      .in("email", part);
    if (error) throw new Error(`Dashboard Bestandskunden: ${error.message}`);
    for (const row of data ?? []) found.add(String(row.email).toLowerCase());
  }
  return found;
}

async function orderItems(orderIds: string[]): Promise<MetricItem[]> {
  const out: MetricItem[] = [];
  for (const part of chunks(orderIds)) {
    const { data, error } = await supabaseAdmin()
      .from("order_items")
      .select("product_id, product_title, quantity, line_total_cents")
      .in("order_id", part);
    if (error) throw new Error(`Dashboard Positionen: ${error.message}`);
    out.push(...((data ?? []) as MetricItem[]));
  }
  return out;
}

export interface TopProductView extends TopProduct {
  imageUrl: string | null;
}

async function decorateTopProducts(top: TopProduct[]): Promise<TopProductView[]> {
  const ids = top.map((t) => t.productId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return top.map((t) => ({ ...t, imageUrl: null }));
  const [{ data: images }, { data: titles }] = await Promise.all([
    supabaseAdmin()
      .from("product_images")
      .select("product_id, storage_bucket, storage_path, position")
      .in("product_id", ids)
      .order("position"),
    supabaseAdmin()
      .from("product_translations")
      .select("product_id, title")
      .eq("locale", "de")
      .in("product_id", ids),
  ]);
  const imageBy = new Map<string, string>();
  for (const img of images ?? []) {
    if (!imageBy.has(img.product_id))
      imageBy.set(img.product_id, publicStorageUrl(img.storage_bucket, img.storage_path));
  }
  const titleBy = new Map((titles ?? []).map((t) => [t.product_id, t.title]));
  return top.map((t) => ({
    ...t,
    title: (t.productId && titleBy.get(t.productId)) || t.title,
    imageUrl: (t.productId && imageBy.get(t.productId)) || null,
  }));
}

export interface LowStockView extends LowStockItem {
  productTitle: string;
  productId: string | null;
}

export interface LowStockResult {
  items: LowStockView[];
  /** Anzahl aller Varianten unter der Schwelle (nicht nur die angezeigten) */
  total: number;
  /** false, solange die Bestandsführung abgeschaltet ist (H3: bis zum Import) */
  tracking: boolean;
}

async function loadLowStock(): Promise<LowStockResult> {
  const { data, error } = await supabaseAdmin()
    .from("inventory_levels")
    .select(
      "variant_id, on_hand, reserved, low_stock_threshold, track_inventory, product_variants!inner(title, is_active, product_id, products!inner(status, product_translations(title, locale)))",
    )
    .eq("track_inventory", true);
  if (error) throw new Error(`Dashboard Bestand: ${error.message}`);
  type Row = {
    variant_id: string;
    on_hand: number;
    reserved: number;
    low_stock_threshold: number;
    product_variants: {
      title: string;
      is_active: boolean;
      product_id: string;
      products: { status: string; product_translations: { title: string; locale: string }[] };
    };
  };
  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.product_variants.is_active && r.product_variants.products.status === "active",
  );
  const meta = new Map(
    rows.map((r) => [
      r.variant_id,
      {
        productId: r.product_variants.product_id,
        productTitle:
          r.product_variants.products.product_translations.find((t) => t.locale === "de")?.title ??
          r.product_variants.products.product_translations[0]?.title ??
          "Produkt",
        variantTitle: r.product_variants.title,
      },
    ]),
  );
  const all = lowStock(
    rows.map((r) => ({
      variantId: r.variant_id,
      title: meta.get(r.variant_id)?.variantTitle ?? "",
      onHand: r.on_hand,
      reserved: r.reserved,
      threshold: r.low_stock_threshold,
    })),
    1000,
  );
  return {
    items: all.slice(0, 5).map((l) => ({
      ...l,
      productTitle: meta.get(l.variantId)?.productTitle ?? "Produkt",
      productId: meta.get(l.variantId)?.productId ?? null,
    })),
    total: all.length,
    tracking: rows.length > 0,
  };
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  itemCount: number;
  totalCents: number;
  badges: OrderBadges;
}

async function recentOrders(limit = 5): Promise<RecentOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(
      "id, order_number, placed_at, email, total_cents, status, payment_status, payment_provider, is_test, shipping_address, order_items(quantity), shipments(status, shipped_at, delivered_at, is_return)",
    )
    .eq("is_test", false)
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Dashboard letzte Bestellungen: ${error.message}`);
  return (data ?? []).map((o) => {
    const addr = (o.shipping_address ?? {}) as { first_name?: string; last_name?: string };
    const name = [addr.first_name, addr.last_name].filter(Boolean).join(" ");
    return {
      id: o.id,
      orderNumber: o.order_number,
      placedAt: o.placed_at,
      customerName: name || String(o.email),
      itemCount: (o.order_items ?? []).length,
      totalCents: o.total_cents,
      badges: deriveOrderBadges({
        status: o.status as OrderStatus,
        paymentStatus: o.payment_status as PaymentStatus,
        paymentProvider: o.payment_provider,
        isTest: o.is_test,
        shipments: (o.shipments ?? []).map((s) => ({
          status: s.status,
          shippedAt: s.shipped_at,
          deliveredAt: s.delivered_at,
          isReturn: s.is_return,
        })),
      }),
    };
  });
}

export interface DashboardData {
  summary: Summary;
  previous: Summary;
  deltas: { revenue: Delta | null; orders: Delta | null; aov: Delta | null };
  series: SeriesPoint[];
  customers: CustomerSplit;
  top: TopProductView[];
  lowStock: LowStockResult;
  recent: RecentOrder[];
  /** Conversion braucht Sitzungsdaten; es gibt (noch) keine Sitzungstabelle */
  conversion: null;
}

export async function loadDashboard(period: Period): Promise<DashboardData> {
  const rows = await countingOrders(period.prevFrom, period.to);
  const { current, previous } = splitByPeriod(rows, period);
  const [prior, items, low, recent] = await Promise.all([
    priorCustomerEmails(
      current.map((o) => o.email),
      period.from,
    ),
    orderItems(current.map((o) => o.id)),
    loadLowStock(),
    recentOrders(),
  ]);
  const summary = summarize(current);
  const prev = summarize(previous);
  return {
    summary,
    previous: prev,
    deltas: {
      revenue: percentDelta(summary.revenueCents, prev.revenueCents),
      orders: percentDelta(summary.orders, prev.orders),
      aov: percentDelta(summary.aovCents, prev.aovCents),
    },
    series: revenueSeries(current, previous, period),
    customers: splitNewReturning(current, prior),
    top: await decorateTopProducts(topProducts(items)),
    lowStock: low,
    recent,
    conversion: null,
  };
}

/** Offene Bestellungen für die Glocke in der Kopfzeile: bezahlt oder in Bearbeitung, kein Test. */
export async function countOpenOrders(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("is_test", false)
    .in("status", ["paid", "processing"]);
  if (error) {
    console.error("[admin] offene Bestellungen", error.message);
    return 0;
  }
  return count ?? 0;
}
