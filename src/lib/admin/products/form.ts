import { parseEuroToCents } from "@/lib/admin/discounts/rules";
import type { FieldErrors } from "./result";
import { isProductLine, kindForLine, type ProductLine } from "./lines";
import type { BundleComponentInput, ProductInput, VariantInput } from "./rules";

/**
 * Formular des Produkt-Editors (reine Funktionen, ohne Server): flache Feldnamen aus dem
 * <form> (zum Beispiel "variants.0.priceCents" oder "lmiv.nutrition.fat_g") in die Eingaben von
 * saveProduct, saveVariants, setBundleComponents und updateImage übersetzen. Die Feldnamen
 * entsprechen den Fehlerpfaden der Zod-Schemas, damit Fehler direkt am Feld landen.
 *
 * Beträge tippt man in Euro ("26,10"), gespeichert wird in Cent.
 */

export type FormObject = Record<string, string | string[]>;

const UUID_RE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function str(obj: FormObject, key: string): string {
  const v = obj[key];
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
}

export function list(obj: FormObject, key: string): string[] {
  const v = obj[key];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => x.trim()).filter(Boolean);
}

/** Cent als Eingabetext: 2610 → "26,10" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** "0,33" oder "0.33" → 0.33; leer → null; ungültig → NaN */
export function parseDecimalInput(raw: string): number | null {
  const v = raw.replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
}

/** Zahl als Eingabetext mit Komma: 0.33 → "0,33" */
export function decimalToInput(n: number | null | undefined): string {
  return n == null ? "" : String(n).replace(".", ",");
}

function intOrNull(raw: string): number | null | typeof Number.NaN {
  if (!raw) return null;
  return /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

function jsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function jsonArray(raw: string): unknown[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Nährwerte                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export const NUTRIENTS = [
  { key: "energy", label: "Energie", indent: false },
  { key: "fat_g", label: "Fett", indent: false },
  { key: "saturated_fat_g", label: "davon gesättigte Fettsäuren", indent: true },
  { key: "carbs_g", label: "Kohlenhydrate", indent: false },
  { key: "sugar_g", label: "davon Zucker", indent: true },
  { key: "fibre_g", label: "Ballaststoffe", indent: false },
  { key: "protein_g", label: "Eiweiß", indent: false },
  { key: "salt_g", label: "Salz", indent: false },
] as const;

const NUTRIENT_VALUE_RE = /^[<>~]?\s?\d+(,\d+)?$/;
const REQUIRED_NUTRIENTS = [
  "fat_g",
  "saturated_fat_g",
  "carbs_g",
  "sugar_g",
  "protein_g",
  "salt_g",
] as const;

type Panel = Record<string, string | number>;

/** Nährwerttabelle als Eingabetexte (für Formular-Vorbelegung). */
export function nutritionToInputs(nutrition: unknown, prefix = "lmiv.nutrition"): FormObject {
  const out: FormObject = {};
  const n = jsonLike(nutrition);
  if (!n) return out;
  out[`${prefix}.per`] = String(n.per ?? "100 ml");
  const variants = jsonLike(n.variants);
  const put = (p: string, panel: Record<string, unknown>) => {
    for (const { key } of NUTRIENTS) {
      if (key === "energy") {
        if (panel.energy_kj != null) out[`${p}.energy_kj`] = String(panel.energy_kj);
        if (panel.energy_kcal != null) out[`${p}.energy_kcal`] = String(panel.energy_kcal);
      } else if (panel[key] != null) {
        out[`${p}.${key}`] = String(panel[key]).replace(".", ",");
      }
    }
  };
  if (variants) {
    out[`${prefix}.keys`] = Object.keys(variants).join(",");
    for (const [k, panel] of Object.entries(variants)) {
      const p = jsonLike(panel);
      if (p) put(`${prefix}.variants.${k}`, p);
    }
  } else {
    put(prefix, n);
  }
  return out;
}

function jsonLike(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parsePanel(
  obj: FormObject,
  prefix: string,
  per: string,
  errors: FieldErrors,
): Panel | "empty" {
  const raw: Record<string, string> = {};
  for (const { key } of NUTRIENTS) {
    if (key === "energy") {
      raw.energy_kj = str(obj, `${prefix}.energy_kj`);
      raw.energy_kcal = str(obj, `${prefix}.energy_kcal`);
    } else raw[key] = str(obj, `${prefix}.${key}`);
  }
  if (Object.values(raw).every((v) => !v)) return "empty";
  const panel: Panel = { per };
  for (const k of ["energy_kj", "energy_kcal"] as const) {
    const n = intOrNull(raw[k].replace(/\s/g, ""));
    if (n == null || Number.isNaN(n)) errors[`${prefix}.${k}`] = "Bitte eine ganze Zahl.";
    else panel[k] = n;
  }
  for (const { key } of NUTRIENTS) {
    if (key === "energy") continue;
    const v = raw[key].replace(".", ",");
    if (!v) {
      if ((REQUIRED_NUTRIENTS as readonly string[]).includes(key))
        errors[`${prefix}.${key}`] = "Pflichtangabe nach LMIV Art. 30.";
      continue;
    }
    if (!NUTRIENT_VALUE_RE.test(v))
      errors[`${prefix}.${key}`] = "Bitte eine Zahl wie 4,5 oder <0,5.";
    else panel[key] = v.replace(/\s/g, "");
  }
  return panel;
}

export function parseNutrition(
  obj: FormObject,
  errors: FieldErrors,
  prefix = "lmiv.nutrition",
): Record<string, unknown> | null {
  const per = str(obj, `${prefix}.per`) || "100 ml";
  const keys = str(obj, `${prefix}.keys`)
    .split(",")
    .map((k) => k.trim())
    .filter((k) => /^[a-z0-9_-]{1,40}$/.test(k));
  if (keys.length) {
    const variants: Record<string, Panel> = {};
    for (const k of keys) {
      const p = parsePanel(obj, `${prefix}.variants.${k}`, per, errors);
      if (p !== "empty") variants[k] = p;
    }
    return Object.keys(variants).length ? { per, variants } : null;
  }
  const p = parsePanel(obj, prefix, per, errors);
  return p === "empty" ? null : p;
}

/* ------------------------------------------------------------------------------------------ */
/* Produktformular                                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface ProductFormContext {
  /** Name der ersten Produktoption (zum Beispiel "Menge"), für neue Varianten */
  optionName?: string | null;
  /** Anzahl vorhandener Varianten */
  variantCount?: number;
}

export interface ParsedProductForm {
  product: ProductInput;
  line: ProductLine;
  variants: VariantInput[];
  /** Index der neuen Variante in variants, sonst null */
  newVariantIndex: number | null;
  components: { bundleVariantId: string; items: BundleComponentInput[] }[];
  imageAlts: { id: string; alt: string }[];
  errors: FieldErrors;
}

const AMOUNT_ERROR = "Bitte einen Betrag wie 26,10 eingeben.";

export function parseProductForm(obj: FormObject, ctx: ProductFormContext = {}): ParsedProductForm {
  const errors: FieldErrors = {};
  const lineRaw = str(obj, "line");
  const line: ProductLine = isProductLine(lineRaw) ? lineRaw : "sorte";

  const deposit = parseEuroToCents(str(obj, "depositCentsPerUnit") || "0");
  if (deposit == null) errors.depositCentsPerUnit = AMOUNT_ERROR;
  const netContent = parseDecimalInput(str(obj, "netContentPerUnit"));
  if (netContent != null && Number.isNaN(netContent))
    errors.netContentPerUnit = "Bitte eine Zahl wie 0,33.";
  const weightPerUnit = intOrNull(str(obj, "weightGramsPerUnit"));
  if (weightPerUnit != null && Number.isNaN(weightPerUnit))
    errors.weightGramsPerUnit = "Bitte ganze Gramm.";
  const position = intOrNull(str(obj, "position"));
  if (position != null && Number.isNaN(position)) errors.position = "Bitte eine ganze Zahl ab 0.";

  const attributes = jsonObject(str(obj, "attributesJson")) ?? {};
  attributes.product_line = line;
  const faq = jsonArray(str(obj, "faqJson")) ?? [];

  const isFood = "isFood" in obj;
  const nutrition = parseNutrition(obj, errors);

  const product: ProductInput = {
    id: str(obj, "id") || undefined,
    locale: str(obj, "locale") || "de",
    title: str(obj, "title"),
    handle: str(obj, "handle").toLowerCase() || undefined,
    status: (["draft", "active", "archived"].includes(str(obj, "status"))
      ? str(obj, "status")
      : "draft") as ProductInput["status"],
    kind: kindForLine(line),
    subtitle: str(obj, "subtitle") || null,
    descriptionHtml: str(obj, "descriptionHtml") || null,
    deliveryTimeText: str(obj, "deliveryTimeText") || null,
    vendor: str(obj, "vendor") || "provibe",
    productType: str(obj, "productType") || null,
    tags: str(obj, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    attributes: attributes as ProductInput["attributes"],
    position: position == null || Number.isNaN(position) ? undefined : position,
    isFood,
    depositCentsPerUnit: deposit ?? 0,
    unitLabel: str(obj, "unitLabel") || "Stück",
    netContentPerUnit: netContent == null || Number.isNaN(netContent) ? null : netContent,
    netContentMeasure: (str(obj, "netContentMeasure") || "piece") as "l" | "kg" | "piece",
    basePriceMeasure: (str(obj, "basePriceMeasure") || "piece") as "l" | "kg" | "piece",
    weightGramsPerUnit: weightPerUnit == null || Number.isNaN(weightPerUnit) ? null : weightPerUnit,
    taxClass: str(obj, "taxClass") || "standard",
    lmiv: {
      foodName: str(obj, "lmiv.foodName") || null,
      ingredientsHtml: str(obj, "lmiv.ingredientsHtml") || null,
      allergens: str(obj, "lmiv.allergens") || null,
      nutrition: nutrition as never,
      storageInstructions: str(obj, "lmiv.storageInstructions") || null,
      foodBusinessOperator: str(obj, "lmiv.foodBusinessOperator") || null,
      countryOfOrigin: str(obj, "lmiv.countryOfOrigin") || null,
    },
    seo: {
      title: str(obj, "seo.title") || null,
      description: str(obj, "seo.description") || null,
      ogImagePath: str(obj, "seo.ogImagePath") || null,
    },
    faq: faq as ProductInput["faq"],
    collectionIds: "collectionIds.present" in obj ? list(obj, "collectionIds") : undefined,
  };

  /* Varianten */
  const indices = Object.keys(obj)
    .map((k) => /^variants\.(\d+)\.title$/.exec(k)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const variants: VariantInput[] = [];
  let newVariantIndex: number | null = null;
  for (const i of indices) {
    const p = `variants.${i}`;
    const isNew = str(obj, `${p}.isNew`) === "1";
    const title = str(obj, `${p}.title`);
    const priceRaw = str(obj, `${p}.priceCents`);
    if (isNew && !title && !priceRaw && !str(obj, `${p}.sku`)) continue;
    // Fehlerpfade beziehen sich auf die Position in der übergebenen Liste. Übersprungen wird
    // nur die leere neue Zeile am Ende, deshalb stimmen Feldname und Listenposition überein.
    const idx = variants.length;
    const price = parseEuroToCents(priceRaw);
    if (price == null)
      errors[`${p}.priceCents`] = priceRaw ? AMOUNT_ERROR : "Bitte gib einen Preis ein.";
    const kind = str(obj, `${p}.compareAtKind`) || "none";
    const compareRaw = str(obj, `${p}.compareAtCents`);
    const compare = compareRaw ? parseEuroToCents(compareRaw) : null;
    if (compareRaw && compare == null) errors[`${p}.compareAtCents`] = AMOUNT_ERROR;
    const unitCount = intOrNull(str(obj, `${p}.unitCount`));
    if (unitCount != null && Number.isNaN(unitCount))
      errors[`${p}.unitCount`] = "Bitte eine ganze Zahl.";
    const weight = intOrNull(str(obj, `${p}.weightGrams`));
    if (weight != null && Number.isNaN(weight)) errors[`${p}.weightGrams`] = "Bitte ganze Gramm.";
    const packaging = intOrNull(str(obj, `${p}.packagingWeightGrams`));
    const pos = intOrNull(str(obj, `${p}.position`));

    let optionValues: Record<string, string> = {};
    const stored = jsonObject(str(obj, `${p}.optionValues`));
    if (stored) {
      for (const [k, v] of Object.entries(stored)) if (v != null) optionValues[k] = String(v);
      const keys = Object.keys(optionValues);
      const original = str(obj, `${p}.titleOriginal`);
      if (keys.length === 1 && original && optionValues[keys[0]] === original && title)
        optionValues = { [keys[0]]: title };
    } else if (isNew && title) {
      // gleiche Option wie die übrigen Varianten, sonst "Variante" (auch für die erste Variante)
      optionValues = { [ctx.optionName ?? "Variante"]: title };
    }

    if (isNew) newVariantIndex = idx;
    variants.push({
      id: isNew ? undefined : str(obj, `${p}.id`) || undefined,
      title,
      optionValues,
      priceCents: price ?? 0,
      compareAtCents: compare ?? null,
      compareAtKind: (["none", "components_sum", "former_price"].includes(kind)
        ? kind
        : "none") as VariantInput["compareAtKind"],
      sku: str(obj, `${p}.sku`) || null,
      gtin: str(obj, `${p}.gtin`) || null,
      weightGrams: weight == null || Number.isNaN(weight) ? null : weight,
      packagingWeightGrams: packaging == null || Number.isNaN(packaging) ? 0 : packaging,
      unitCount: unitCount == null || Number.isNaN(unitCount) ? 1 : unitCount,
      isActive: `${p}.isActive` in obj,
      position: pos == null || Number.isNaN(pos) ? i : pos,
    });
  }

  /* Bundle-Komponenten je Bundle-Variante */
  const bundleIds = new Set(
    Object.keys(obj)
      .map((k) => new RegExp(`^components\\.(${UUID_RE})\\.present$`).exec(k)?.[1])
      .filter((x): x is string => !!x),
  );
  const components: ParsedProductForm["components"] = [];
  for (const vid of bundleIds) {
    const rows = Object.keys(obj)
      .map((k) => new RegExp(`^components\\.${vid}\\.(\\d+)\\.componentVariantId$`).exec(k)?.[1])
      .filter((x): x is string => x !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
    const items: BundleComponentInput[] = [];
    for (const j of rows) {
      const p = `components.${vid}.${j}`;
      if (`${p}.remove` in obj) continue;
      const q = intOrNull(str(obj, `${p}.quantity`));
      if (q == null || Number.isNaN(q) || q < 1) {
        errors[`${p}.quantity`] = "Mindestens 1.";
        continue;
      }
      items.push({ componentVariantId: str(obj, `${p}.componentVariantId`), quantity: q });
    }
    const newId = str(obj, `components.${vid}.new.componentVariantId`);
    if (newId) {
      const q = intOrNull(str(obj, `components.${vid}.new.quantity`) || "1");
      if (q == null || Number.isNaN(q) || q < 1)
        errors[`components.${vid}.new.quantity`] = "Mindestens 1.";
      else {
        const existing = items.find((it) => it.componentVariantId === newId);
        if (existing) existing.quantity += q;
        else items.push({ componentVariantId: newId, quantity: q });
      }
    }
    components.push({ bundleVariantId: vid, items });
  }

  /* Alt-Texte */
  const imageAlts: ParsedProductForm["imageAlts"] = [];
  for (const k of Object.keys(obj)) {
    const id = new RegExp(`^images\\.(${UUID_RE})\\.alt$`).exec(k)?.[1];
    if (!id) continue;
    const alt = str(obj, k);
    if (!alt) {
      errors[k] = "Bitte gib einen Alt-Text ein (Pflicht für Barrierefreiheit).";
      continue;
    }
    if (alt !== str(obj, `images.${id}.altOriginal`)) imageAlts.push({ id, alt });
  }

  return { product, line, variants, newVariantIndex, components, imageAlts, errors };
}

/**
 * Eingaben für ActionState.values (Strings): Mehrfachwerte mit Komma, damit Checkbox-Gruppen
 * nach einem Fehler ihren Zustand behalten.
 */
export function flattenFormValues(obj: FormObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = Array.isArray(v) ? v.join(",") : v;
  return out;
}

/**
 * Fehler der Bundle-Prüfung (Pfade "components.<n>.…" beziehen sich auf die bereinigte Liste)
 * gesammelt an der Komponentenkarte der Bundle-Variante anzeigen.
 */
export function mapComponentErrors(bundleVariantId: string, errors: FieldErrors): FieldErrors {
  const messages = [...new Set(Object.values(errors))];
  return messages.length ? { [`components.${bundleVariantId}`]: messages.join(" ") } : {};
}
