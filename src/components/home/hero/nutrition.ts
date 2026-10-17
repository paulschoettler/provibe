import type { HomeFlavor } from "@/lib/catalog/home";

/**
 * Nährwerte für den Zutatenschritt des Heros (Richtung A): Kacheln mit großem
 * Wert und kleiner Bezeichnung. Reine Funktion, kein React, damit sie testbar ist.
 */

/** Beschriftung der Nährwertschlüssel aus product_translations.nutrition. */
const NUTRITION_LABELS: Record<string, string> = {
  energy: "Energie",
  fat_g: "Fett",
  saturated_fat_g: "davon gesättigte Fettsäuren",
  carbs_g: "Kohlenhydrate",
  sugar_g: "davon Zucker",
  fibre_g: "Ballaststoffe",
  protein_g: "Eiweiß",
  salt_g: "Salz",
};

/** Reihenfolge nach LMIV Anhang XV. JSONB liefert die Schlüssel unsortiert. */
const NUTRITION_ORDER = [
  "energy",
  "fat_g",
  "saturated_fat_g",
  "carbs_g",
  "sugar_g",
  "fibre_g",
  "protein_g",
  "salt_g",
];

/**
 * Diese drei Werte stehen auf Mobil als Kacheln, der Rest als Textzeile darunter
 * (Entwurf Richtung A, Mobil 2 Zutaten).
 */
const FEATURED = new Set(["energy", "protein_g", "sugar_g"]);

export interface NutritionRow {
  key: string;
  /** Bezeichnung, steht in der Kachel klein unter dem Wert (dt). */
  label: string;
  /** Wert, steht in der Kachel groß (dd). */
  value: string;
  /** Auf Mobil als Kachel statt in der Restzeile. */
  featured: boolean;
  /** Hervorgehobene Kachel (Eiweiß in Magenta). */
  highlight: boolean;
}

function nutritionLabel(key: string): string {
  return NUTRITION_LABELS[key] ?? key.replace(/_/g, " ");
}

function nutritionUnit(key: string): string {
  if (key.endsWith("_g")) return "g";
  if (key.endsWith("_mg")) return "mg";
  return "";
}

function present(value: unknown): value is string | number {
  return value !== undefined && value !== null && typeof value !== "object" && value !== "";
}

/**
 * Nährwerte in Kacheln umwandeln. "per" wird zur Überschrift. Energie wird eine
 * Kachel mit kcal als Wert und kJ in der Bezeichnung, der Rest folgt der
 * LMIV-Reihenfolge.
 */
export function nutritionRows(nutrition: HomeFlavor["nutrition"]): {
  per: string;
  rows: NutritionRow[];
} {
  if (!nutrition) return { per: "100 ml", rows: [] };
  const per = typeof nutrition.per === "string" ? nutrition.per : "100 ml";
  const rows: NutritionRow[] = [];

  const kj = nutrition.energy_kj;
  const kcal = nutrition.energy_kcal;
  if (present(kcal) || present(kj)) {
    const value = present(kcal) ? `${kcal} kcal` : `${kj} kJ`;
    const label = present(kcal) && present(kj) ? `Energie · ${kj} kJ` : "Energie";
    rows.push({ key: "energy", label, value, featured: true, highlight: false });
  }

  for (const [key, raw] of Object.entries(nutrition)) {
    if (key === "per" || key === "energy_kj" || key === "energy_kcal") continue;
    if (!present(raw)) continue;
    const unit = nutritionUnit(key);
    rows.push({
      key,
      label: nutritionLabel(key),
      value: unit ? `${raw} ${unit}` : String(raw),
      featured: FEATURED.has(key),
      highlight: key === "protein_g",
    });
  }

  const rank = (key: string) => {
    const index = NUTRITION_ORDER.indexOf(key);
    return index === -1 ? NUTRITION_ORDER.length : index;
  };
  rows.sort((a, b) => rank(a.key) - rank(b.key));
  return { per, rows };
}
