import { includedTaxFromGross, type Cents } from "@/lib/money";
import type { TaxLine } from "./types";

/** Steuerzeilen nach Steuersatz zusammenfassen (Bruttobeträge, enthaltene MwSt.). */
export function buildTaxLines(parts: { rateBp: number; grossCents: Cents }[]): TaxLine[] {
  const byRate = new Map<number, Cents>();
  for (const p of parts) {
    if (p.grossCents === 0) continue;
    byRate.set(p.rateBp, (byRate.get(p.rateBp) ?? 0) + p.grossCents);
  }
  return [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rateBp, grossCents]) => ({
      rateBp,
      grossCents,
      taxCents: includedTaxFromGross(grossCents, rateBp),
    }));
}
