import type { Cents } from "@/lib/money";

export type UnitMeasure = "l" | "kg" | "piece";

export interface BasePriceInput {
  /** Verkaufspreis der Variante, brutto, inklusive Pfand-Anteil noch NICHT abgezogen */
  priceCents: Cents;
  /** Pfand je Einheit (Dose) in Cent, 0 wenn kein Pfand */
  depositCentsPerUnit: Cents;
  /** Anzahl Einheiten (Dosen) in der Variante */
  unitCount: number;
  /** Nettofüllmenge je Einheit in der Basiseinheit (0.33 für 330 ml bei Liter) */
  netContentPerUnit: number | null;
  measure: UnitMeasure;
}

export interface BasePrice {
  /** Grundpreis in Cent je Basiseinheit (Liter, Kilogramm oder Stück), gerundet auf ganze Cent */
  cents: Cents;
  measure: UnitMeasure;
  /** Menge, auf die sich der Grundpreis bezieht (immer 1) */
  referenceQuantity: 1;
  /** Preis ohne Pfand, der dem Grundpreis zugrunde liegt */
  priceWithoutDepositCents: Cents;
  depositCents: Cents;
}

/**
 * Grundpreis nach Preisangabenverordnung: Pfand wird nicht eingerechnet (§ 7 PAngV),
 * Bezug ist 1 Liter, 1 Kilogramm oder 1 Stück.
 */
export function calculateBasePrice(input: BasePriceInput): BasePrice {
  const depositCents = input.depositCentsPerUnit * input.unitCount;
  const priceWithoutDepositCents = input.priceCents - depositCents;
  if (priceWithoutDepositCents < 0) {
    throw new RangeError("Pfand übersteigt den Verkaufspreis");
  }
  if (input.measure === "piece" || !input.netContentPerUnit || input.netContentPerUnit <= 0) {
    return {
      cents: Math.round(priceWithoutDepositCents / input.unitCount),
      measure: "piece",
      referenceQuantity: 1,
      priceWithoutDepositCents,
      depositCents,
    };
  }
  const totalContent = input.unitCount * input.netContentPerUnit;
  return {
    cents: Math.round(priceWithoutDepositCents / totalContent),
    measure: input.measure,
    referenceQuantity: 1,
    priceWithoutDepositCents,
    depositCents,
  };
}

const measureLabel: Record<UnitMeasure, string> = { l: "l", kg: "kg", piece: "Stück" };

export function formatBasePrice(basePrice: BasePrice): string {
  const euro = (basePrice.cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${euro} € / ${measureLabel[basePrice.measure]}`;
}
