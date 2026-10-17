import "server-only";
import { loadShippingRates, loadTaxRates } from "@/lib/cart/server";
import { buildAmountsSnapshot } from "@/lib/checkout/snapshot";
import type { AmountsSnapshot, CheckoutRawLine } from "@/lib/checkout/types";
import type { ShippingRateRule, UnitMeasure } from "@/lib/pricing";
import { aboDb } from "./db";
import { effectiveVariantPrice, isSubscribable } from "./rules";
import type { SubscriptionRow } from "./types";

/**
 * Katalogdaten für Abos: Varianten als Rohzeile wie im Checkout (gleiche Preis- und Pfandlogik)
 * und die abonnierbaren Sorten und Packgrößen für die Auswahl im Portal.
 */

const DEFAULT_TAX_RATE_BP = 1900;

/** Gleiche festen Bilder wie Warenkorb und Startseite. */
export const ABO_IMAGE_BY_HANDLE: Record<string, string> = {
  wildberry: "/images/cans/wildberry.webp",
  "raspberry-lime": "/images/cans/raspberry-lime.webp",
  peach: "/images/cans/peach.webp",
};

const SHORT_TITLE: Record<string, string> = {
  wildberry: "Wildberry",
  "raspberry-lime": "Raspberry Lime",
  peach: "Peach",
  "provibe-eistee-mixed": "Mixed",
};

/** Kurzer Name für Abo-Karten und Mails (Figma: "Wildberry", "Mixed"). */
export function aboTitle(handle: string, title: string): string {
  return SHORT_TITLE[handle] ?? title.replace(/\s+eistee$/i, "").replace(/^provibe\s+/i, "");
}

interface VariantRow {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  price_cents: number;
  unit_count: number;
  weight_grams: number | null;
  packaging_weight_grams: number;
  is_active: boolean;
  position: number;
  products: {
    id: string;
    handle: string;
    status: string;
    kind: string;
    tax_class: string;
    deposit_cents_per_unit: number;
    net_content_per_unit: number | string | null;
    base_price_measure: string;
    product_translations: { locale: string; title: string; subtitle: string | null }[];
  } | null;
}

const VARIANT_SELECT =
  "id, product_id, title, sku, price_cents, unit_count, weight_grams, packaging_weight_grams, is_active, position, products (id, handle, status, kind, tax_class, deposit_cents_per_unit, net_content_per_unit, base_price_measure, product_translations (locale, title, subtitle))";

function toRawLine(
  v: VariantRow,
  quantity: number,
  taxRates: Map<string, number>,
): CheckoutRawLine {
  const p = v.products!;
  const t = p.product_translations.find((x) => x.locale === "de");
  return {
    cartItemId: `abo:${v.id}`,
    variantId: v.id,
    productId: p.id,
    productHandle: p.handle,
    productKind: p.kind,
    productTitle: t?.title ?? p.handle,
    productSubtitle: t?.subtitle ?? null,
    variantTitle: v.title,
    sku: v.sku,
    unitCount: v.unit_count,
    quantity,
    priceCents: v.price_cents,
    depositCentsPerUnit: p.deposit_cents_per_unit,
    depositCentsPerCan: p.deposit_cents_per_unit,
    depositCansPerItem: v.unit_count,
    netContentPerUnit: p.net_content_per_unit === null ? null : Number(p.net_content_per_unit),
    basePriceMeasure: p.base_price_measure as UnitMeasure,
    taxClass: p.tax_class,
    taxRateBp: taxRates.get(p.tax_class) ?? DEFAULT_TAX_RATE_BP,
    weightGrams: (v.weight_grams ?? 0) + v.packaging_weight_grams,
    imageUrl: ABO_IMAGE_BY_HANDLE[p.handle] ?? null,
    components: null,
  };
}

export interface PricingContext {
  shippingRates: ShippingRateRule[];
  taxRates: Map<string, number>;
  depositTaxRateBp: number;
}

export async function loadPricingContext(): Promise<PricingContext> {
  const [shippingRates, taxRates] = await Promise.all([loadShippingRates(), loadTaxRates()]);
  return {
    shippingRates,
    taxRates,
    depositTaxRateBp: taxRates.get("standard") ?? DEFAULT_TAX_RATE_BP,
  };
}

export async function loadVariants(ids: string[]): Promise<Map<string, VariantRow>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await aboDb()
    .from("product_variants")
    .select(VARIANT_SELECT)
    .in("id", unique);
  if (error) throw new Error(`Varianten nicht geladen: ${error.message}`);
  return new Map(((data ?? []) as unknown as VariantRow[]).map((v) => [v.id, v]));
}

export interface DeliveryQuote {
  line: CheckoutRawLine;
  snapshot: AmountsSnapshot;
  /** Variantenpreis inklusive Pfand, der gilt (gebunden oder aktuell) */
  priceCents: number;
  pendingIncrease: boolean;
  newLockedPriceCents: number | null;
  clearNotice: boolean;
}

/**
 * Preis je Lieferung eines Abos: Variante mit gebundenem Preis, Abo-Rabatt des Abos
 * (discount_bp), Pfand, Versand nach Schwelle, Steuern. Gleiche Rechnung wie im Checkout.
 */
export function quoteDelivery(
  row: Pick<
    SubscriptionRow,
    | "variant_id"
    | "quantity"
    | "interval_count"
    | "discount_bp"
    | "locked_price_cents"
    | "price_change_effective_at"
  >,
  variant: VariantRow,
  ctx: PricingContext,
  now: Date = new Date(),
): DeliveryQuote {
  const price = effectiveVariantPrice(variant.price_cents, row, now);
  const line: CheckoutRawLine = {
    ...toRawLine(variant, row.quantity, ctx.taxRates),
    priceCents: price.priceCents,
    subscription: { intervalWeeks: row.interval_count, discountBp: row.discount_bp },
  };
  const { snapshot } = buildAmountsSnapshot({
    lines: [line],
    discount: null,
    shippingRates: ctx.shippingRates,
    depositTaxRateBp: ctx.depositTaxRateBp,
    now,
  });
  return {
    line,
    snapshot,
    priceCents: price.priceCents,
    pendingIncrease: price.pendingIncrease,
    newLockedPriceCents: price.newLockedPriceCents,
    clearNotice: price.clearNotice,
  };
}

export interface SubscribableVariant {
  id: string;
  title: string;
  unitCount: number;
  priceCents: number;
  depositCents: number;
}

export interface SubscribableProduct {
  id: string;
  handle: string;
  title: string;
  imageUrl: string | null;
  variants: SubscribableVariant[];
}

/** Abonnierbare Sorten und das Mixed-Produkt mit ihren Packgrößen (Auswahl im Portal). */
export async function loadSubscribableProducts(): Promise<SubscribableProduct[]> {
  const { data, error } = await aboDb()
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .gte("unit_count", 9)
    .order("position", { ascending: true });
  if (error) throw new Error(`Katalog nicht geladen: ${error.message}`);
  const byProduct = new Map<string, SubscribableProduct>();
  for (const v of (data ?? []) as unknown as VariantRow[]) {
    const p = v.products;
    if (
      !p ||
      !isSubscribable({
        productKind: p.kind,
        productStatus: p.status,
        variantActive: v.is_active,
        unitCount: v.unit_count,
        depositCentsPerUnit: p.deposit_cents_per_unit,
      })
    ) {
      continue;
    }
    const entry = byProduct.get(p.id) ?? {
      id: p.id,
      handle: p.handle,
      title: p.product_translations.find((t) => t.locale === "de")?.title ?? p.handle,
      imageUrl: ABO_IMAGE_BY_HANDLE[p.handle] ?? null,
      variants: [],
    };
    entry.variants.push({
      id: v.id,
      title: v.title,
      unitCount: v.unit_count,
      priceCents: v.price_cents,
      depositCents: p.deposit_cents_per_unit * v.unit_count,
    });
    byProduct.set(p.id, entry);
  }
  const order = ["wildberry", "raspberry-lime", "peach"];
  return [...byProduct.values()]
    .map((p) => ({ ...p, variants: p.variants.sort((a, b) => a.unitCount - b.unitCount) }))
    .sort((a, b) => {
      const ia = order.indexOf(a.handle);
      const ib = order.indexOf(b.handle);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}

export type { VariantRow };
