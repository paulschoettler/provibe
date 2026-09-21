import "server-only";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env/public";
import type { ShippingRateRule, UnitMeasure } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildCartView, type CartRawLine } from "./mapping";
import { CART_COOKIE, EMPTY_CART, type CartView } from "./types";

/**
 * Serverseitiges Laden des Warenkorbs. carts und cart_items haben bewusst keine anon-Policies
 * (siehe supabase/migrations/20260921121300_rls.sql), deshalb läuft jeder Zugriff über den
 * Service-Role-Client in Server-Code. Der Browser kennt nur das httpOnly-Cookie mit dem Token.
 */

/** Ziel-Land dieser Phase: nur Deutschland (Österreich ist vorbereitet, aber abgeschaltet). */
export const CART_COUNTRY = "DE";
const DEFAULT_TAX_RATE_BP = 1900;

/** Feste Bilder für Sorten und Bundles, gleiche Quelle wie die Startseite (src/lib/catalog/home.ts). */
const IMAGE_BY_HANDLE: Record<string, string> = {
  wildberry: "/images/cans/wildberry.webp",
  "raspberry-lime": "/images/cans/raspberry-lime.webp",
  peach: "/images/cans/peach.webp",
  "founder-bundle-i": "/images/bundle-1.jpg",
  "founder-bundle-ii": "/images/bundle-2.jpg",
  "founder-bundle-iii-1": "/images/bundle-3.jpg",
};

export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

/** Bequemer Einstieg für Server Components: Cookie lesen und Warenkorb laden. */
export async function getCart(): Promise<CartView> {
  return loadCart(await getCartToken());
}

export async function loadCart(token: string | null): Promise<CartView> {
  if (!token) return EMPTY_CART;
  const db = supabaseAdmin();

  const { data: cart } = await db
    .from("carts")
    .select("id, updated_at")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return EMPTY_CART;

  return loadCartById(cart.id, cart.updated_at);
}

/** Warenkorb anhand der ID laden (nach einer Schreiboperation in den Server Actions). */
export async function loadCartById(cartId: string, updatedAt: string | null): Promise<CartView> {
  const db = supabaseAdmin();

  const { data: items } = await db
    .from("cart_items")
    .select("id, variant_id, quantity, added_at")
    .eq("cart_id", cartId)
    .order("added_at", { ascending: true });

  if (!items || items.length === 0) {
    return { ...EMPTY_CART, id: cartId, updatedAt };
  }

  const variantIds = items.map((i) => i.variant_id);
  const { data: variants } = await db
    .from("product_variants")
    .select(
      "id, product_id, title, price_cents, unit_count, weight_grams, packaging_weight_grams, is_active",
    )
    .in("id", variantIds);
  if (!variants || variants.length === 0) {
    return { ...EMPTY_CART, id: cartId, updatedAt };
  }

  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const [products, translations, images, taxRates, shippingRates, bundleDeposits] =
    await Promise.all([
      db
        .from("products")
        .select(
          "id, handle, status, kind, tax_class, deposit_cents_per_unit, net_content_per_unit, base_price_measure",
        )
        .in("id", productIds),
      db
        .from("product_translations")
        .select("product_id, title")
        .in("product_id", productIds)
        .eq("locale", "de"),
      db
        .from("product_images")
        .select("product_id, storage_bucket, storage_path, position")
        .in("product_id", productIds)
        .order("position", { ascending: true }),
      loadTaxRates(),
      loadShippingRates(),
      loadBundleDeposits(variantIds),
    ]);

  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const titleByProduct = new Map((translations.data ?? []).map((t) => [t.product_id, t.title]));
  const imageByProduct = new Map<string, string>();
  for (const img of images.data ?? []) {
    if (!imageByProduct.has(img.product_id)) {
      imageByProduct.set(img.product_id, publicStorageUrl(img.storage_bucket, img.storage_path));
    }
  }
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const rawLines: CartRawLine[] = [];
  for (const item of items) {
    const variant = variantById.get(item.variant_id);
    if (!variant || !variant.is_active) continue;
    const product = productById.get(variant.product_id);
    if (!product || product.status !== "active") continue;

    // Bundles tragen ihr Pfand nicht am Produkt, sondern in den Komponenten (Dosen).
    const bundleDeposit = bundleDeposits.get(variant.id) ?? 0;
    const depositCentsPerUnit =
      product.deposit_cents_per_unit > 0 ? product.deposit_cents_per_unit : bundleDeposit;

    rawLines.push({
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      productHandle: product.handle,
      productTitle: titleByProduct.get(product.id) ?? product.handle,
      variantTitle: variant.title,
      unitCount: variant.unit_count,
      quantity: item.quantity,
      priceCents: variant.price_cents,
      depositCentsPerUnit,
      netContentPerUnit:
        product.net_content_per_unit === null ? null : Number(product.net_content_per_unit),
      basePriceMeasure: product.base_price_measure as UnitMeasure,
      taxRateBp: taxRates.get(product.tax_class) ?? DEFAULT_TAX_RATE_BP,
      weightGrams: (variant.weight_grams ?? 0) + variant.packaging_weight_grams,
      imageUrl: IMAGE_BY_HANDLE[product.handle] ?? imageByProduct.get(product.id) ?? null,
      productUrl: `/products/${product.handle}`,
    });
  }

  return buildCartView({
    cartId,
    updatedAt,
    lines: rawLines,
    shippingRates,
    depositTaxRateBp: taxRates.get("standard") ?? DEFAULT_TAX_RATE_BP,
  });
}

/** Steuersätze für das Lieferland, je Steuerklasse (rate_bp: 1900 = 19 %). */
export async function loadTaxRates(country = CART_COUNTRY): Promise<Map<string, number>> {
  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("tax_rates")
    .select("tax_class, rate_bp, valid_from, valid_to")
    .eq("country_code", country)
    .lte("valid_from", today)
    .order("valid_from", { ascending: true });
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.valid_to !== null && row.valid_to < today) continue;
    map.set(row.tax_class, row.rate_bp);
  }
  return map;
}

/** Aktive Versandtarife der Zone des Lieferlands, übersetzt in die Regelform der Preislogik. */
export async function loadShippingRates(country = CART_COUNTRY): Promise<ShippingRateRule[]> {
  const db = supabaseAdmin();
  const { data: zones } = await db
    .from("shipping_zones")
    .select("id")
    .eq("is_enabled", true)
    .contains("country_codes", [country]);
  if (!zones || zones.length === 0) return [];

  const [rates, taxRates] = await Promise.all([
    db
      .from("shipping_rates")
      .select(
        "id, name, price_cents, free_above_subtotal_cents, min_subtotal_cents, max_subtotal_cents, min_weight_grams, max_weight_grams, tax_class, delivery_time_text",
      )
      .in(
        "zone_id",
        zones.map((z) => z.id),
      )
      .eq("is_enabled", true)
      .order("position", { ascending: true }),
    loadTaxRates(country),
  ]);

  return (rates.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    priceCents: r.price_cents,
    freeAboveSubtotalCents: r.free_above_subtotal_cents,
    minSubtotalCents: r.min_subtotal_cents,
    maxSubtotalCents: r.max_subtotal_cents,
    minWeightGrams: r.min_weight_grams,
    maxWeightGrams: r.max_weight_grams,
    taxRateBp: taxRates.get(r.tax_class) ?? DEFAULT_TAX_RATE_BP,
    deliveryTimeText: r.delivery_time_text,
  }));
}

/**
 * Pfandsumme je Bundle-Variante aus den Komponenten (z.B. 6 Dosen à 25 Cent = 150 Cent).
 * Bundles selbst haben deposit_cents_per_unit = 0, das Pfand steckt in den enthaltenen Dosen.
 */
async function loadBundleDeposits(variantIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (variantIds.length === 0) return result;
  const db = supabaseAdmin();

  const { data: components } = await db
    .from("bundle_components")
    .select("bundle_variant_id, component_variant_id, quantity")
    .in("bundle_variant_id", variantIds);
  if (!components || components.length === 0) return result;

  const componentIds = [...new Set(components.map((c) => c.component_variant_id))];
  const { data: componentVariants } = await db
    .from("product_variants")
    .select("id, unit_count, products (deposit_cents_per_unit)")
    .in("id", componentIds);

  const depositByVariant = new Map<string, number>();
  for (const v of componentVariants ?? []) {
    const product = v.products as { deposit_cents_per_unit: number } | null;
    depositByVariant.set(v.id, (product?.deposit_cents_per_unit ?? 0) * v.unit_count);
  }

  for (const c of components) {
    const deposit = (depositByVariant.get(c.component_variant_id) ?? 0) * c.quantity;
    result.set(c.bundle_variant_id, (result.get(c.bundle_variant_id) ?? 0) + deposit);
  }
  return result;
}

function publicStorageUrl(bucket: string, path: string): string {
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
