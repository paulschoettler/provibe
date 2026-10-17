import { supabaseAnon } from "@/lib/supabase/server";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";
import type { Database } from "@/lib/supabase/database.types";
import { listProducts } from "./products";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type TranslationRow = Database["public"]["Tables"]["product_translations"]["Row"];
type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];

import { flavorPalette, type FlavorPalette } from "./palette";

export type { FlavorPalette };

/** Eine Sorte für Hero, Scroll-Sequenz und Sortenkarten. Alle Werte serverseitig berechnet. */
export interface HomeFlavor {
  handle: string;
  slug: "wildberry" | "raspberry-lime" | "peach";
  title: string;
  shortName: string;
  subtitle: string | null;
  notes: string;
  palette: FlavorPalette;
  ingredientsHtml: string | null;
  allergens: string | null;
  nutrition: Record<string, string | number> | null;
  badges: string[];
  /** 9er-Pack: Variante, Preis, Pfand, Grundpreis */
  pack: {
    variantId: string;
    sku: string | null;
    unitCount: number;
    /** Datenbankpreis inklusive Pfand */
    priceCents: number;
    /** Preis ohne Pfand, Hauptpreis jeder Anzeige (§ 7 PAngV, Entscheidung H22) */
    priceWithoutDepositCents: number;
    depositCents: number;
    basePriceText: string;
  };
  /** Preis je Dose ohne Pfand (Anzeige in den Sortenkarten wie im alten Shop) */
  perCanCents: number;
  depositPerCanCents: number;
  imageUrl: string;
  modelUrl2k: string;
  modelUrl1k: string;
  productUrl: string;
}

export interface HomeBundle {
  handle: string;
  title: string;
  /** Datenbankpreis inklusive Pfand */
  priceCents: number;
  /** Preis ohne Pfand, Hauptpreis der Karte (H22) */
  priceWithoutDepositCents: number;
  /** Pfand der enthaltenen Dosen (H1), getrennt neben dem Preis */
  depositCents: number;
  /** Summe der Komponentenpreise inklusive Pfand (Datenbankwert) */
  componentsSumCents: number;
  /** Summe der Komponentenpreise ohne Pfand ("Einzeln: X €") */
  componentsSumWithoutDepositCents: number;
  imageUrl: string;
  productUrl: string;
  badge: string;
}

export interface HomeData {
  flavors: HomeFlavor[];
  bundles: HomeBundle[];
  modules: Record<string, Record<string, unknown>>;
  menus: { main: MenuItem[]; footerQuick: MenuItem[] };
  announcements: string[];
  settings: Record<string, unknown>;
}

export interface MenuItem {
  label: string;
  url: string;
  external: boolean;
}

const FLAVOR_ORDER = ["wildberry", "raspberry-lime", "peach"] as const;
const FLAVOR_SHORT: Record<string, string> = {
  wildberry: "Wildberry",
  "raspberry-lime": "Raspberry Lime",
  peach: "Peach",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function getHomeData(locale = "de"): Promise<HomeData> {
  const db = supabaseAnon();

  const [
    products,
    translations,
    variants,
    bundlesCollection,
    modules,
    menus,
    menuItems,
    announcements,
    settings,
  ] = await Promise.all([
    db.from("products").select("*").eq("status", "active"),
    db.from("product_translations").select("*").eq("locale", locale),
    db.from("product_variants").select("*").eq("is_active", true).order("position"),
    db.from("collections").select("id, handle").eq("handle", "aktion").maybeSingle(),
    db.from("homepage_modules").select("*").eq("is_enabled", true).order("position"),
    db.from("menus").select("id, handle"),
    db.from("menu_items").select("*").order("position"),
    db.from("announcement_messages").select("message").eq("is_active", true).order("position"),
    db.from("shop_settings").select("key, value").eq("is_public", true),
  ]);

  const productList = (products.data ?? []) as ProductRow[];
  const translationByProduct = new Map<string, TranslationRow>();
  for (const t of (translations.data ?? []) as TranslationRow[])
    translationByProduct.set(t.product_id, t);
  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of (variants.data ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const flavors: HomeFlavor[] = [];
  for (const slug of FLAVOR_ORDER) {
    const product = productList.find((p) => p.handle === slug);
    if (!product) continue;
    const t = translationByProduct.get(product.id);
    const pack = (variantsByProduct.get(product.id) ?? []).find((v) => v.unit_count === 9);
    if (!t || !pack) continue;
    const attrs = asRecord(product.attributes);
    const palette = flavorPalette(product.handle);
    const depositCents = product.deposit_cents_per_unit * pack.unit_count;
    const basePrice = calculateBasePrice({
      priceCents: pack.price_cents,
      depositCentsPerUnit: product.deposit_cents_per_unit,
      unitCount: pack.unit_count,
      netContentPerUnit: product.net_content_per_unit,
      measure: product.base_price_measure as UnitMeasure,
    });
    const perCan = Math.round((pack.price_cents - depositCents) / pack.unit_count);
    const badges = ["15 g Protein", "Ohne Zucker"];
    if (attrs.lactose_free === true) badges.push("Laktosefrei");
    flavors.push({
      handle: product.handle,
      slug,
      title: t.title,
      shortName: FLAVOR_SHORT[slug],
      subtitle: t.subtitle,
      notes: typeof attrs.notes === "string" ? attrs.notes : "",
      palette,
      ingredientsHtml: t.ingredients_html,
      allergens: t.allergens,
      nutrition: (t.nutrition as Record<string, string | number> | null) ?? null,
      badges,
      pack: {
        variantId: pack.id,
        sku: pack.sku,
        unitCount: pack.unit_count,
        priceCents: pack.price_cents,
        priceWithoutDepositCents: basePrice.priceWithoutDepositCents,
        depositCents,
        basePriceText: formatBasePrice(basePrice),
      },
      perCanCents: perCan,
      depositPerCanCents: product.deposit_cents_per_unit,
      imageUrl: `/images/cans/${slug}.webp`,
      modelUrl2k: `/3d/${slug}-2k.glb`,
      modelUrl1k: `/3d/${slug}-1k.glb`,
      productUrl: `/products/${product.handle}`,
    });
  }

  // Founder Bundles aus der Kollektion "aktion", Reihenfolge wie dort
  const bundles: HomeBundle[] = [];
  if (bundlesCollection.data) {
    // Bundle-Pfand steckt in den Komponenten (H1); der Katalog rechnet es samt Einzelsumme heraus
    const catalogBundles = await listProducts({ filter: "bundles", locale });
    const { data: cp } = await db
      .from("collection_products")
      .select("product_id, position")
      .eq("collection_id", bundlesCollection.data.id)
      .order("position");
    const imageByHandle: Record<string, string> = {
      "founder-bundle-i": "/images/bundle-1.jpg",
      "founder-bundle-ii": "/images/bundle-2.jpg",
      "founder-bundle-iii-1": "/images/bundle-3.jpg",
    };
    for (const row of cp ?? []) {
      const product = productList.find((p) => p.id === row.product_id);
      const t = product ? translationByProduct.get(product.id) : undefined;
      const first = product ? (variantsByProduct.get(product.id) ?? [])[0] : undefined;
      if (!product || !t || !first) continue;
      const { data: sum } = await db.rpc("bundle_components_sum_cents", {
        p_bundle_variant_id: first.id,
      });
      const componentsSumCents = typeof sum === "number" ? sum : 0;
      const view = catalogBundles
        .find((b) => b.handle === product.handle)
        ?.variants.find((v) => v.id === first.id);
      const depositCents = view?.depositCents ?? 0;
      bundles.push({
        handle: product.handle,
        title: t.title,
        priceCents: first.price_cents,
        priceWithoutDepositCents: first.price_cents - depositCents,
        depositCents,
        componentsSumCents,
        componentsSumWithoutDepositCents: Math.max(0, componentsSumCents - depositCents),
        imageUrl: imageByHandle[product.handle] ?? "/images/bundle-1.jpg",
        productUrl: `/products/${product.handle}`,
        badge: "Limitiertes Set",
      });
    }
  }

  const moduleMap: Record<string, Record<string, unknown>> = {};
  for (const m of modules.data ?? []) moduleMap[m.kind] = asRecord(m.config);

  const menuId = (handle: string) => (menus.data ?? []).find((m) => m.handle === handle)?.id;
  const items = (handle: string): MenuItem[] =>
    (menuItems.data ?? [])
      .filter((i) => i.menu_id === menuId(handle))
      .map((i) => ({
        label: String(asRecord(i.label)[locale] ?? ""),
        url: i.url,
        external: i.is_external,
      }));

  const settingsMap: Record<string, unknown> = {};
  for (const s of settings.data ?? []) settingsMap[s.key] = s.value;

  return {
    flavors,
    bundles,
    modules: moduleMap,
    menus: { main: items("main"), footerQuick: items("footer-quick") },
    announcements: (announcements.data ?? []).map((a) => a.message),
    settings: settingsMap,
  };
}
