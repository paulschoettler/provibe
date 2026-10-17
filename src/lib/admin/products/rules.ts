import { z } from "zod";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";
import type { FieldErrors } from "./result";
import { htmlToPlainText, sanitizeHtml } from "./sanitize";

/**
 * Reine Regeln und Zod-Schemas für den Produkt-Editor im Backoffice (Paket Admin-Katalog).
 * Keine Server-Abhängigkeiten: dieselben Schemas kann das Formular im Client für die
 * Sofortprüfung nutzen, verbindlich ist aber die Prüfung in data.ts auf dem Server.
 *
 * Preise, Pfand und Grundpreis rechnet ausschließlich src/lib/pricing.
 */

/* ------------------------------------------------------------------------------------------ */
/* Optionen                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export const PRODUCT_STATUSES = [
  { value: "active", label: "Aktiv" },
  { value: "draft", label: "Entwurf" },
  { value: "archived", label: "Archiviert" },
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]["value"];

export const PRODUCT_KINDS = [
  { value: "simple", label: "Einzelprodukt" },
  { value: "bundle", label: "Bundle" },
] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number]["value"];

export const UNIT_MEASURES = [
  { value: "l", label: "Liter" },
  { value: "kg", label: "Kilogramm" },
  { value: "piece", label: "Stück" },
] as const;

/**
 * Streichpreis-Arten im Backoffice (Entscheidung H17): keine Packgrößen-Vergleiche
 * (quantity_reference ist im Enum, aber nicht wählbar), Bundles zeigen "Einzeln: X €"
 * (components_sum), frühere Preise nur mit Nachweis aus price_history und erst nach
 * Freigabe durch den Anwalt.
 */
export const COMPARE_AT_KINDS = [
  { value: "none", label: "Kein Streichpreis" },
  { value: "components_sum", label: "Summe der Einzelpreise (Bundle)" },
  { value: "former_price", label: "Früherer Preis (30-Tage-Regel)" },
] as const;
export type AdminCompareAtKind = (typeof COMPARE_AT_KINDS)[number]["value"];

/** H17: bleibt aus, bis der Anwalt die 30-Tage-Referenz freigibt. */
export const FORMER_PRICE_ENABLED = false;

/* ------------------------------------------------------------------------------------------ */
/* Handle (Slug)                                                                               */
/* ------------------------------------------------------------------------------------------ */

/** Gleiche Regel wie der Check-Constraint products.handle / collections.handle. */
export const HANDLE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HANDLE_MAX = 80;

/** "Founder Bundle Ⅲ – Größe M" → "founder-bundle-iii-groesse-m" */
export function slugifyHandle(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&/g, " und ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/g, "");
}

export function handleError(handle: string): string | null {
  if (!handle) return "Bitte gib einen Handle ein.";
  if (handle.length > HANDLE_MAX) return `Der Handle darf höchstens ${HANDLE_MAX} Zeichen haben.`;
  if (!HANDLE_RE.test(handle))
    return "Nur Kleinbuchstaben, Ziffern und einzelne Bindestriche, ohne Bindestrich am Anfang oder Ende.";
  return null;
}

/** Freien Handle für eine Kopie finden: "peach-kopie", "peach-kopie-2", ... */
export function nextFreeHandle(base: string, taken: Set<string>, suffix = "kopie"): string {
  const stem = base.slice(0, HANDLE_MAX - suffix.length - 4).replace(/-+$/g, "");
  const first = `${stem}-${suffix}`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem}-${suffix}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Kein freier Handle gefunden");
}

/**
 * Weiterleitung bei geändertem Handle: Kein alter Pfad darf in einer 404 enden (Briefing 3).
 * Nur nötig, wenn das Produkt schon einmal veröffentlicht war.
 */
export function handleChangeRedirect(
  oldHandle: string | null | undefined,
  newHandle: string,
  wasPublished: boolean,
  prefix: "/products" | "/collections" = "/products",
): { fromPath: string; toPath: string } | null {
  if (!oldHandle || oldHandle === newHandle || !wasPublished) return null;
  return { fromPath: `${prefix}/${oldHandle}`, toPath: `${prefix}/${newHandle}` };
}

/* ------------------------------------------------------------------------------------------ */
/* SKU, GTIN, Tags                                                                             */
/* ------------------------------------------------------------------------------------------ */

export const SKU_RE = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

export function normalizeSku(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  return v ? v : null;
}

export function normalizeGtin(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/[\s-]/g, "");
  return v ? v : null;
}

/**
 * GTIN-8, -12 (UPC), -13 (EAN) und -14 mit Prüfziffer (Modulo 10, Gewichte 3 und 1 von rechts).
 */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** Tags klein, ohne doppelte Leerzeichen, eindeutig, Reihenfolge wie eingegeben. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Zod-Schemas Produkt                                                                         */
/* ------------------------------------------------------------------------------------------ */

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${max} Zeichen.`)
    .nullish()
    .transform((v) => (v ? v : null));

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Bitte eine Farbe im Format #RRGGBB.");

/** Farbwelt je Sorte für Hero und Sequenz (Antwort G1). */
export const paletteSchema = z.object({ from: hex, via: hex, to: hex, accent: hex });

/**
 * products.attributes: bekannte Schlüssel typisiert, weitere einfache Werte erlaubt
 * (snake_case-Schlüssel), damit neue Eigenschaften ohne Codeänderung pflegbar sind.
 */
export const attributesSchema = z
  .object({
    palette: paletteSchema.optional(),
    notes: z.string().trim().max(200, "Bitte höchstens 200 Zeichen.").optional(),
    lactose_free: z.boolean().optional(),
    sugar_free: z.boolean().optional(),
    ready_to_drink: z.boolean().optional(),
    protein_g_per_unit: z.number().min(0).max(1000).optional(),
    made_in: z
      .string()
      .regex(/^[A-Z]{2}$/, "Bitte ein Ländercode wie DE.")
      .optional(),
  })
  .catchall(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Schlüssel nur in Kleinbuchstaben mit Unterstrich.",
        });
      }
    }
  });
export type ProductAttributes = z.infer<typeof attributesSchema>;

const nutrientValue = z.union([
  z.number().min(0),
  z
    .string()
    .trim()
    .regex(/^[<>~]?\s?\d+(,\d+)?$/, "Bitte eine Zahl wie 4,5 oder <0,5."),
]);

const nutritionPanel = z.object({
  per: z.string().trim().min(1).max(40),
  energy_kj: z.number().min(0),
  energy_kcal: z.number().min(0),
  fat_g: nutrientValue,
  saturated_fat_g: nutrientValue,
  carbs_g: nutrientValue,
  sugar_g: nutrientValue,
  fibre_g: nutrientValue.optional(),
  protein_g: nutrientValue,
  salt_g: nutrientValue,
});

/** Nährwerttabelle (LMIV Art. 30): eine Tabelle oder je Sorte (Mixed). */
export const nutritionSchema = z.union([
  nutritionPanel,
  z.object({
    per: z.string().trim().min(1).max(40),
    variants: z.record(z.string(), nutritionPanel),
  }),
]);

export const faqSchema = z
  .array(
    z.object({
      q: z.string().trim().min(1, "Bitte gib eine Frage ein.").max(300),
      a: z.string().trim().min(1, "Bitte gib eine Antwort ein.").max(3000),
    }),
  )
  .max(30);

export const lmivSchema = z.object({
  foodName: optText(200),
  ingredientsHtml: z.string().max(10000).nullish(),
  allergens: optText(1000),
  nutrition: nutritionSchema.nullish().transform((v) => v ?? null),
  storageInstructions: optText(500),
  foodBusinessOperator: optText(500),
  countryOfOrigin: optText(120),
});

export const seoSchema = z.object({
  title: optText(120),
  description: optText(320),
  ogImagePath: optText(500),
});

const measure = z.enum(["l", "kg", "piece"]);

export const productInputSchema = z.object({
  id: z.guid().optional(),
  locale: z
    .string()
    .regex(/^[a-z]{2}$/)
    .default("de"),
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200),
  /** leer: aus dem Titel abgeleitet */
  handle: z.string().trim().toLowerCase().max(HANDLE_MAX).optional(),
  status: z.enum(["draft", "active", "archived"]),
  kind: z.enum(["simple", "bundle"]).default("simple"),
  subtitle: optText(300),
  descriptionHtml: z.string().max(50000, "Die Beschreibung ist zu lang.").nullish(),
  deliveryTimeText: optText(80),
  vendor: z.string().trim().min(1).max(80).default("provibe"),
  productType: optText(80),
  tags: z.array(z.string().max(60)).max(50).default([]),
  attributes: attributesSchema.default({}),
  position: z.number().int().min(0).max(100000).optional(),
  isFood: z.boolean().default(false),
  depositCentsPerUnit: z
    .number()
    .int("Pfand in ganzen Cent.")
    .min(0)
    .max(1000, "Pfand höchstens 10,00 € je Einheit."),
  unitLabel: z.string().trim().min(1).max(30).default("Stück"),
  netContentPerUnit: z
    .number()
    .positive("Die Füllmenge muss größer als 0 sein.")
    .max(1000)
    .nullable()
    .transform((v) => (v == null ? null : Math.round(v * 1000) / 1000)),
  netContentMeasure: measure.default("piece"),
  basePriceMeasure: measure.default("piece"),
  weightGramsPerUnit: z.number().int().min(0).max(100000).nullable().default(null),
  taxClass: z
    .string()
    .trim()
    .regex(/^[a-z_]{2,30}$/, "Bitte eine gültige Steuerklasse wählen.")
    .default("standard"),
  lmiv: lmivSchema.default({
    foodName: null,
    ingredientsHtml: null,
    allergens: null,
    nutrition: null,
    storageInstructions: null,
    foodBusinessOperator: null,
    countryOfOrigin: null,
  }),
  seo: seoSchema.default({ title: null, description: null, ogImagePath: null }),
  faq: faqSchema.default([]),
  /** Zuordnung zu manuellen Kollektionen; nicht angegeben = unverändert */
  collectionIds: z.array(z.guid()).max(50).optional(),
});
export type ProductInput = z.input<typeof productInputSchema>;
export type ParsedProductInput = z.output<typeof productInputSchema>;

export interface NormalizedProduct extends Omit<ParsedProductInput, "handle"> {
  handle: string;
}

/**
 * Nach dem Parsen: Handle ableiten, HTML bereinigen, Tags normalisieren. Liefert Feldfehler,
 * die Zod allein nicht abdeckt (Handle-Regel, Maßeinheit des Grundpreises).
 */
export function normalizeProductInput(input: ParsedProductInput): {
  product: NormalizedProduct;
  fieldErrors: FieldErrors;
  warnings: string[];
} {
  const fieldErrors: FieldErrors = {};
  const warnings: string[] = [];
  const handle = input.handle ? input.handle : slugifyHandle(input.title);
  const hErr = handleError(handle);
  if (hErr) fieldErrors.handle = hErr;

  const descriptionHtml = sanitizeHtml(input.descriptionHtml, "rich") || null;
  if (input.descriptionHtml && descriptionHtml !== input.descriptionHtml.trim()) {
    warnings.push("Die Beschreibung enthielt nicht erlaubte Formatierungen, sie wurden entfernt.");
  }
  const ingredientsHtml = sanitizeHtml(input.lmiv.ingredientsHtml, "inline") || null;

  if (input.basePriceMeasure !== "piece" && input.basePriceMeasure !== input.netContentMeasure) {
    fieldErrors.basePriceMeasure =
      "Der Grundpreis muss sich auf die Einheit der Füllmenge beziehen.";
  }
  if (input.netContentMeasure !== "piece" && input.netContentPerUnit == null) {
    fieldErrors.netContentPerUnit = "Bitte gib die Füllmenge je Einheit an.";
  }
  if (input.seo.title && input.seo.title.length > 60) {
    warnings.push("Der SEO-Titel ist länger als 60 Zeichen und wird in Suchergebnissen gekürzt.");
  }
  if (input.seo.description && input.seo.description.length > 160) {
    warnings.push("Die Meta-Beschreibung ist länger als 160 Zeichen und wird gekürzt.");
  }

  return {
    product: {
      ...input,
      handle,
      descriptionHtml,
      lmiv: { ...input.lmiv, ingredientsHtml },
      tags: normalizeTags(input.tags),
    },
    fieldErrors,
    warnings,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Veröffentlichen: Pflichtangaben                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface PublishCheckVariant {
  priceCents: number;
  isActive: boolean;
}

/**
 * Ein Produkt darf nur aktiv werden, wenn es kaufbar und rechtlich vollständig ist:
 * mindestens eine aktive Variante mit Preis, bei Lebensmitteln alle LMIV-Pflichtangaben
 * (Briefing 5: im Backoffice Pflichtfelder) und die Füllmenge für den Grundpreis (PAngV § 4).
 * Entwürfe dürfen unvollständig sein.
 */
export function publishErrors(
  product: Pick<
    NormalizedProduct,
    "isFood" | "lmiv" | "netContentPerUnit" | "netContentMeasure" | "basePriceMeasure" | "kind"
  >,
  variants: PublishCheckVariant[],
): FieldErrors {
  const e: FieldErrors = {};
  if (!variants.some((v) => v.isActive && v.priceCents > 0)) {
    e.variants = "Für die Veröffentlichung braucht es mindestens eine aktive Variante mit Preis.";
  }
  if (product.isFood && product.kind === "simple") {
    const l = product.lmiv;
    const missing = "Pflichtangabe nach LMIV, bitte ausfüllen.";
    if (!l.foodName) e["lmiv.foodName"] = missing;
    if (!l.ingredientsHtml || !htmlToPlainText(l.ingredientsHtml))
      e["lmiv.ingredientsHtml"] = missing;
    if (!l.allergens) e["lmiv.allergens"] = missing;
    if (!l.nutrition) e["lmiv.nutrition"] = missing;
    if (!l.storageInstructions) e["lmiv.storageInstructions"] = missing;
    if (!l.foodBusinessOperator) e["lmiv.foodBusinessOperator"] = missing;
    if (product.netContentMeasure === "piece" || product.netContentPerUnit == null) {
      e.netContentPerUnit = "Lebensmittel brauchen eine Nettofüllmenge in Liter oder Kilogramm.";
    }
    if (product.basePriceMeasure === "piece") {
      e.basePriceMeasure = "Lebensmittel brauchen einen Grundpreis je Liter oder Kilogramm.";
    }
  }
  return e;
}

/* ------------------------------------------------------------------------------------------ */
/* Grundpreis-Vorschau                                                                         */
/* ------------------------------------------------------------------------------------------ */

export interface BasePricePreview {
  cents: number;
  measure: UnitMeasure;
  label: string;
  depositCents: number;
}

/**
 * Grundpreis je Variante für den Editor (live beim Tippen). Bundles haben keinen Grundpreis
 * (verschiedene Waren), dort null. Fehler (Pfand größer als Preis) als Text.
 */
export function basePricePreview(
  product: {
    kind: ProductKind;
    depositCentsPerUnit: number;
    netContentPerUnit: number | null;
    basePriceMeasure: UnitMeasure;
  },
  variant: { priceCents: number; unitCount: number },
): BasePricePreview | { error: string } | null {
  if (product.kind === "bundle") return null;
  try {
    const bp = calculateBasePrice({
      priceCents: variant.priceCents,
      depositCentsPerUnit: product.depositCentsPerUnit,
      unitCount: variant.unitCount,
      netContentPerUnit: product.netContentPerUnit,
      measure: product.basePriceMeasure,
    });
    return {
      cents: bp.cents,
      measure: bp.measure,
      label: formatBasePrice(bp),
      depositCents: bp.depositCents,
    };
  } catch {
    return { error: "Das Pfand ist höher als der Preis." };
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Varianten                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const cents = (label: string) =>
  z
    .number({ error: `${label} fehlt.` })
    .int(`${label} in ganzen Cent.`)
    .min(0, `${label} darf nicht negativ sein.`)
    .max(1_000_000, `${label} ist unrealistisch hoch.`);

export const variantInputSchema = z.object({
  id: z.guid().optional(),
  title: z.string().trim().min(1, "Bitte gib einen Variantentitel ein.").max(120),
  optionValues: z
    .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(60))
    .default({}),
  priceCents: cents("Der Preis"),
  compareAtCents: cents("Der Streichpreis").nullable().default(null),
  compareAtKind: z.enum(["none", "components_sum", "former_price"]).default("none"),
  sku: z.string().max(64).nullish(),
  gtin: z.string().max(20).nullish(),
  weightGrams: z.number().int().min(0).max(100000).nullable().default(null),
  packagingWeightGrams: z.number().int().min(0).max(100000).default(0),
  unitCount: z.number().int().min(1, "Mindestens 1 Einheit.").max(1000).default(1),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0).max(10000).optional(),
});
export const variantsInputSchema = z
  .array(variantInputSchema)
  .min(1, "Mindestens eine Variante.")
  .max(100);
export type VariantInput = z.input<typeof variantInputSchema>;
export type ParsedVariantInput = z.output<typeof variantInputSchema>;

export interface NormalizedVariant extends Omit<ParsedVariantInput, "sku" | "gtin"> {
  sku: string | null;
  gtin: string | null;
  position: number;
}

/** Stabiler Schlüssel für option_values (Reihenfolge der Schlüssel egal). */
export function optionKey(values: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((k) => [k, values[k]]),
  );
}

/**
 * Variantenregeln ohne Datenbank: SKU- und GTIN-Format, Doppelte in der Liste,
 * Streichpreis-Art nach H17, Pfand nicht höher als Preis. Eindeutigkeit gegen andere
 * Produkte prüft data.ts.
 */
export function validateVariants(
  variants: ParsedVariantInput[],
  ctx: { productKind: ProductKind; depositCentsPerUnit: number; formerPriceEnabled?: boolean },
): { variants: NormalizedVariant[]; fieldErrors: FieldErrors; warnings: string[] } {
  const fieldErrors: FieldErrors = {};
  const warnings: string[] = [];
  const skus = new Map<string, number>();
  const gtins = new Map<string, number>();
  const options = new Map<string, number>();
  const formerEnabled = ctx.formerPriceEnabled ?? FORMER_PRICE_ENABLED;

  const out = variants.map((v, i): NormalizedVariant => {
    const p = `variants.${i}`;
    const sku = normalizeSku(v.sku);
    if (sku) {
      if (!SKU_RE.test(sku))
        fieldErrors[`${p}.sku`] =
          "SKU nur aus Großbuchstaben, Ziffern, Punkt, Binde- und Unterstrich.";
      else if (skus.has(sku))
        fieldErrors[`${p}.sku`] = `Die SKU steht schon in Variante ${skus.get(sku)! + 1}.`;
      else skus.set(sku, i);
    }
    const gtin = normalizeGtin(v.gtin);
    if (gtin) {
      if (!isValidGtin(gtin))
        fieldErrors[`${p}.gtin`] =
          "Die GTIN ist ungültig (8, 12, 13 oder 14 Ziffern mit Prüfziffer).";
      else if (gtins.has(gtin))
        fieldErrors[`${p}.gtin`] = `Die GTIN steht schon in Variante ${gtins.get(gtin)! + 1}.`;
      else gtins.set(gtin, i);
    }
    const key = optionKey(v.optionValues);
    if (options.has(key)) {
      fieldErrors[`${p}.optionValues`] =
        `Diese Optionswerte hat schon Variante ${options.get(key)! + 1}.`;
    } else options.set(key, i);

    let compareAtCents = v.compareAtCents;
    if (v.compareAtKind === "none") {
      compareAtCents = null;
    } else if (v.compareAtKind === "components_sum") {
      if (ctx.productKind !== "bundle") {
        fieldErrors[`${p}.compareAtKind`] = "Die Summe der Einzelpreise gibt es nur bei Bundles.";
      }
      // wird live aus den Komponenten berechnet (bundle_components_sum_cents), nicht gespeichert
      compareAtCents = null;
    } else if (v.compareAtKind === "former_price") {
      if (!formerEnabled) {
        fieldErrors[`${p}.compareAtKind`] =
          "Frühere Preise als Streichpreis sind bis zur Freigabe durch den Anwalt ausgeschaltet (H17).";
      } else if (compareAtCents == null || compareAtCents <= v.priceCents) {
        fieldErrors[`${p}.compareAtCents`] =
          "Der frühere Preis muss höher sein als der aktuelle Preis.";
      }
    }

    if (ctx.productKind === "simple" && v.priceCents < ctx.depositCentsPerUnit * v.unitCount) {
      fieldErrors[`${p}.priceCents`] = "Der Preis muss mindestens das Pfand der Variante abdecken.";
    }
    if (v.isActive && v.weightGrams == null) {
      warnings.push(`Variante „${v.title}“ hat kein Gewicht, DHL-Labels brauchen es.`);
    }

    return { ...v, sku, gtin, compareAtCents, position: v.position ?? i };
  });

  return { variants: out, fieldErrors, warnings };
}

/* ------------------------------------------------------------------------------------------ */
/* Bundles                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export const bundleComponentsSchema = z
  .array(
    z.object({
      componentVariantId: z.guid(),
      quantity: z.number().int().min(1, "Mindestens 1.").max(100, "Höchstens 100."),
    }),
  )
  .min(1, "Ein Bundle braucht mindestens eine Komponente.")
  .max(20);
export type BundleComponentInput = z.input<typeof bundleComponentsSchema>[number];

export interface ComponentFacts {
  productKind: ProductKind;
  productStatus: ProductStatus;
  unitCount: number;
  title: string;
}

/**
 * H14: Die Dose ist die Lagereinheit. Komponenten sind deshalb Varianten mit unit_count 1
 * (zum Beispiel "1 Dose (Bundle-Komponente)" oder Shirt M), mehrere Dosen über die Menge.
 * Keine Bundles in Bundles, keine archivierten Produkte, nicht das Bundle selbst.
 */
export function bundleComponentErrors(
  bundleVariantId: string,
  components: { componentVariantId: string; quantity: number }[],
  facts: Map<string, ComponentFacts>,
): FieldErrors {
  const e: FieldErrors = {};
  const seen = new Set<string>();
  components.forEach((c, i) => {
    const p = `components.${i}.componentVariantId`;
    const f = facts.get(c.componentVariantId);
    if (c.componentVariantId === bundleVariantId)
      e[p] = "Ein Bundle kann nicht sich selbst enthalten.";
    else if (seen.has(c.componentVariantId)) e[p] = "Diese Komponente steht schon in der Liste.";
    else if (!f) e[p] = "Diese Variante gibt es nicht.";
    else if (f.productKind === "bundle") e[p] = "Bundles können keine anderen Bundles enthalten.";
    else if (f.productStatus === "archived") e[p] = `„${f.title}“ ist archiviert.`;
    else if (f.unitCount !== 1)
      e[p] =
        `„${f.title}“ ist ein Pack mit ${f.unitCount} Einheiten. Lagereinheit ist die einzelne Dose (H14), bitte die Einzelvariante wählen und die Menge erhöhen.`;
    seen.add(c.componentVariantId);
  });
  return e;
}

/* ------------------------------------------------------------------------------------------ */
/* Liste                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export const productListFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "draft", "archived"]).default("all"),
  kind: z.enum(["all", "simple", "bundle"]).default("all"),
  collectionId: z.guid().optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(["position", "title", "updated", "created"]).default("position"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});
export type ProductListFilter = z.input<typeof productListFilterSchema>;

/* ------------------------------------------------------------------------------------------ */
/* Revalidation                                                                                */
/* ------------------------------------------------------------------------------------------ */

export interface RevalidateTarget {
  path: string;
  type?: "page" | "layout";
}

/**
 * Betroffene Routen nach einer Katalogänderung: Startseite, Shop-Übersicht,
 * Kollektionsübersicht, die genannten Kollektionen und Produkte (oder alle per Muster),
 * Sitemap. Suche ist dynamisch und braucht keine Revalidation.
 */
export function catalogRevalidateTargets(scope: {
  productHandles?: string[];
  collectionHandles?: string[];
  allProducts?: boolean;
  allCollections?: boolean;
}): RevalidateTarget[] {
  const t: RevalidateTarget[] = [
    { path: "/" },
    { path: "/pages/shop" },
    { path: "/collections" },
    { path: "/sitemap.xml" },
  ];
  if (scope.allCollections) t.push({ path: "/collections/[handle]", type: "page" });
  else
    for (const h of new Set(scope.collectionHandles ?? [])) t.push({ path: `/collections/${h}` });
  if (scope.allProducts) t.push({ path: "/products/[handle]", type: "page" });
  else for (const h of new Set(scope.productHandles ?? [])) t.push({ path: `/products/${h}` });
  return t;
}
