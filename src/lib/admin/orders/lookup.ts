import "server-only";
import { loadShippingRates } from "@/lib/checkout/cart-data";
import { readAddress } from "@/lib/checkout/session";
import type { StoredAddress } from "@/lib/checkout/types";
import { ordersDb } from "./db";
import { sanitizeSearch } from "./filters";

/**
 * Nachschlagen für die manuelle Bestellung (/admin/bestellungen/neu): Kunden suchen, bestellbare
 * Varianten aus dem Katalog, Versandtarife. Nur Anzeige; Preise rechnet createManualOrder
 * serverseitig mit derselben Preislogik wie der Checkout.
 */

export interface CustomerHit {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  ordersCount: number;
  /** Lieferadresse der letzten Bestellung als Vorschlag */
  lastAddress: StoredAddress | null;
}

export async function searchCustomers(query: string, limit = 8): Promise<CustomerHit[]> {
  const q = sanitizeSearch(query);
  if (q.length < 2) return [];
  const db = ordersDb();
  const words = q.split(" ").filter(Boolean);
  const parts = [
    `email.ilike.%${q}%`,
    `last_name.ilike.%${q}%`,
    `first_name.ilike.%${q}%`,
    `company_name.ilike.%${q}%`,
  ];
  if (words.length >= 2) {
    parts.push(`and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words.slice(1).join(" ")}%)`);
  }
  const { data, error } = await db
    .from("customers")
    .select("id, email, first_name, last_name, phone, company_name, orders_count")
    .is("anonymized_at", null)
    .or(parts.join(","))
    .order("last_order_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 20));
  if (error) throw new Error(`Kundensuche fehlgeschlagen: ${error.message}`);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const { data: orders } = ids.length
    ? await db
        .from("orders")
        .select("customer_id, shipping_address, placed_at")
        .in("customer_id", ids)
        .order("placed_at", { ascending: false })
        .limit(100)
    : {
        data: [] as { customer_id: string | null; shipping_address: unknown; placed_at: string }[],
      };
  const lastAddress = new Map<string, StoredAddress>();
  for (const o of orders ?? []) {
    if (o.customer_id && !lastAddress.has(o.customer_id)) {
      const a = readAddress(o.shipping_address);
      if (a) lastAddress.set(o.customer_id, a);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
    phone: r.phone,
    company: r.company_name,
    ordersCount: r.orders_count,
    lastAddress: lastAddress.get(r.id) ?? null,
  }));
}

export interface OrderableVariant {
  variantId: string;
  productTitle: string;
  productKind: "simple" | "bundle";
  variantTitle: string;
  sku: string | null;
  unitCount: number;
  /** Katalogpreis ohne Pfand (H22), nur zur Orientierung */
  priceCents: number;
  /** Pfand je Variante (Dosen × Pfand je Dose) */
  depositCents: number;
}

/** Aktive Varianten aktiver Produkte, sortiert wie im Shop. */
export async function listOrderableVariants(): Promise<OrderableVariant[]> {
  const db = ordersDb();
  const { data, error } = await db
    .from("product_variants")
    .select(
      "id, title, sku, unit_count, price_cents, position, products!inner (id, handle, kind, status, position, deposit_cents_per_unit, product_translations (title, locale))",
    )
    .eq("is_active", true)
    .eq("products.status", "active");
  if (error) throw new Error(`Katalog konnte nicht geladen werden: ${error.message}`);
  type Row = {
    id: string;
    title: string;
    sku: string | null;
    unit_count: number;
    price_cents: number;
    position: number;
    products: {
      handle: string;
      kind: "simple" | "bundle";
      position: number;
      deposit_cents_per_unit: number;
      product_translations: { title: string; locale: string }[] | null;
    };
  };
  return ((data ?? []) as unknown as Row[])
    .sort(
      (a, b) =>
        a.products.position - b.products.position ||
        a.products.handle.localeCompare(b.products.handle) ||
        a.position - b.position,
    )
    .map((r) => {
      const deposit = r.products.deposit_cents_per_unit * r.unit_count;
      const title =
        r.products.product_translations?.find((t) => t.locale === "de")?.title ?? r.products.handle;
      return {
        variantId: r.id,
        productTitle: title,
        productKind: r.products.kind,
        variantTitle: r.title,
        sku: r.sku,
        unitCount: r.unit_count,
        priceCents: r.price_cents - deposit,
        depositCents: deposit,
      };
    });
}

export interface ShippingRateOption {
  id: string;
  name: string;
  priceCents: number;
  freeAboveSubtotalCents: number | null;
}

export async function listShippingRateOptions(): Promise<ShippingRateOption[]> {
  const rates = await loadShippingRates();
  return rates.map((r) => ({
    id: r.id,
    name: r.name,
    priceCents: r.priceCents,
    freeAboveSubtotalCents: r.freeAboveSubtotalCents ?? null,
  }));
}
