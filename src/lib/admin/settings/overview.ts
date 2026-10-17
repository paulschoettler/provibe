import "server-only";
import { crmDb } from "@/lib/admin/customers/crm-db";
import { selectShippingRate } from "@/lib/pricing/shipping";
import type { ShippingZoneView } from "./shipping";

/**
 * Lesende Übersichten für die Einstellungsseiten: Beispielrechnung Versand (wie im Warenkorb,
 * mit der Logik aus src/lib/pricing) und Steuerklassen je Produktart.
 */

export interface ShippingPreview {
  label: string;
  priceCents: number;
  depositCents: number;
  goodsCents: number;
  shippingCents: number;
  free: boolean;
  toFreeCents: number;
  rateName: string | null;
}

/** Beispiel: 9er-Pack der ersten Sorte in der ersten aktiven Zone. Preis in der DB inkl. Pfand (H22). */
export async function shippingPreview(zones: ShippingZoneView[]): Promise<ShippingPreview | null> {
  const zone = zones.find((z) => z.isEnabled && z.rates.some((r) => r.isEnabled));
  if (!zone) return null;
  const { data } = await crmDb()
    .from("products")
    .select(
      "handle, deposit_cents_per_unit, product_translations(title, locale), product_variants(price_cents, unit_count)",
    )
    .eq("handle", "wildberry")
    .maybeSingle();
  const variant = (data?.product_variants ?? []).find((v) => v.unit_count === 9);
  if (!data || !variant) return null;
  const depositCents = data.deposit_cents_per_unit * variant.unit_count;
  const goodsCents = variant.price_cents - depositCents;
  const selection = selectShippingRate(
    zone.rates
      .filter((r) => r.isEnabled)
      .map((r) => ({
        id: r.id,
        name: r.name,
        priceCents: r.priceCents,
        freeAboveSubtotalCents: r.freeAboveSubtotalCents,
        minSubtotalCents: r.minSubtotalCents,
        maxSubtotalCents: r.maxSubtotalCents,
        minWeightGrams: r.minWeightGrams,
        maxWeightGrams: r.maxWeightGrams,
        taxRateBp: 1900,
      })),
    goodsCents,
    0,
  );
  const title = data.product_translations?.find((t) => t.locale === "de")?.title ?? data.handle;
  return {
    label: `${variant.unit_count} Dosen ${title}`,
    priceCents: variant.price_cents,
    depositCents,
    goodsCents,
    shippingCents: selection.priceCents,
    free: selection.free,
    toFreeCents: selection.amountToFreeShippingCents,
    rateName: selection.rate?.name ?? null,
  };
}

export interface ProductTaxGroup {
  productType: string;
  taxClass: string;
  count: number;
  examples: string[];
}

export async function taxClassesByProductType(): Promise<ProductTaxGroup[]> {
  const { data } = await crmDb()
    .from("products")
    .select("handle, product_type, tax_class, status")
    .neq("status", "archived");
  const map = new Map<string, ProductTaxGroup>();
  for (const p of data ?? []) {
    const type = p.product_type || "ohne Produktart";
    const key = `${type}|${p.tax_class}`;
    const g = map.get(key) ?? { productType: type, taxClass: p.tax_class, count: 0, examples: [] };
    g.count++;
    if (g.examples.length < 3) g.examples.push(p.handle);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.productType.localeCompare(b.productType, "de"));
}
