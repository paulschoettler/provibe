import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Datenzugriff für Shop-Übersicht, Kollektionen, Produktseiten und Suche (Paket Katalog).
 *
 * Alles hier läuft serverseitig mit dem anonymen Client (RLS: nur aktive Produkte, nur
 * veröffentlichte Kollektionen). Preise, Pfand, Preis je Dose und Grundpreis rechnet
 * ausschließlich src/lib/pricing; diese Datei setzt nur zusammen und formatiert Texte.
 *
 * Die reinen Hilfsfunktionen (Typ, Sortierung, Filter, Nährwerte, Bundle-Texte) sind exportiert
 * und in products.test.ts ohne Datenbank getestet. Deshalb hier kein "server-only"-Import:
 * der Service-Role-Client wird nur im Fallback dynamisch geladen.
 */

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type TranslationRow = Database["public"]["Tables"]["product_translations"]["Row"];
type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];
type CollectionTranslationRow = Database["public"]["Tables"]["collection_translations"]["Row"];

/* ------------------------------------------------------------------------------------------ */
/* Typen                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export type ProductType = "sorte" | "mixed" | "bundle" | "merch";
export type CatalogFilter = "alle" | "eistee" | "bundles" | "merch";
export type CatalogSort = "beliebt" | "preis-auf" | "preis-ab";

export const CATALOG_FILTERS: { value: CatalogFilter; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "eistee", label: "Eistee" },
  { value: "bundles", label: "Bundles" },
  { value: "merch", label: "Merch" },
];

export const CATALOG_SORTS: {
  value: CatalogSort;
  label: string;
  arrow?: string;
  srText?: string;
}[] = [
  { value: "beliebt", label: "Beliebt" },
  { value: "preis-auf", label: "Preis", arrow: "↑", srText: "aufsteigend" },
  { value: "preis-ab", label: "Preis", arrow: "↓", srText: "absteigend" },
];

export interface FlavorPalette {
  from: string;
  via: string;
  to: string;
  accent: string;
}

export interface CatalogImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Eine kaufbare Variante mit fertig gerechneten Preisangaben (alle Beträge in Cent). */
export interface VariantView {
  id: string;
  /** Datenbanktitel, z.B. "9 Dosen" oder "M" */
  title: string;
  /** Wert der Option (Menge oder Größe), z.B. "9" oder "M" */
  optionValue: string | null;
  unitCount: number;
  /** Verkaufspreis der Variante, brutto, inklusive Pfand (so steht er in der Datenbank) */
  priceCents: number;
  /**
   * Preis ohne Pfand (priceCents − depositCents). Das ist der Gesamtpreis im Sinne der PAngV und
   * der Hauptpreis jeder Anzeige; das Pfand steht getrennt daneben (§ 7 PAngV, Entscheidung H22).
   */
  goodsPriceCents: number;
  /** Pfand der Variante gesamt (unitCount × Pfand je Dose, bei Bundles aus den Komponenten) */
  depositCents: number;
  /** Pfand je Dose */
  depositPerUnitCents: number;
  /** Preis je Einheit ohne Pfand (calculateBasePrice mit Bezug Stück) */
  perUnitCents: number;
  /** Grundpreis nach PAngV, z.B. "8,03 € / l"; null bei Artikeln ohne Grundpreispflicht */
  basePriceText: string | null;
  /** Grundpreis in Cent je Liter bzw. Kilogramm (ohne Pfand), null ohne Grundpreispflicht */
  basePriceCents: number | null;
  /** Summe der Komponentenpreise bei Bundles inklusive Pfand (Datenbankwert), sonst null */
  componentsSumCents: number | null;
  /** Summe der Komponentenpreise ohne Pfand ("Einzeln: X €", Entscheidung H22), sonst null */
  componentsSumGoodsCents: number | null;
  available: boolean;
  sku: string | null;
}

export interface BundleComponentView {
  quantity: number;
  productHandle: string;
  /** Anzeigename, z.B. "Wildberry" oder "provibe Trinkbecher" */
  label: string;
  kind: "dose" | "becher" | "shirt" | "sonstiges";
  imageUrl: string | null;
  /** Einheiten je Komponente (Dosen) und Pfand je Einheit, für die Pfandzeile des Bundles */
  unitCount: number;
  depositCentsPerUnit: number;
}

/** Lebensmittelangaben einer Sorte, die in einem Bundle steckt (LMIV gilt auch für Sets). */
export interface ComponentFood {
  handle: string;
  name: string;
  ingredientsHtml: string | null;
  allergens: string | null;
}

/** Produkt in Listen (Karten). */
export interface CatalogProduct {
  id: string;
  handle: string;
  type: ProductType;
  /** Titel aus der Datenbank, z.B. "Wildberry Eistee" */
  title: string;
  /** Kurzname für Karten und H1, z.B. "Wildberry", "Mixed", "Founder Bundle I" */
  shortTitle: string;
  subtitle: string | null;
  /** Erste Zeile unter dem Titel, z.B. "Eistee · 0,33 l", "Limitiertes Set" */
  line1: string;
  /** Zweite Zeile in Plum, z.B. Geschmacksnoten oder "6 Dosen und Trinkbecher" */
  line2: string | null;
  tags: string[];
  isFood: boolean;
  palette: FlavorPalette;
  image: CatalogImage | null;
  variants: VariantView[];
  /** Standardvariante: 9er-Pack bei Eistee, sonst erste Variante */
  defaultVariant: VariantView;
  /** Kleinster Packpreis aller Varianten inklusive Pfand (Sortierung) */
  priceFromCents: number;
  /** Preis ohne Pfand der günstigsten Variante (Anzeige "ab …", Entscheidung H22) */
  priceFromGoodsCents: number;
  /** Pfand der günstigsten Variante, getrennt neben priceFromGoodsCents anzuzeigen */
  priceFromDepositCents: number;
  /** true, wenn sich die Varianten im Preis unterscheiden */
  hasPriceRange: boolean;
  /** Nettofüllmenge je Einheit als Text, z.B. "0,33 l" */
  netContentText: string | null;
  /** Name der Variantenoption ("Menge", "Größe") oder null bei nur einer Variante */
  optionName: string | null;
  productUrl: string;
  badge: string;
  sortRank: number;
}

export interface NutritionRow {
  label: string;
  /** Werte je Spalte (bei Mixed eine Spalte je Sorte) */
  values: string[];
  indent: boolean;
  strong: boolean;
}

export interface NutritionTable {
  per: string;
  columns: string[];
  rows: NutritionRow[];
}

export interface ProductDetail extends CatalogProduct {
  descriptionHtml: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  deliveryTimeText: string | null;
  foodName: string | null;
  ingredientsHtml: string | null;
  allergens: string | null;
  nutrition: NutritionTable | null;
  storageInstructions: string | null;
  /** true, wenn der Lagerhinweis aus der Annahme H13 stammt und noch nicht gepflegt ist */
  storageIsFallback: boolean;
  foodBusinessOperator: string | null;
  countryOfOrigin: string | null;
  gallery: CatalogImage[];
  stickers: string[];
  faq: { q: string; a: string }[];
  /** Protein je Einheit in Gramm (attributes.protein_g_per_unit), null wenn nicht gepflegt */
  proteinPerUnitG: number | null;
  /** Kurzer Einleitungssatz aus dem ersten fett gesetzten Absatz der Beschreibung */
  lead: string | null;
  /** Beschreibung ohne den Einleitungssatz */
  bodyHtml: string | null;
  /** Bundles: Komponenten der Standardvariante */
  bundleComponents: BundleComponentView[];
  /** Bundles: Lebensmittelangaben der enthaltenen Sorten */
  componentFoods: ComponentFood[];
  /** Kollektion für Brotkrumen, z.B. { title: "Eistee", url: "/collections/eistee" } */
  breadcrumbCollection: { title: string; url: string } | null;
  related: CatalogProduct[];
}

export interface CollectionSummary {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
  url: string;
}

export interface CollectionPage {
  collection: CollectionSummary;
  products: CatalogProduct[];
  /** Anzahl ohne Filter */
  totalCount: number;
  filter: CatalogFilter;
  sort: CatalogSort;
}

/* ------------------------------------------------------------------------------------------ */
/* Konstanten                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const FLAVOR_ORDER = ["wildberry", "raspberry-lime", "peach"];
const FLAVOR_SHORT: Record<string, string> = {
  wildberry: "Wildberry",
  "raspberry-lime": "Raspberry Lime",
  peach: "Peach",
};
const DEFAULT_PALETTE: FlavorPalette = {
  from: "#F7DCEB",
  via: "#E98AB0",
  to: "#B5578C",
  accent: "#702249",
};
/** Feste Motive wie auf der Startseite (src/lib/catalog/home.ts) und im Warenkorb */
const FIXED_IMAGES: Record<string, CatalogImage> = {
  wildberry: { src: "/images/cans/wildberry.webp", alt: "", width: 750, height: 1400 },
  "raspberry-lime": { src: "/images/cans/raspberry-lime.webp", alt: "", width: 405, height: 760 },
  peach: { src: "/images/cans/peach.webp", alt: "", width: 405, height: 760 },
  "founder-bundle-i": { src: "/images/bundle-1.jpg", alt: "", width: 1400, height: 924 },
  "founder-bundle-ii": { src: "/images/bundle-2.jpg", alt: "", width: 1400, height: 924 },
  "founder-bundle-iii-1": { src: "/images/bundle-3.jpg", alt: "", width: 1400, height: 924 },
};
/** Zeile 1 für Merch-Artikel ohne eigenes Datenfeld */
const MERCH_LINE1: Record<string, string> = {
  "provibe-shirt": "T-Shirt · Unisex",
  "provibe-clear-cup": "Trinkbecher",
};
/** Lagerhinweis laut Annahme H13, bis der Text vom Etikett gepflegt ist */
export const STORAGE_FALLBACK =
  "Kühl und trocken lagern, vor Sonnenlicht schützen, gekühlt servieren.";
const STICKER_BY_ATTRIBUTE: [string, string][] = [
  ["sugar_free", "Ohne Zucker"],
  ["lactose_free", "Laktosefrei"],
];

/* ------------------------------------------------------------------------------------------ */
/* Reine Hilfsfunktionen (getestet)                                                            */
/* ------------------------------------------------------------------------------------------ */

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Produkttyp aus den Daten: Bundle über kind, Merch über Tag, Sorte hat eine Sortenpalette. */
export function productTypeOf(p: {
  kind: string;
  tags: string[];
  attributes: Json | Record<string, unknown>;
}): ProductType {
  if (p.kind === "bundle") return "bundle";
  if (p.tags.includes("merch")) return "merch";
  if (p.tags.includes("eistee")) {
    return asRecord(asRecord(p.attributes).palette).from ? "sorte" : "mixed";
  }
  return "merch";
}

/** Kurzname für Karten und Überschrift. */
export function shortTitleOf(handle: string, type: ProductType, title: string): string {
  if (FLAVOR_SHORT[handle]) return FLAVOR_SHORT[handle];
  if (type === "mixed") return "Mixed";
  if (type === "sorte") return title.replace(/\s+Eistee$/i, "").replace(/-/g, " ");
  return title;
}

/** Sortierrang für "Beliebt" in automatischen Listen: Sorten, Mix, Bundles, Merch. */
export function sortRankOf(handle: string, type: ProductType, title: string): number {
  const typeRank = { sorte: 0, mixed: 1, bundle: 2, merch: 3 }[type];
  const flavorIndex = FLAVOR_ORDER.indexOf(handle);
  const within = flavorIndex >= 0 ? flavorIndex : 0;
  // Titel als Feinsortierung (Founder Bundle I, II, III; Shirt vor Becher wie im Entwurf)
  const titleKey = type === "merch" ? (handle.includes("shirt") ? 0 : 1) : romanOrder(title);
  return typeRank * 1000 + within * 10 + titleKey;
}

function romanOrder(title: string): number {
  const m = title.match(/\b(I{1,3})\s*$/);
  return m ? m[1].length : 0;
}

/** Nettofüllmenge als Text, z.B. 0.33 l → "0,33 l". */
export function netContentText(net: number | null, measure: string): string | null {
  if (!net || net <= 0 || measure === "piece") return null;
  const value = net.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  return `${value} ${measure === "kg" ? "kg" : "l"}`;
}

/**
 * Preisangaben einer Variante. Der Datenbankpreis enthält das Pfand (siehe src/lib/cart/mapping.ts),
 * calculateBasePrice zieht es ab und liefert Preis ohne Pfand, Grundpreis je Liter und Preis je
 * Dose. Angezeigt wird immer der Preis ohne Pfand, das Pfand getrennt daneben (H22).
 */
export function buildVariantView(input: {
  variant: Pick<
    VariantRow,
    "id" | "title" | "option_values" | "unit_count" | "price_cents" | "sku"
  >;
  depositCentsPerUnit: number;
  netContentPerUnit: number | null;
  measure: UnitMeasure;
  componentsSumCents?: number | null;
  available?: boolean;
}): VariantView {
  const { variant } = input;
  // Pfand kann nie über dem Preis liegen (gleiche Absicherung wie im Warenkorb)
  const deposit =
    input.depositCentsPerUnit * variant.unit_count > variant.price_cents
      ? 0
      : input.depositCentsPerUnit;
  const perUnit = calculateBasePrice({
    priceCents: variant.price_cents,
    depositCentsPerUnit: deposit,
    unitCount: variant.unit_count,
    netContentPerUnit: null,
    measure: "piece",
  });
  const hasBasePrice = input.measure !== "piece" && !!input.netContentPerUnit;
  const basePrice = hasBasePrice
    ? calculateBasePrice({
        priceCents: variant.price_cents,
        depositCentsPerUnit: deposit,
        unitCount: variant.unit_count,
        netContentPerUnit: input.netContentPerUnit,
        measure: input.measure,
      })
    : null;
  const options = asRecord(variant.option_values);
  const optionValue = Object.values(options).map(String)[0] ?? null;
  return {
    id: variant.id,
    title: variant.title,
    optionValue,
    unitCount: variant.unit_count,
    priceCents: variant.price_cents,
    goodsPriceCents: perUnit.priceWithoutDepositCents,
    depositCents: perUnit.depositCents,
    depositPerUnitCents: deposit,
    perUnitCents: perUnit.cents,
    basePriceText: basePrice ? formatBasePrice(basePrice) : null,
    basePriceCents: basePrice ? basePrice.cents : null,
    componentsSumCents: input.componentsSumCents ?? null,
    // Komponenten tragen ihr Pfand im Datenbankpreis, das Bundle-Pfand ist genau deren Summe (H1)
    componentsSumGoodsCents:
      input.componentsSumCents != null
        ? Math.max(0, input.componentsSumCents - perUnit.depositCents)
        : null,
    available: input.available ?? true,
    sku: variant.sku,
  };
}

/** Standardvariante: 9er-Pack, sonst die erste aktive Variante. */
export function pickDefaultVariant(variants: VariantView[]): VariantView | undefined {
  return variants.find((v) => v.unitCount === 9) ?? variants[0];
}

export function matchesFilter(p: Pick<CatalogProduct, "type">, filter: CatalogFilter): boolean {
  switch (filter) {
    case "eistee":
      return p.type === "sorte" || p.type === "mixed";
    case "bundles":
      return p.type === "bundle";
    case "merch":
      return p.type === "merch";
    default:
      return true;
  }
}

/**
 * Sortierung. "beliebt" nutzt die Position in der Kollektion (falls übergeben), sonst den
 * Sortierrang. Preis sortiert nach dem kleinsten Packpreis, bei Gleichstand stabil.
 */
export function sortProducts<
  T extends Pick<CatalogProduct, "priceFromCents" | "sortRank" | "handle">,
>(products: T[], sort: CatalogSort, positions?: Map<string, number>): T[] {
  const rank = (p: T) => positions?.get(p.handle) ?? p.sortRank;
  const byRank = (a: T, b: T) => rank(a) - rank(b) || a.handle.localeCompare(b.handle);
  const copy = [...products];
  if (sort === "preis-auf")
    return copy.sort((a, b) => a.priceFromCents - b.priceFromCents || byRank(a, b));
  if (sort === "preis-ab")
    return copy.sort((a, b) => b.priceFromCents - a.priceFromCents || byRank(a, b));
  return copy.sort(byRank);
}

/** Suchparameter der Kollektionsseite prüfen, Unbekanntes fällt auf den Standard zurück. */
export function parseCatalogParams(params: Record<string, string | string[] | undefined>): {
  filter: CatalogFilter;
  sort: CatalogSort;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const f = one(params.filter);
  const s = one(params.sort);
  return {
    filter: CATALOG_FILTERS.some((x) => x.value === f) ? (f as CatalogFilter) : "alle",
    sort: CATALOG_SORTS.some((x) => x.value === s) ? (s as CatalogSort) : "beliebt",
  };
}

/** URL einer Kollektion mit Filter und Sortierung, Standardwerte entfallen. */
export function catalogHref(base: string, filter: CatalogFilter, sort: CatalogSort): string {
  const q = new URLSearchParams();
  if (filter !== "alle") q.set("filter", filter);
  if (sort !== "beliebt") q.set("sort", sort);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const NUTRITION_FIELDS: {
  key: string;
  label: string;
  unit: string;
  indent?: boolean;
  strong?: boolean;
}[] = [
  { key: "fat_g", label: "Fett", unit: "g" },
  { key: "saturated_fat_g", label: "davon gesättigte Fettsäuren", unit: "g", indent: true },
  { key: "carbs_g", label: "Kohlenhydrate", unit: "g" },
  { key: "sugar_g", label: "davon Zucker", unit: "g", indent: true },
  { key: "fibre_g", label: "Ballaststoffe", unit: "g" },
  { key: "protein_g", label: "Eiweiß", unit: "g", strong: true },
  { key: "salt_g", label: "Salz", unit: "g" },
];

function formatNutrient(value: unknown, unit: string): string {
  if (value === null || value === undefined || value === "") return "–";
  const raw = typeof value === "number" ? value.toLocaleString("de-DE") : String(value).trim();
  // "<0,5" → "< 0,5 g"
  return `${raw.replace(/^<\s*/, "< ")} ${unit}`;
}

/**
 * Nährwerttabelle aus product_translations.nutrition. Bei Mixed stehen die Werte je Sorte unter
 * "variants"; dann gibt es eine Spalte je Sorte in der festen Reihenfolge.
 */
export function nutritionTable(nutrition: Json | null): NutritionTable | null {
  const n = asRecord(nutrition);
  if (Object.keys(n).length === 0) return null;
  const variants = asRecord(n.variants);
  const columnKeys = Object.keys(variants).length
    ? FLAVOR_ORDER.filter((k) => k in variants).concat(
        Object.keys(variants).filter((k) => !FLAVOR_ORDER.includes(k)),
      )
    : [null];
  const sources = columnKeys.map((k) => (k ? asRecord(variants[k]) : n));
  const columns = columnKeys.map((k) =>
    k ? (FLAVOR_SHORT[k] ?? k) : `je ${String(n.per ?? "100 ml")}`,
  );
  const energy = (s: Record<string, unknown>) =>
    s.energy_kj !== undefined || s.energy_kcal !== undefined
      ? `${formatNumber(s.energy_kj)} kJ / ${formatNumber(s.energy_kcal)} kcal`
      : "–";
  const rows: NutritionRow[] = [
    { label: "Energie", values: sources.map(energy), indent: false, strong: false },
    ...NUTRITION_FIELDS.map((f) => ({
      label: f.label,
      values: sources.map((s) => formatNutrient(s[f.key], f.unit)),
      indent: !!f.indent,
      strong: !!f.strong,
    })),
  ];
  return { per: String(n.per ?? "100 ml"), columns, rows };
}

function formatNumber(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("de-DE");
  return v === undefined || v === null ? "–" : String(v);
}

/** Art einer Bundle-Komponente aus Tags und Handle. */
export function componentKind(handle: string, tags: string[]): BundleComponentView["kind"] {
  if (tags.includes("eistee")) return "dose";
  if (handle.includes("cup") || handle.includes("becher")) return "becher";
  if (handle.includes("shirt")) return "shirt";
  return "sonstiges";
}

/** Kurzbeschreibung eines Bundles aus den Komponenten, z.B. "6 Dosen, Becher und Shirt". */
export function bundleSummary(
  components: Pick<BundleComponentView, "kind" | "quantity">[],
): string | null {
  if (components.length === 0) return null;
  const cans = components.filter((c) => c.kind === "dose").reduce((s, c) => s + c.quantity, 0);
  const hasCup = components.some((c) => c.kind === "becher");
  const hasShirt = components.some((c) => c.kind === "shirt");
  const head = cans > 0 ? `${cans} ${cans === 1 ? "Dose" : "Dosen"}` : null;
  if (hasCup && hasShirt) return [head, "Becher und Shirt"].filter(Boolean).join(", ");
  const extra = hasCup ? "Trinkbecher" : hasShirt ? "T-Shirt" : null;
  if (head && extra) return `${head} und ${extra}`;
  return head ?? extra;
}

/**
 * Produkttexte kommen aus Shopify und tragen Editor-Attribute (data-start, data-end …).
 * Diese und leere Absätze fallen weg; Skripte und Event-Handler werden zur Sicherheit entfernt,
 * obwohl die Texte nur aus dem Backoffice kommen.
 */
export function cleanDescriptionHtml(html: string | null): string | null {
  if (!html) return null;
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+data-[a-z-]+(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, "")
    .replace(/<p>\s*(&nbsp;| )?\s*<\/p>/gi, "")
    .replace(/<li>\s*<\/li>/gi, "")
    .trim();
  return cleaned || null;
}

/**
 * Ersten Absatz abtrennen, wenn er nur aus fettem Text besteht (Shopify-Muster
 * "<p><strong>Das ultimative provibe Bundle!</strong></p>"). Er dient als Unterzeile unter der H1.
 */
export function splitLead(html: string | null): { lead: string | null; body: string | null } {
  if (!html) return { lead: null, body: null };
  const m = html.match(/^\s*<p>\s*<strong>([^<]+)<\/strong>\s*<\/p>\s*/i);
  if (!m) return { lead: null, body: html };
  const rest = html.slice(m[0].length).trim();
  return { lead: m[1].trim(), body: rest || null };
}

/** HTML zu reinem Text (Meta-Description, JSON-LD). */
export function htmlToText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|li|h\d)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text auf eine Länge kürzen, an einer Wortgrenze, mit Auslassungszeichen. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  // Endet der Schnitt genau vor einem Leerzeichen, ist das letzte Wort vollständig
  const atSpace = text.charAt(max - 1) === " " ? cut.length : cut.lastIndexOf(" ");
  return `${(atSpace > max * 0.6 ? cut.slice(0, atSpace) : cut).replace(/[\s,.;:]+$/, "")} …`;
}

/** Öffentliche URL eines Bildes im Supabase-Storage. */
export function publicStorageUrl(bucket: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Datenbank                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/**
 * Anonymer Client wie supabaseAnon(), zusätzlich mit Cache-Tag "catalog" auf lesenden Abfragen,
 * damit das Backoffice später per revalidateTag("catalog") gezielt erneuern kann.
 */
function catalogDb() {
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method ?? "GET").toUpperCase();
        if (method !== "GET") return fetch(input, init);
        return fetch(input, {
          ...init,
          next: { revalidate: 3600, tags: ["catalog"] },
        } as RequestInit);
      },
    },
  });
}

type Db = ReturnType<typeof catalogDb>;

interface RawCatalog {
  products: ProductRow[];
  translations: Map<string, TranslationRow>;
  variants: Map<string, VariantRow[]>;
  images: Map<string, ImageRow[]>;
  collections: CollectionRow[];
  collectionTranslations: Map<string, CollectionTranslationRow>;
  collectionProducts: Map<string, { product_id: string; position: number }[]>;
  bundles: Map<string, BundleData>;
}

interface BundleData {
  components: BundleComponentView[];
  depositCentsPerUnit: number;
  componentsSumCents: number;
}

interface RawComponent {
  component_variant_id: string;
  quantity: number;
  product_handle: string;
  product_title: string;
  product_tags: string[];
  variant_title: string;
  unit_count: number;
  price_cents: number;
  deposit_cents_per_unit: number;
}

/** Alle Katalogdaten in einem Durchgang, pro Request bzw. Build einmal (React cache). */
const loadRawCatalog = cache(async (locale: string): Promise<RawCatalog> => {
  const db = catalogDb();
  const [products, translations, variants, images, collections, collTranslations, collProducts] =
    await Promise.all([
      db.from("products").select("*").eq("status", "active").order("position"),
      db.from("product_translations").select("*").eq("locale", locale),
      db.from("product_variants").select("*").eq("is_active", true).order("position"),
      db.from("product_images").select("*").order("position"),
      db.from("collections").select("*").eq("status", "published").order("position"),
      db.from("collection_translations").select("*").eq("locale", locale),
      db
        .from("collection_products")
        .select("collection_id, product_id, position")
        .order("position"),
    ]);
  if (products.error)
    throw new Error(`Katalog konnte nicht geladen werden: ${products.error.message}`);

  const group = <T, K>(rows: T[], key: (r: T) => K) => {
    const map = new Map<K, T[]>();
    for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
    return map;
  };

  const productRows = (products.data ?? []) as ProductRow[];
  const variantMap = group((variants.data ?? []) as VariantRow[], (v) => v.product_id);
  for (const list of variantMap.values())
    list.sort((a, b) => a.unit_count - b.unit_count || a.position - b.position);

  const bundleVariantIds = productRows
    .filter((p) => p.kind === "bundle")
    .flatMap((p) => (variantMap.get(p.id) ?? []).map((v) => v.id));

  return {
    products: productRows,
    translations: new Map(
      ((translations.data ?? []) as TranslationRow[]).map((t) => [t.product_id, t]),
    ),
    variants: variantMap,
    images: group((images.data ?? []) as ImageRow[], (i) => i.product_id),
    collections: (collections.data ?? []) as CollectionRow[],
    collectionTranslations: new Map(
      ((collTranslations.data ?? []) as CollectionTranslationRow[]).map((t) => [
        t.collection_id,
        t,
      ]),
    ),
    collectionProducts: group(
      (collProducts.data ?? []) as {
        collection_id: string;
        product_id: string;
        position: number;
      }[],
      (r) => r.collection_id,
    ),
    bundles: await loadBundles(db, bundleVariantIds, locale),
  };
});

/**
 * Komponenten und Einzelsumme je Bundle-Variante. Normalweg: SECURITY-DEFINER-Funktionen aus
 * Migration 20261017101000 (die Komponenten sind inaktive Varianten und für anon per RLS
 * unsichtbar). Solange die Migration remote fehlt, liest der Service-Role-Client serverseitig.
 */
async function loadBundles(
  db: Db,
  variantIds: string[],
  locale: string,
): Promise<Map<string, BundleData>> {
  const result = new Map<string, BundleData>();
  if (variantIds.length === 0) return result;

  type RpcCaller = (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  let rpc = db.rpc.bind(db) as unknown as RpcCaller;

  const probe = await rpc("bundle_components_public", {
    p_bundle_variant_id: variantIds[0],
    p_locale: locale,
  });
  if (probe.error) {
    rpc = await adminRpc();
  }

  await Promise.all(
    variantIds.map(async (id) => {
      const [comps, sum] = await Promise.all([
        rpc("bundle_components_public", { p_bundle_variant_id: id, p_locale: locale }),
        rpc("bundle_components_sum_cents", { p_bundle_variant_id: id }),
      ]);
      const rows = (Array.isArray(comps.data) ? comps.data : []) as RawComponent[];
      result.set(id, {
        components: sortComponents(rows.map(toComponentView)),
        depositCentsPerUnit: rows.reduce(
          (s, r) => s + r.quantity * r.unit_count * r.deposit_cents_per_unit,
          0,
        ),
        componentsSumCents: typeof sum.data === "number" ? sum.data : 0,
      });
    }),
  );
  return result;
}

/**
 * Übergang bis zur Migration: dieselben Daten über den Service-Role-Client (nur Server, nur
 * lesend, nur Bundles aktiver Produkte). Die Antwort hat dieselbe Form wie die RPC-Funktion.
 */
async function adminRpc() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  return async (fn: string, args: Record<string, unknown>) => {
    const id = String(args.p_bundle_variant_id);
    if (fn === "bundle_components_sum_cents") {
      return admin.rpc("bundle_components_sum_cents", { p_bundle_variant_id: id });
    }
    const { data, error } = await admin
      .from("bundle_components")
      .select(
        "quantity, component_variant_id, product_variants!bundle_components_component_variant_id_fkey (title, option_values, unit_count, price_cents, products (handle, tags, position, deposit_cents_per_unit, product_translations (locale, title)))",
      )
      .eq("bundle_variant_id", id);
    if (error) return { data: null, error };
    type Joined = {
      quantity: number;
      component_variant_id: string;
      product_variants: {
        title: string;
        unit_count: number;
        price_cents: number;
        products: {
          handle: string;
          tags: string[];
          position: number;
          deposit_cents_per_unit: number;
          product_translations: { locale: string; title: string }[];
        } | null;
      } | null;
    };
    const rows = ((data ?? []) as unknown as Joined[])
      .filter((r) => r.product_variants?.products)
      .map((r) => {
        const v = r.product_variants!;
        const p = v.products!;
        return {
          component_variant_id: r.component_variant_id,
          quantity: r.quantity,
          product_handle: p.handle,
          product_title:
            p.product_translations.find((t) => t.locale === args.p_locale)?.title ?? p.handle,
          product_tags: p.tags,
          variant_title: v.title,
          unit_count: v.unit_count,
          price_cents: v.price_cents,
          deposit_cents_per_unit: p.deposit_cents_per_unit,
          position: p.position,
        };
      })
      .sort((a, b) => b.position - a.position || a.product_handle.localeCompare(b.product_handle));
    return { data: rows, error: null };
  };
}

/** Reihenfolge im Set: Dosen in Sortenreihenfolge, dann Becher, dann Shirt. */
export function sortComponents(list: BundleComponentView[]): BundleComponentView[] {
  const kindRank = { dose: 0, becher: 1, shirt: 2, sonstiges: 3 };
  const flavorRank = (h: string) => (FLAVOR_ORDER.includes(h) ? FLAVOR_ORDER.indexOf(h) : 99);
  return [...list].sort(
    (a, b) =>
      kindRank[a.kind] - kindRank[b.kind] ||
      flavorRank(a.productHandle) - flavorRank(b.productHandle) ||
      a.productHandle.localeCompare(b.productHandle),
  );
}

function toComponentView(r: RawComponent): BundleComponentView {
  const kind = componentKind(r.product_handle, r.product_tags ?? []);
  const label =
    kind === "dose"
      ? (FLAVOR_SHORT[r.product_handle] ?? r.product_title)
      : kind === "becher"
        ? "provibe Trinkbecher"
        : kind === "shirt"
          ? "T-Shirt „Looks Like You Have Great Taste“ (Unisex)"
          : r.product_title;
  return {
    quantity: r.quantity,
    productHandle: r.product_handle,
    label,
    kind,
    imageUrl: FIXED_IMAGES[r.product_handle]?.src ?? null,
    unitCount: r.unit_count,
    depositCentsPerUnit: r.deposit_cents_per_unit,
  };
}

/** Kartenbild: Dose, Bundle-Foto, sonst erstes Produktbild aus dem Storage, sonst Platzhalter. */
function cardImage(
  raw: RawCatalog,
  p: ProductRow,
  title: string,
  type: ProductType,
): CatalogImage | null {
  const fixed = FIXED_IMAGES[p.handle];
  if (fixed) return { ...fixed, alt: type === "sorte" ? `Dose provibe ${title}` : title };
  if (type === "mixed") return null; // Karte zeigt die drei Sortendosen
  const img = (raw.images.get(p.id) ?? [])[0];
  if (!img) return null;
  return {
    src: publicStorageUrl(img.storage_bucket, img.storage_path),
    alt: String(asRecord(img.alt).de ?? title),
    width: img.width ?? 1200,
    height: img.height ?? 1200,
  };
}

function toCatalogProduct(raw: RawCatalog, p: ProductRow): CatalogProduct | null {
  const t = raw.translations.get(p.id);
  const rows = raw.variants.get(p.id) ?? [];
  if (!t || rows.length === 0) return null;
  const type = productTypeOf(p);
  const attrs = asRecord(p.attributes);
  const measure = p.base_price_measure as UnitMeasure;
  const variants = rows.map((v) => {
    const bundle = raw.bundles.get(v.id);
    return buildVariantView({
      variant: v,
      depositCentsPerUnit: bundle ? bundle.depositCentsPerUnit : p.deposit_cents_per_unit,
      netContentPerUnit: p.net_content_per_unit,
      measure,
      componentsSumCents: bundle ? bundle.componentsSumCents : null,
    });
  });
  const defaultVariant = pickDefaultVariant(variants)!;
  const shortTitle = shortTitleOf(p.handle, type, t.title);
  const prices = variants.map((v) => v.priceCents);
  // Günstigste Variante nach Preis ohne Pfand (Anzeige "ab …"), bei Gleichstand die erste
  const fromVariant = variants.reduce((min, v) =>
    v.goodsPriceCents < min.goodsPriceCents ? v : min,
  );
  const net = netContentText(p.net_content_per_unit, p.net_content_measure);
  const firstBundle = raw.bundles.get(rows[0].id);
  const optionKey = Object.keys(asRecord(rows[0].option_values))[0] ?? null;

  let line1: string;
  let line2: string | null;
  if (type === "sorte" || type === "mixed") {
    line1 = ["Eistee", net].filter(Boolean).join(" · ");
    line2 =
      typeof attrs.notes === "string" && attrs.notes
        ? attrs.notes
        : type === "mixed"
          ? "Alle drei Sorten gemischt"
          : t.subtitle;
  } else if (type === "bundle") {
    line1 = "Limitiertes Set";
    line2 = bundleSummary(firstBundle?.components ?? []);
  } else {
    line1 = MERCH_LINE1[p.handle] ?? "Merch";
    const sizes = rows
      .map((v) => Object.values(asRecord(v.option_values)).map(String)[0])
      .filter(Boolean);
    line2 =
      rows.length > 1 && sizes.length > 1
        ? `Größen ${sizes[0]} bis ${sizes[sizes.length - 1]}`
        : "Einzelartikel";
  }

  return {
    id: p.id,
    handle: p.handle,
    type,
    title: t.title,
    shortTitle,
    subtitle: t.subtitle,
    line1,
    line2,
    tags: p.tags,
    isFood: p.is_food,
    palette: { ...DEFAULT_PALETTE, ...(asRecord(attrs.palette) as Partial<FlavorPalette>) },
    image: cardImage(raw, p, shortTitle, type),
    variants,
    defaultVariant,
    priceFromCents: Math.min(...prices),
    priceFromGoodsCents: fromVariant.goodsPriceCents,
    priceFromDepositCents: fromVariant.depositCents,
    hasPriceRange: Math.min(...prices) !== Math.max(...prices),
    netContentText: net,
    optionName: rows.length > 1 ? optionKey : null,
    productUrl: `/products/${p.handle}`,
    badge: type === "bundle" ? "Bundle" : type === "merch" ? "Merch" : proteinBadge(attrs),
    sortRank: sortRankOf(p.handle, type, t.title),
  };
}

function proteinBadge(attrs: Record<string, unknown>): string {
  const g = Number(attrs.protein_g_per_unit);
  return Number.isFinite(g) && g > 0 ? `${g.toLocaleString("de-DE")} g Protein` : "Eistee";
}

/* ------------------------------------------------------------------------------------------ */
/* Öffentliche Abfragen                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** Alle aktiven Produkte, optional gefiltert und sortiert. */
export async function listProducts(
  options: { filter?: CatalogFilter; sort?: CatalogSort; locale?: string } = {},
): Promise<CatalogProduct[]> {
  const raw = await loadRawCatalog(options.locale ?? "de");
  const all = raw.products
    .map((p) => toCatalogProduct(raw, p))
    .filter((p): p is CatalogProduct => !!p);
  return sortProducts(
    all.filter((p) => matchesFilter(p, options.filter ?? "alle")),
    options.sort ?? "beliebt",
  );
}

/** Handles aller aktiven, kaufbaren Produkte (generateStaticParams). */
export async function listActiveHandles(locale = "de"): Promise<string[]> {
  return (await listProducts({ locale })).map((p) => p.handle);
}

function productsOfCollection(
  raw: RawCatalog,
  c: CollectionRow,
): { ids: string[]; positions: Map<string, number> | undefined } {
  if (c.kind === "automatic") {
    // Regeln der automatischen Kollektion "all": status = active (RLS liefert ohnehin nur aktive)
    return { ids: raw.products.map((p) => p.id), positions: undefined };
  }
  const rows = raw.collectionProducts.get(c.id) ?? [];
  const byId = new Map(raw.products.map((p) => [p.id, p.handle]));
  const positions = new Map<string, number>();
  for (const r of rows) {
    const handle = byId.get(r.product_id);
    if (handle) positions.set(handle, r.position);
  }
  return { ids: rows.map((r) => r.product_id), positions };
}

function toCollectionSummary(
  raw: RawCatalog,
  c: CollectionRow,
  productCount: number,
): CollectionSummary {
  const t = raw.collectionTranslations.get(c.id);
  return {
    id: c.id,
    handle: c.handle,
    title: t?.title ?? c.handle,
    descriptionHtml: cleanDescriptionHtml(t?.description_html ?? null),
    seoTitle: t?.seo_title ?? null,
    seoDescription: t?.seo_description ?? null,
    productCount,
    url: `/collections/${c.handle}`,
  };
}

/** Alle veröffentlichten Kollektionen mit Produktanzahl. */
export async function listCollections(locale = "de"): Promise<CollectionSummary[]> {
  const raw = await loadRawCatalog(locale);
  const active = new Set(raw.products.map((p) => p.id));
  return raw.collections.map((c) => {
    const { ids } = productsOfCollection(raw, c);
    return toCollectionSummary(raw, c, ids.filter((id) => active.has(id)).length);
  });
}

/** Eine Kollektion mit gefilterten und sortierten Produkten, null wenn unbekannt. */
export async function getCollection(
  handle: string,
  options: { filter?: CatalogFilter; sort?: CatalogSort; locale?: string } = {},
): Promise<CollectionPage | null> {
  const raw = await loadRawCatalog(options.locale ?? "de");
  const c = raw.collections.find((x) => x.handle === handle);
  if (!c) return null;
  const { ids, positions } = productsOfCollection(raw, c);
  const products = ids
    .map((id) => raw.products.find((p) => p.id === id))
    .filter((p): p is ProductRow => !!p)
    .map((p) => toCatalogProduct(raw, p))
    .filter((p): p is CatalogProduct => !!p);
  const filter = options.filter ?? "alle";
  const sort = options.sort ?? "beliebt";
  return {
    collection: toCollectionSummary(raw, c, products.length),
    products: sortProducts(
      products.filter((p) => matchesFilter(p, filter)),
      sort,
      positions,
    ),
    totalCount: products.length,
    filter,
    sort,
  };
}

/** Handles der veröffentlichten Kollektionen (generateStaticParams). */
export async function listCollectionHandles(locale = "de"): Promise<string[]> {
  return (await loadRawCatalog(locale)).collections.map((c) => c.handle);
}

/** Produktseite: alle Angaben inklusive LMIV, Galerie, Bundle-Komponenten und Empfehlungen. */
export async function getProductByHandle(
  handle: string,
  locale = "de",
): Promise<ProductDetail | null> {
  const raw = await loadRawCatalog(locale);
  const p = raw.products.find((x) => x.handle === handle);
  if (!p) return null;
  const base = toCatalogProduct(raw, p);
  const t = raw.translations.get(p.id);
  if (!base || !t) return null;

  // Verfügbarkeit je Variante (Bundles lösen auf Komponenten auf; ohne Bestandsführung 999999)
  const db = catalogDb();
  const availability = await Promise.all(
    base.variants.map(async (v) => {
      const { data, error } = await db.rpc("available_quantity", { p_variant_id: v.id });
      return error || typeof data !== "number" ? true : data > 0;
    }),
  );
  const variants = base.variants.map((v, i) => ({ ...v, available: availability[i] }));
  const defaultVariant = pickDefaultVariant(variants.filter((v) => v.available)) ?? variants[0];

  const attrs = asRecord(p.attributes);
  const stickers = STICKER_BY_ATTRIBUTE.filter(([key]) => attrs[key] === true).map(
    ([, label]) => label,
  );
  if (attrs.made_in === "DE") stickers.push("Made in Germany");

  // Bei Bundles ist das erste Shopify-Bild dasselbe Motiv wie public/images/bundle-N.jpg
  const storedImages = raw.images.get(p.id) ?? [];
  const gallery: CatalogImage[] = (
    base.type === "bundle" && FIXED_IMAGES[p.handle] ? storedImages.slice(1) : storedImages
  ).map((img, i) => ({
    src: publicStorageUrl(img.storage_bucket, img.storage_path),
    alt: String(asRecord(img.alt).de ?? `${t.title}, Bild ${i + 1}`),
    width: img.width ?? 1200,
    height: img.height ?? 1200,
  }));

  // Bundles: LMIV-Angaben der enthaltenen Sorten (Zutaten, Allergene, Nährwerte, Hersteller)
  const bundleComponents = raw.bundles.get(defaultVariant.id)?.components ?? [];
  const foodHandles = [
    ...new Set(bundleComponents.filter((c) => c.kind === "dose").map((c) => c.productHandle)),
  ].sort((a, b) => FLAVOR_ORDER.indexOf(a) - FLAVOR_ORDER.indexOf(b));
  const foodTranslations = foodHandles
    .map((h) => {
      const fp = raw.products.find((x) => x.handle === h);
      const ft = fp ? raw.translations.get(fp.id) : undefined;
      return fp && ft ? { handle: h, t: ft } : null;
    })
    .filter((x): x is { handle: string; t: TranslationRow } => !!x);
  const componentFoods: ComponentFood[] = foodTranslations.map(({ handle: h, t: ft }) => ({
    handle: h,
    name: FLAVOR_SHORT[h] ?? ft.title,
    ingredientsHtml: cleanDescriptionHtml(ft.ingredients_html),
    allergens: ft.allergens,
  }));
  const firstFood = foodTranslations[0]?.t;
  const bundleNutrition = foodTranslations.length
    ? nutritionTable({
        per: "100 ml",
        variants: Object.fromEntries(
          foodTranslations.map(({ handle: h, t: ft }) => [h, ft.nutrition]),
        ),
      } as Json)
    : null;

  const { lead, body } = splitLead(cleanDescriptionHtml(t.description_html));
  // Bei Bundles beziehen sich Füllmenge und Protein auf die enthaltenen Dosen
  const firstFoodProduct = foodHandles.length
    ? raw.products.find((x) => x.handle === foodHandles[0])
    : undefined;
  const protein = Number(
    (firstFoodProduct ? asRecord(firstFoodProduct.attributes) : attrs).protein_g_per_unit,
  );
  const detailNetContent = firstFoodProduct
    ? netContentText(firstFoodProduct.net_content_per_unit, firstFoodProduct.net_content_measure)
    : base.netContentText;

  const breadcrumbCollection =
    base.type === "bundle"
      ? collectionCrumb(raw, "aktion")
      : base.type === "merch"
        ? collectionCrumb(raw, "all")
        : collectionCrumb(raw, "eistee");

  const related = (await listProducts({ locale }))
    .filter(
      (x) => x.handle !== p.handle && (base.isFood ? x.type === "sorte" : x.type === base.type),
    )
    .slice(0, 3);

  const isFood = p.is_food;
  const food = isFood ? t : (firstFood ?? null);
  return {
    ...base,
    variants,
    defaultVariant,
    descriptionHtml: cleanDescriptionHtml(t.description_html),
    seoTitle: t.seo_title,
    seoDescription: t.seo_description,
    deliveryTimeText: t.delivery_time_text,
    foodName: food?.food_name ?? null,
    ingredientsHtml: isFood ? cleanDescriptionHtml(t.ingredients_html) : null,
    allergens: food?.allergens ?? null,
    nutrition: isFood ? nutritionTable(t.nutrition) : bundleNutrition,
    storageInstructions: food ? (food.storage_instructions ?? STORAGE_FALLBACK) : null,
    storageIsFallback: !!food && !food.storage_instructions,
    foodBusinessOperator: food?.food_business_operator ?? null,
    countryOfOrigin: food?.country_of_origin ?? null,
    gallery,
    stickers,
    faq: parseFaq(t.faq),
    netContentText: detailNetContent,
    proteinPerUnitG: Number.isFinite(protein) && protein > 0 ? protein : null,
    lead,
    bodyHtml: body,
    bundleComponents,
    componentFoods,
    breadcrumbCollection,
    related,
  };
}

function collectionCrumb(raw: RawCatalog, handle: string): { title: string; url: string } | null {
  const c = raw.collections.find((x) => x.handle === handle);
  if (!c) return null;
  return {
    title: raw.collectionTranslations.get(c.id)?.title ?? handle,
    url: `/collections/${handle}`,
  };
}

function parseFaq(faq: Json): { q: string; a: string }[] {
  if (!Array.isArray(faq)) return [];
  return faq
    .map((x) => asRecord(x))
    .filter((x) => typeof x.q === "string" && typeof x.a === "string")
    .map((x) => ({ q: String(x.q), a: String(x.a) }));
}

export interface ShippingInfo {
  priceCents: number;
  freeAboveCents: number | null;
  /** z.B. "3 bis 5 Werktage" */
  deliveryTimeText: string;
}

/** "3–5 Werktage" → "3 bis 5 Werktage" (Fließtext ohne Striche). */
export function readableRange(text: string): string {
  return text.replace(/(\d)\s*[–-]\s*(\d)/g, "$1 bis $2");
}

/** Versandtarif Deutschland für den Hinweis auf Produktseiten (Fallback: Werte der Versandseite). */
export const getShippingInfo = cache(async (): Promise<ShippingInfo> => {
  const { data } = await catalogDb()
    .from("shipping_rates")
    .select("price_cents, free_above_subtotal_cents, delivery_time_text, position")
    .eq("is_enabled", true)
    .order("position")
    .limit(1)
    .maybeSingle();
  return {
    priceCents: data?.price_cents ?? 490,
    freeAboveCents: data ? data.free_above_subtotal_cents : 5000,
    deliveryTimeText: readableRange(data?.delivery_time_text ?? "3–5 Werktage"),
  };
});
