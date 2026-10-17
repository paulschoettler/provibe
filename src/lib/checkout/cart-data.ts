import "server-only";
import { getCartToken, loadShippingRates, loadTaxRates } from "@/lib/cart/server";
import type { UnitMeasure } from "@/lib/pricing";
import { resolveSubscriptionLines } from "@/lib/subscriptions/cart";
import { checkoutDb } from "./db";
import type { CheckoutRawLine, ComponentSnapshot } from "./types";

/**
 * Warenkorb für den Checkout laden. Bewusst eine eigene Abfrage neben src/lib/cart/server.ts,
 * weil der Checkout zusätzlich SKU, Steuerklasse, Untertitel, Bundle-Komponenten und Dosenzahl
 * für Pfandzeile und Bestellsnapshot braucht. Vorschlag an das Paket Warenkorb: loadCartById um
 * einen Export der Rohzeilen erweitern, dann entfällt die Doppelung (siehe Bericht).
 */

const DEFAULT_TAX_RATE_BP = 1900;

/** Gleiche feste Bilder wie src/lib/cart/server.ts und die Startseite. */
const IMAGE_BY_HANDLE: Record<string, string> = {
  wildberry: "/images/cans/wildberry.webp",
  "raspberry-lime": "/images/cans/raspberry-lime.webp",
  peach: "/images/cans/peach.webp",
  "founder-bundle-i": "/images/bundle-1.jpg",
  "founder-bundle-ii": "/images/bundle-2.jpg",
  "founder-bundle-iii-1": "/images/bundle-3.jpg",
};

export interface CheckoutCart {
  id: string;
  customerId: string | null;
  email: string | null;
  discountCodeId: string | null;
  attribution: Record<string, unknown>;
  lines: CheckoutRawLine[];
}

/** Aktiven Warenkorb aus dem httpOnly-Cookie laden, null ohne Warenkorb. */
export async function loadCheckoutCart(): Promise<CheckoutCart | null> {
  const token = await getCartToken();
  if (!token) return null;
  const db = checkoutDb();
  const { data: cart } = await db
    .from("carts")
    .select("id, customer_id, email, discount_code_id, attribution")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return null;
  return {
    id: cart.id,
    customerId: cart.customer_id,
    email: cart.email,
    discountCodeId: cart.discount_code_id,
    attribution: (cart.attribution as Record<string, unknown> | null) ?? {},
    lines: await loadCheckoutLines(cart.id),
  };
}

export async function loadCheckoutLines(cartId: string): Promise<CheckoutRawLine[]> {
  const db = checkoutDb();
  const { data: items } = await db
    .from("cart_items")
    .select("id, variant_id, quantity, added_at")
    .eq("cart_id", cartId)
    .order("added_at", { ascending: true });
  if (!items || items.length === 0) return [];

  const variantIds = items.map((i) => i.variant_id);
  const { data: variants } = await db
    .from("product_variants")
    .select(
      "id, product_id, title, sku, price_cents, unit_count, weight_grams, packaging_weight_grams, is_active",
    )
    .in("id", variantIds);
  if (!variants || variants.length === 0) return [];

  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const [products, translations, images, taxRates, components] = await Promise.all([
    db
      .from("products")
      .select(
        "id, handle, status, kind, tax_class, deposit_cents_per_unit, net_content_per_unit, base_price_measure",
      )
      .in("id", productIds),
    db
      .from("product_translations")
      .select("product_id, title, subtitle")
      .in("product_id", productIds)
      .eq("locale", "de"),
    db
      .from("product_images")
      .select("product_id, storage_bucket, storage_path, position")
      .in("product_id", productIds)
      .order("position", { ascending: true }),
    loadTaxRates(),
    loadBundleComponents(variantIds),
  ]);

  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const translationById = new Map((translations.data ?? []).map((t) => [t.product_id, t]));
  const imageByProduct = new Map<string, string>();
  for (const img of images.data ?? []) {
    if (!imageByProduct.has(img.product_id)) {
      imageByProduct.set(img.product_id, `${img.storage_bucket}/${img.storage_path}`);
    }
  }
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const lines: CheckoutRawLine[] = [];
  for (const item of items) {
    const variant = variantById.get(item.variant_id);
    if (!variant || !variant.is_active) continue;
    const product = productById.get(variant.product_id);
    if (!product || product.status !== "active") continue;
    const translation = translationById.get(product.id);
    // Nur echte Bundles: Packs haben seit H24 auch Komponenten (Dosen als Lagereinheit), bleiben
    // in Anzeige, Pfand und Bestell-Snapshot aber einfache Positionen (ADR-018).
    const bundle = product.kind === "bundle" ? (components.get(variant.id) ?? null) : null;

    // Bundles tragen ihr Pfand nicht am Produkt, sondern in den enthaltenen Dosen (Frage H1).
    const ownDeposit = product.deposit_cents_per_unit;
    const depositCentsPerUnit = ownDeposit > 0 ? ownDeposit : (bundle?.depositCents ?? 0);
    const depositCentsPerCan = ownDeposit > 0 ? ownDeposit : (bundle?.depositPerCan ?? 0);
    const depositCansPerItem = ownDeposit > 0 ? variant.unit_count : (bundle?.cans ?? 0);

    lines.push({
      cartItemId: item.id,
      variantId: variant.id,
      productId: product.id,
      productHandle: product.handle,
      productKind: product.kind,
      productTitle: translation?.title ?? product.handle,
      productSubtitle: translation?.subtitle || bundle?.summary || null,
      variantTitle: variant.title,
      sku: variant.sku,
      unitCount: variant.unit_count,
      quantity: item.quantity,
      priceCents: variant.price_cents,
      depositCentsPerUnit,
      depositCentsPerCan,
      depositCansPerItem,
      netContentPerUnit:
        product.net_content_per_unit === null ? null : Number(product.net_content_per_unit),
      basePriceMeasure: product.base_price_measure as UnitMeasure,
      taxClass: product.tax_class,
      taxRateBp: taxRates.get(product.tax_class) ?? DEFAULT_TAX_RATE_BP,
      weightGrams: (variant.weight_grams ?? 0) + variant.packaging_weight_grams,
      imageUrl: IMAGE_BY_HANDLE[product.handle] ?? publicImage(imageByProduct.get(product.id)),
      components: bundle?.snapshot ?? null,
    });
  }

  // Abo-Positionen (Paket Abo): Intervall und Abo-Rabatt ergänzen, sonst Einmalkauf
  const subscriptions = await resolveSubscriptionLines(
    cartId,
    lines.map((l) => ({ ...l, depositCentsPerUnit: l.depositCentsPerCan })),
  );
  if (subscriptions.size === 0) return lines;
  return lines.map((l) => {
    const info = subscriptions.get(l.cartItemId);
    return info ? { ...l, subscription: info } : l;
  });
}

interface BundleInfo {
  snapshot: ComponentSnapshot[];
  /** Kurzbeschreibung, z.B. "2 Dosen je Sorte und Clear Cup" */
  summary: string;
  canQuantities: number[];
  otherNames: string[];
  /** Pfand aller enthaltenen Dosen je Bundle */
  depositCents: number;
  cans: number;
  depositPerCan: number;
}

async function loadBundleComponents(variantIds: string[]): Promise<Map<string, BundleInfo>> {
  const result = new Map<string, BundleInfo>();
  const db = checkoutDb();
  const { data: comps } = await db
    .from("bundle_components")
    .select("bundle_variant_id, component_variant_id, quantity")
    .in("bundle_variant_id", variantIds);
  if (!comps || comps.length === 0) return result;

  const ids = [...new Set(comps.map((c) => c.component_variant_id))];
  const { data: compVariants } = await db
    .from("product_variants")
    .select(
      "id, sku, title, unit_count, products (handle, deposit_cents_per_unit, product_translations (locale, title))",
    )
    .in("id", ids);
  const byId = new Map((compVariants ?? []).map((v) => [v.id, v]));

  for (const c of comps) {
    const v = byId.get(c.component_variant_id);
    const product = v?.products as {
      handle: string;
      deposit_cents_per_unit: number;
      product_translations: { locale: string; title: string }[];
    } | null;
    const productTitle =
      product?.product_translations.find((t) => t.locale === "de")?.title ?? product?.handle ?? "";
    const info = result.get(c.bundle_variant_id) ?? {
      snapshot: [],
      summary: "",
      canQuantities: [],
      otherNames: [],
      depositCents: 0,
      cans: 0,
      depositPerCan: 0,
    };
    info.snapshot.push({
      variant_id: c.component_variant_id,
      sku: v?.sku ?? null,
      title: productTitle && v ? `${productTitle}, ${v.title}` : (v?.title ?? productTitle),
      quantity: c.quantity,
    });
    const perCan = product?.deposit_cents_per_unit ?? 0;
    if (perCan > 0 && v) {
      const cans = c.quantity * v.unit_count;
      info.cans += cans;
      info.depositCents += cans * perCan;
      info.depositPerCan = perCan;
    }
    if (v && v.unit_count === 1 && /dose/i.test(v.title)) {
      info.canQuantities.push(c.quantity);
    } else if (productTitle) {
      const variant = v && !/^(standard|default)/i.test(v.title) ? ` (${v.title})` : "";
      const name = productTitle
        .replace(/^provibe\s+/i, "")
        .replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase());
      info.otherNames.push(`${name}${variant}`);
    }
    result.set(c.bundle_variant_id, info);
  }
  for (const info of result.values()) info.summary = bundleSummary(info);
  return result;
}

/** "2 Dosen je Sorte und Clear Cup" aus den Komponenten, falls kein Untertitel gepflegt ist. */
function bundleSummary(info: BundleInfo): string {
  const parts: string[] = [];
  const q = info.canQuantities;
  if (q.length > 1 && q.every((n) => n === q[0])) parts.push(`${q[0]} Dosen je Sorte`);
  else if (q.length > 0) parts.push(`${q.reduce((a, b) => a + b, 0)} Dosen`);
  parts.push(...info.otherNames);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

function publicImage(path: string | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${path}`;
}

export { loadShippingRates, loadTaxRates };
