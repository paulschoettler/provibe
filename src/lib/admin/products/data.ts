import "server-only";
import type { Database, Json } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env/public";
import { buildPublicImageUrl } from "@/lib/admin/media/rules";
import { db } from "./access";
import { escapeSearch } from "./result";
import {
  basePricePreview,
  productListFilterSchema,
  type BasePricePreview,
  type ProductInput,
  type ProductListFilter,
  type VariantInput,
} from "./rules";

/**
 * Lesender Datenzugriff für Produktliste und Produkt-Editor (Service-Role, nur Server).
 * Schreibende Funktionen stehen in write.ts.
 */

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type TranslationRow = Database["public"]["Tables"]["product_translations"]["Row"];
type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type LevelRow = Database["public"]["Tables"]["inventory_levels"]["Row"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
type ProductKind = Database["public"]["Enums"]["product_kind"];
type CompareAtKind = Database["public"]["Enums"]["compare_at_kind"];
type UnitMeasure = Database["public"]["Enums"]["unit_measure"];

export function imageUrl(bucket: string, path: string): string {
  return buildPublicImageUrl(publicEnv.supabaseUrl, bucket, path);
}

function altOf(alt: Json, locale: string): string {
  const rec = alt && typeof alt === "object" && !Array.isArray(alt) ? alt : {};
  const v = (rec as Record<string, unknown>)[locale];
  return typeof v === "string" ? v : "";
}

/* ------------------------------------------------------------------------------------------ */
/* Liste                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export interface ProductListItem {
  id: string;
  handle: string;
  title: string;
  status: ProductStatus;
  kind: ProductKind;
  tags: string[];
  position: number;
  imageUrl: string | null;
  imageAlt: string;
  variantCount: number;
  activeVariantCount: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  /** Summe on_hand der geführten Varianten; null bei Bundles oder wenn nichts geführt wird */
  onHand: number | null;
  trackedVariants: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProductListPage {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** alle vorkommenden Tags, für den Filter */
  tags: string[];
}

export async function listProducts(filter: ProductListFilter = {}): Promise<ProductListPage> {
  const f = productListFilterSchema.parse(filter);
  const client = db();

  let restrictIds: string[] | null = null;
  if (f.collectionId) {
    const { data } = await client
      .from("collection_products")
      .select("product_id")
      .eq("collection_id", f.collectionId);
    restrictIds = (data ?? []).map((r) => r.product_id);
  }

  let query = client
    .from("products")
    .select(
      "id, handle, status, kind, tags, position, updated_at, created_at, product_translations (locale, title), product_variants (id, price_cents, is_active), product_images (storage_bucket, storage_path, position, alt)",
    )
    .limit(2000);
  if (f.status !== "all") query = query.eq("status", f.status);
  if (f.kind !== "all") query = query.eq("kind", f.kind);
  if (f.tag) query = query.contains("tags", [f.tag.toLowerCase()]);
  if (restrictIds)
    query = query.in(
      "id",
      restrictIds.length ? restrictIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const q = f.q ? escapeSearch(f.q) : "";
  if (q) {
    const [byTitle, bySku] = await Promise.all([
      client.from("product_translations").select("product_id").ilike("title", `%${q}%`),
      client.from("product_variants").select("product_id").ilike("sku", `%${q}%`),
    ]);
    const ids = [
      ...new Set([...(byTitle.data ?? []), ...(bySku.data ?? [])].map((r) => r.product_id)),
    ];
    query = ids.length
      ? query.or(`handle.ilike.*${q}*,id.in.(${ids.join(",")})`)
      : query.ilike("handle", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Produktliste: ${error.message}`);
  const rows = data ?? [];

  const variantIds = rows.flatMap((r) => r.product_variants.map((v) => v.id));
  const levels = await loadLevels(variantIds);

  const allTags = new Set<string>();
  const items: ProductListItem[] = rows.map((r) => {
    r.tags.forEach((t) => allTags.add(t));
    const title =
      r.product_translations.find((t) => t.locale === "de")?.title ??
      r.product_translations[0]?.title ??
      r.handle;
    const image = [...r.product_images].sort((a, b) => a.position - b.position)[0];
    const active = r.product_variants.filter((v) => v.is_active);
    const prices = (active.length ? active : r.product_variants).map((v) => v.price_cents);
    let onHand = 0;
    let tracked = 0;
    if (r.kind === "simple") {
      for (const v of r.product_variants) {
        const l = levels.get(v.id);
        if (l?.track_inventory) {
          tracked++;
          onHand += l.on_hand;
        }
      }
    }
    return {
      id: r.id,
      handle: r.handle,
      title,
      status: r.status,
      kind: r.kind,
      tags: r.tags,
      position: r.position,
      imageUrl: image ? imageUrl(image.storage_bucket, image.storage_path) : null,
      imageAlt: image ? altOf(image.alt, "de") || title : "",
      variantCount: r.product_variants.length,
      activeVariantCount: active.length,
      priceMinCents: prices.length ? Math.min(...prices) : null,
      priceMaxCents: prices.length ? Math.max(...prices) : null,
      onHand: tracked ? onHand : null,
      trackedVariants: tracked,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    };
  });

  const collator = new Intl.Collator("de");
  items.sort((a, b) => {
    switch (f.sort) {
      case "title":
        return collator.compare(a.title, b.title);
      case "updated":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "created":
        return b.createdAt.localeCompare(a.createdAt);
      default:
        return a.position - b.position || collator.compare(a.title, b.title);
    }
  });

  const start = (f.page - 1) * f.pageSize;
  return {
    items: items.slice(start, start + f.pageSize),
    total: items.length,
    page: f.page,
    pageSize: f.pageSize,
    tags: [...allTags].sort(),
  };
}

async function loadLevels(variantIds: string[]): Promise<Map<string, LevelRow>> {
  const map = new Map<string, LevelRow>();
  if (!variantIds.length) return map;
  for (let i = 0; i < variantIds.length; i += 300) {
    const { data } = await db()
      .from("inventory_levels")
      .select("*")
      .in("variant_id", variantIds.slice(i, i + 300));
    for (const l of data ?? []) map.set(l.variant_id, l);
  }
  return map;
}

/* ------------------------------------------------------------------------------------------ */
/* Editor                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface TranslationView {
  locale: string;
  title: string;
  subtitle: string | null;
  descriptionHtml: string | null;
  deliveryTimeText: string | null;
  seo: { title: string | null; description: string | null; ogImagePath: string | null };
  lmiv: {
    foodName: string | null;
    ingredientsHtml: string | null;
    allergens: string | null;
    nutrition: Json | null;
    storageInstructions: string | null;
    foodBusinessOperator: string | null;
    countryOfOrigin: string | null;
  };
  faq: { q: string; a: string }[];
}

export interface BundleComponentView {
  componentVariantId: string;
  quantity: number;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  unitCount: number;
  priceCents: number;
  isActive: boolean;
}

export interface VariantEditView {
  id: string;
  title: string;
  optionValues: Record<string, string>;
  position: number;
  priceCents: number;
  compareAtCents: number | null;
  compareAtKind: CompareAtKind;
  sku: string | null;
  legacySku: string | null;
  gtin: string | null;
  weightGrams: number | null;
  packagingWeightGrams: number;
  unitCount: number;
  isActive: boolean;
  /** Pfand der Variante (Pfand je Einheit × Einheiten) */
  depositCents: number;
  basePrice: BasePricePreview | { error: string } | null;
  /** niedrigster Preis der letzten 30 Tage (price_history), Referenz für frühere Preise */
  lowestPrice30dCents: number | null;
  /** nur Bundles: Summe der Komponentenpreise ("Einzeln: X €") */
  componentsSumCents: number | null;
  inventory: {
    onHand: number;
    reserved: number;
    available: number | null;
    lowStockThreshold: number;
    trackInventory: boolean;
    allowBackorder: boolean;
  } | null;
  components: BundleComponentView[];
}

export interface ImageEditView {
  id: string;
  variantId: string | null;
  bucket: string;
  storagePath: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  altAll: Record<string, string>;
  position: number;
}

export interface CollectionMembership {
  id: string;
  handle: string;
  title: string;
  kind: "manual" | "automatic";
  status: Database["public"]["Enums"]["publish_status"];
  member: boolean;
  position: number | null;
}

export interface ProductEditData {
  product: {
    id: string;
    handle: string;
    status: ProductStatus;
    kind: ProductKind;
    vendor: string;
    productType: string | null;
    tags: string[];
    taxClass: string;
    isFood: boolean;
    depositCentsPerUnit: number;
    unitLabel: string;
    netContentPerUnit: number | null;
    netContentMeasure: UnitMeasure;
    basePriceMeasure: UnitMeasure;
    weightGramsPerUnit: number | null;
    attributes: Record<string, unknown>;
    position: number;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    shopifyProductId: number | null;
  };
  locale: string;
  translation: TranslationView | null;
  translations: TranslationView[];
  options: { id: string; name: string; position: number; values: string[] }[];
  variants: VariantEditView[];
  images: ImageEditView[];
  collections: CollectionMembership[];
  taxClasses: { value: string; label: string; rateBp: number }[];
  /** Vorbelegung für das Formular (saveProduct / saveVariants) */
  formInput: ProductInput;
  variantsInput: VariantInput[];
}

function toTranslationView(t: TranslationRow): TranslationView {
  const faq = Array.isArray(t.faq)
    ? (t.faq as { q?: unknown; a?: unknown }[])
        .filter((x) => typeof x?.q === "string" && typeof x?.a === "string")
        .map((x) => ({ q: x.q as string, a: x.a as string }))
    : [];
  return {
    locale: t.locale,
    title: t.title,
    subtitle: t.subtitle,
    descriptionHtml: t.description_html,
    deliveryTimeText: t.delivery_time_text,
    seo: { title: t.seo_title, description: t.seo_description, ogImagePath: t.og_image_path },
    lmiv: {
      foodName: t.food_name,
      ingredientsHtml: t.ingredients_html,
      allergens: t.allergens,
      nutrition: t.nutrition,
      storageInstructions: t.storage_instructions,
      foodBusinessOperator: t.food_business_operator,
      countryOfOrigin: t.country_of_origin,
    },
    faq,
  };
}

function asStringRecord(v: Json): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (val != null) out[k] = String(val);
  return out;
}

function asRecord(v: Json): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function getProductForEdit(
  id: string,
  locale = "de",
): Promise<ProductEditData | null> {
  const client = db();
  const { data: p, error } = await client.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Produkt: ${error.message}`);
  if (!p) return null;

  const [translations, options, variants, images, memberships, collections, taxRates] =
    await Promise.all([
      client.from("product_translations").select("*").eq("product_id", id),
      client.from("product_options").select("*").eq("product_id", id).order("position"),
      client.from("product_variants").select("*").eq("product_id", id).order("position"),
      client.from("product_images").select("*").eq("product_id", id).order("position"),
      client.from("collection_products").select("collection_id, position").eq("product_id", id),
      client
        .from("collections")
        .select("id, handle, kind, status, position, collection_translations (locale, title)")
        .order("position"),
      client
        .from("tax_rates")
        .select("tax_class, rate_bp, name, country_code")
        .eq("country_code", "DE"),
    ]);

  const variantRows: VariantRow[] = variants.data ?? [];
  const levels = await loadLevels(variantRows.map((v) => v.id));
  const components =
    p.kind === "bundle" ? await loadComponents(variantRows.map((v) => v.id)) : new Map();

  const perVariant = await Promise.all(
    variantRows.map(async (v) => {
      const [lowest, available, sum] = await Promise.all([
        client.rpc("lowest_price_last_30_days", { p_variant_id: v.id }),
        client.rpc("available_quantity", { p_variant_id: v.id }),
        p.kind === "bundle"
          ? client.rpc("bundle_components_sum_cents", { p_bundle_variant_id: v.id })
          : Promise.resolve({ data: null }),
      ]);
      return {
        lowest: typeof lowest.data === "number" ? lowest.data : null,
        available: typeof available.data === "number" ? available.data : null,
        sum: typeof sum.data === "number" ? sum.data : null,
      };
    }),
  );

  const productView = toProductView(p);
  const variantViews: VariantEditView[] = variantRows.map((v, i) => {
    const level = levels.get(v.id);
    return {
      id: v.id,
      title: v.title,
      optionValues: asStringRecord(v.option_values),
      position: v.position,
      priceCents: v.price_cents,
      compareAtCents: v.compare_at_cents,
      compareAtKind: v.compare_at_kind,
      sku: v.sku,
      legacySku: v.legacy_sku,
      gtin: v.gtin,
      weightGrams: v.weight_grams,
      packagingWeightGrams: v.packaging_weight_grams,
      unitCount: v.unit_count,
      isActive: v.is_active,
      depositCents: p.deposit_cents_per_unit * v.unit_count,
      basePrice: basePricePreview(
        {
          kind: p.kind,
          depositCentsPerUnit: p.deposit_cents_per_unit,
          netContentPerUnit: p.net_content_per_unit,
          basePriceMeasure: p.base_price_measure,
        },
        { priceCents: v.price_cents, unitCount: v.unit_count },
      ),
      lowestPrice30dCents: perVariant[i].lowest,
      componentsSumCents: perVariant[i].sum,
      inventory: level
        ? {
            onHand: level.on_hand,
            reserved: level.reserved,
            available: perVariant[i].available,
            lowStockThreshold: level.low_stock_threshold,
            trackInventory: level.track_inventory,
            allowBackorder: level.allow_backorder,
          }
        : null,
      components: components.get(v.id) ?? [],
    };
  });

  const imageViews: ImageEditView[] = (images.data ?? []).map((img: ImageRow) => ({
    id: img.id,
    variantId: img.variant_id,
    bucket: img.storage_bucket,
    storagePath: img.storage_path,
    url: imageUrl(img.storage_bucket, img.storage_path),
    width: img.width,
    height: img.height,
    alt: altOf(img.alt, locale),
    altAll: asStringRecord(img.alt),
    position: img.position,
  }));

  const memberMap = new Map((memberships.data ?? []).map((m) => [m.collection_id, m.position]));
  const collectionViews: CollectionMembership[] = (collections.data ?? []).map((c) => ({
    id: c.id,
    handle: c.handle,
    title:
      c.collection_translations.find((t) => t.locale === locale)?.title ??
      c.collection_translations[0]?.title ??
      c.handle,
    kind: c.kind === "automatic" ? "automatic" : "manual",
    status: c.status,
    member: memberMap.has(c.id),
    position: memberMap.get(c.id) ?? null,
  }));

  const translationViews = (translations.data ?? []).map(toTranslationView);
  const translation = translationViews.find((t) => t.locale === locale) ?? null;

  const taxClasses = (taxRates.data ?? [])
    .map((t) => ({ value: t.tax_class, label: t.name, rateBp: t.rate_bp }))
    .filter((t, i, all) => all.findIndex((x) => x.value === t.value) === i);

  return {
    product: productView,
    locale,
    translation,
    translations: translationViews,
    options: (options.data ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      position: o.position,
      values: o.values,
    })),
    variants: variantViews,
    images: imageViews,
    collections: collectionViews,
    taxClasses,
    formInput: toFormInput(productView, translation, locale, collectionViews),
    variantsInput: variantViews.map((v) => ({
      id: v.id,
      title: v.title,
      optionValues: v.optionValues,
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      compareAtKind: v.compareAtKind === "quantity_reference" ? "none" : v.compareAtKind,
      sku: v.sku,
      gtin: v.gtin,
      weightGrams: v.weightGrams,
      packagingWeightGrams: v.packagingWeightGrams,
      unitCount: v.unitCount,
      isActive: v.isActive,
      position: v.position,
    })),
  };
}

function toProductView(p: ProductRow): ProductEditData["product"] {
  return {
    id: p.id,
    handle: p.handle,
    status: p.status,
    kind: p.kind,
    vendor: p.vendor,
    productType: p.product_type,
    tags: p.tags,
    taxClass: p.tax_class,
    isFood: p.is_food,
    depositCentsPerUnit: p.deposit_cents_per_unit,
    unitLabel: p.unit_label,
    netContentPerUnit: p.net_content_per_unit == null ? null : Number(p.net_content_per_unit),
    netContentMeasure: p.net_content_measure,
    basePriceMeasure: p.base_price_measure,
    weightGramsPerUnit: p.weight_grams_per_unit,
    attributes: asRecord(p.attributes),
    position: p.position,
    publishedAt: p.published_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    shopifyProductId: p.shopify_product_id,
  };
}

function toFormInput(
  p: ProductEditData["product"],
  t: TranslationView | null,
  locale: string,
  collections: CollectionMembership[],
): ProductInput {
  return {
    id: p.id,
    locale,
    title: t?.title ?? p.handle,
    handle: p.handle,
    status: p.status,
    kind: p.kind,
    subtitle: t?.subtitle ?? null,
    descriptionHtml: t?.descriptionHtml ?? null,
    deliveryTimeText: t?.deliveryTimeText ?? null,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    attributes: p.attributes as ProductInput["attributes"],
    position: p.position,
    isFood: p.isFood,
    depositCentsPerUnit: p.depositCentsPerUnit,
    unitLabel: p.unitLabel,
    netContentPerUnit: p.netContentPerUnit,
    netContentMeasure: p.netContentMeasure,
    basePriceMeasure: p.basePriceMeasure,
    weightGramsPerUnit: p.weightGramsPerUnit,
    taxClass: p.taxClass,
    lmiv: {
      ...(t?.lmiv ?? {
        foodName: null,
        ingredientsHtml: null,
        allergens: null,
        storageInstructions: null,
        foodBusinessOperator: null,
        countryOfOrigin: null,
      }),
      nutrition: (t?.lmiv.nutrition ?? null) as never,
    },
    seo: t?.seo ?? { title: null, description: null, ogImagePath: null },
    faq: t?.faq ?? [],
    collectionIds: collections.filter((c) => c.member && c.kind === "manual").map((c) => c.id),
  };
}

async function loadComponents(
  bundleVariantIds: string[],
): Promise<Map<string, BundleComponentView[]>> {
  const map = new Map<string, BundleComponentView[]>();
  if (!bundleVariantIds.length) return map;
  const { data, error } = await db()
    .from("bundle_components")
    .select(
      "bundle_variant_id, component_variant_id, quantity, product_variants!bundle_components_component_variant_id_fkey (id, title, unit_count, price_cents, is_active, product_id, products (handle, product_translations (locale, title)))",
    )
    .in("bundle_variant_id", bundleVariantIds);
  if (error) throw new Error(`Bundle-Komponenten: ${error.message}`);
  for (const r of data ?? []) {
    const v = r.product_variants as unknown as {
      id: string;
      title: string;
      unit_count: number;
      price_cents: number;
      is_active: boolean;
      product_id: string;
      products: { handle: string; product_translations: { locale: string; title: string }[] };
    };
    const list = map.get(r.bundle_variant_id) ?? [];
    list.push({
      componentVariantId: r.component_variant_id,
      quantity: r.quantity,
      productId: v.product_id,
      productHandle: v.products.handle,
      productTitle:
        v.products.product_translations.find((t) => t.locale === "de")?.title ?? v.products.handle,
      variantTitle: v.title,
      unitCount: v.unit_count,
      priceCents: v.price_cents,
      isActive: v.is_active,
    });
    map.set(r.bundle_variant_id, list);
  }
  for (const list of map.values())
    list.sort((a, b) => a.productTitle.localeCompare(b.productTitle, "de"));
  return map;
}

/* ------------------------------------------------------------------------------------------ */
/* Auswahl für Bundle-Komponenten                                                              */
/* ------------------------------------------------------------------------------------------ */

export interface ComponentCandidate {
  variantId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  priceCents: number;
  isActive: boolean;
  sku: string | null;
}

/**
 * Varianten, die als Bundle-Komponente taugen (H14): Einzelprodukte, nicht archiviert,
 * unit_count 1. Inaktive Varianten sind erlaubt ("1 Dose (Bundle-Komponente)").
 */
export async function listComponentCandidates(): Promise<ComponentCandidate[]> {
  const { data, error } = await db()
    .from("product_variants")
    .select(
      "id, title, price_cents, is_active, sku, unit_count, product_id, products!inner (handle, kind, status, product_translations (locale, title))",
    )
    .eq("unit_count", 1)
    .eq("products.kind", "simple")
    .neq("products.status", "archived");
  if (error) throw new Error(`Komponenten: ${error.message}`);
  return (data ?? [])
    .map((v) => {
      const prod = v.products as unknown as {
        handle: string;
        product_translations: { locale: string; title: string }[];
      };
      return {
        variantId: v.id,
        productId: v.product_id,
        productHandle: prod.handle,
        productTitle:
          prod.product_translations.find((t) => t.locale === "de")?.title ?? prod.handle,
        variantTitle: v.title,
        priceCents: v.price_cents,
        isActive: v.is_active,
        sku: v.sku,
      };
    })
    .sort(
      (a, b) =>
        a.productTitle.localeCompare(b.productTitle, "de") ||
        a.variantTitle.localeCompare(b.variantTitle, "de"),
    );
}
