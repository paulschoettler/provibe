import { applyBasisPoints, type Cents } from "@/lib/money";
import { calculateCartTotals } from "./cart-totals";
import type { CartTotals, PricedLine, ShippingRateRule } from "./types";

/**
 * Preis je Abo-Lieferung. Der Abo-Rabatt (Basispunkte, 1000 = 10 %) wirkt ausschließlich auf den
 * Warenwert, nie auf Pfand oder Versand (Plan B). Technisch wird der Stückpreis der Abo-Position
 * vor calculateCartTotals um den Rabatt gesenkt; Pfand, Versandgrenze (auf dem rabattierten
 * Warenwert) und enthaltene MwSt. rechnet dann die gemeinsame Warenkorblogik wie bei jeder
 * anderen Bestellung. So gibt es keine zweite Summenlogik für Abos.
 */

/** Rabattbetrag auf einen Warenwert ohne Pfand, kaufmännisch gerundet, nie über dem Warenwert. */
export function subscriptionDiscountCents(goodsCents: Cents, discountBp: number): Cents {
  const bp = clampBasisPoints(discountBp);
  return Math.min(goodsCents, Math.max(0, applyBasisPoints(goodsCents, bp)));
}

/** Stückpreis ohne Pfand nach Abo-Rabatt. */
export function subscriptionUnitPriceCents(unitGoodsCents: Cents, discountBp: number): Cents {
  return unitGoodsCents - subscriptionDiscountCents(unitGoodsCents, discountBp);
}

/** Basispunkte auf 0 bis 10000 begrenzen (0 % bis 100 %), Nachkommastellen abschneiden. */
export function clampBasisPoints(bp: number): number {
  if (!Number.isFinite(bp)) return 0;
  return Math.min(10_000, Math.max(0, Math.trunc(bp)));
}

/** Prozentangabe für Badges: 1000 → "10 %", 750 → "7,5 %". */
export function formatBasisPointsPercent(bp: number): string {
  const percent = clampBasisPoints(bp) / 100;
  return `${percent.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

/** Position mit Listenpreis (ohne Rabatt), in die der Abo-Rabatt eingerechnet wird. */
export function applySubscriptionDiscount(line: PricedLine, discountBp: number): PricedLine {
  return { ...line, unitPriceCents: subscriptionUnitPriceCents(line.unitPriceCents, discountBp) };
}

export interface SubscriptionDeliveryInput {
  /** Abo-Position mit Listenpreis ohne Pfand (unitPriceCents) und Pfand je Stück */
  line: PricedLine;
  discountBp: number;
  shippingRates: ShippingRateRule[];
  depositTaxRateBp?: number;
  now?: Date;
}

export interface SubscriptionDeliveryPrice {
  totals: CartTotals;
  /** Warenwert ohne Pfand zum Listenpreis (Einmalkauf) */
  listGoodsCents: Cents;
  /** Ersparnis gegenüber dem Einmalkauf, nur Warenwert */
  savingsCents: Cents;
  /** Warenwert nach Abo-Rabatt, ohne Pfand */
  goodsCents: Cents;
  depositCents: Cents;
  shippingCents: Cents;
  /** Zahlbetrag je Lieferung inklusive Pfand, Versand und MwSt. */
  totalCents: Cents;
}

/**
 * Preis je Lieferung für genau eine Abo-Position: Warenwert mit Rabatt, Pfand, Versand nach
 * Schwelle (Grenze auf dem rabattierten Warenwert ohne Pfand), Steuern über calculateCartTotals.
 */
export function subscriptionDeliveryPrice(
  input: SubscriptionDeliveryInput,
): SubscriptionDeliveryPrice {
  const discounted = applySubscriptionDiscount(input.line, input.discountBp);
  const totals = calculateCartTotals({
    lines: [discounted],
    discount: null,
    shippingRates: input.shippingRates,
    depositTaxRateBp: input.depositTaxRateBp,
    now: input.now,
  });
  const listGoodsCents = input.line.quantity * input.line.unitPriceCents;
  return {
    totals,
    listGoodsCents,
    savingsCents: listGoodsCents - totals.subtotalCents,
    goodsCents: totals.subtotalCents,
    depositCents: totals.depositCents,
    shippingCents: totals.shippingCents,
    totalCents: totals.totalCents,
  };
}
