import type { Cents } from "@/lib/money";
import { evaluateDiscount } from "./discounts";
import { selectShippingRate } from "./shipping";
import { buildTaxLines } from "./tax";
import type { CartTotals, DiscountRule, LineTotals, PricedLine, ShippingRateRule } from "./types";

export interface CartTotalsInput {
  lines: PricedLine[];
  discount?: DiscountRule | null;
  shippingRates: ShippingRateRule[];
  /** Pfand-Steuersatz (Pfand wird mit dem Satz der Ware besteuert, Standard 19 %) */
  depositTaxRateBp?: number;
  now?: Date;
}

/**
 * Einzige Stelle, an der Warenkorb- und Bestellsummen berechnet werden. Läuft ausschließlich
 * auf dem Server. Der Client liefert nur Varianten-IDs und Mengen.
 *
 * Reihenfolge: Warenwert → Rabatt (nur auf Waren) → Pfand (nie rabattiert) → Versand
 * (Grenze auf rabattiertem Warenwert ohne Pfand) → enthaltene MwSt. je Satz → Gesamt.
 */
export function calculateCartTotals(input: CartTotalsInput): CartTotals {
  const now = input.now ?? new Date();
  const depositTaxRateBp = input.depositTaxRateBp ?? 1900;

  const discount = evaluateDiscount(input.discount ?? null, input.lines, now);

  const lines: LineTotals[] = input.lines.map((l, i) => {
    const grossCents = l.quantity * l.unitPriceCents;
    const depositCents = l.quantity * l.unitDepositCents;
    const discountCents = discount.perLineCents[i] ?? 0;
    return {
      ...l,
      grossCents,
      depositCents,
      discountCents,
      lineTotalCents: grossCents + depositCents - discountCents,
    };
  });

  const subtotalCents = sum(lines.map((l) => l.grossCents));
  const discountCents = discount.discountCents;
  const discountedSubtotalCents = subtotalCents - discountCents;
  const depositCents = sum(lines.map((l) => l.depositCents));
  const totalWeightGrams = sum(lines.map((l) => l.quantity * l.weightGrams));

  const shipping = selectShippingRate(
    input.shippingRates,
    discountedSubtotalCents,
    totalWeightGrams,
    discount.freeShipping,
  );

  const taxLines = buildTaxLines([
    ...lines.map((l) => ({ rateBp: l.taxRateBp, grossCents: l.grossCents - l.discountCents })),
    { rateBp: depositTaxRateBp, grossCents: depositCents },
    ...(shipping.rate
      ? [{ rateBp: shipping.rate.taxRateBp, grossCents: shipping.priceCents }]
      : []),
  ]);

  const totalCents = discountedSubtotalCents + depositCents + shipping.priceCents;

  return {
    lines,
    subtotalCents,
    discountCents,
    discountCode: discount.ok && input.discount ? input.discount.code : null,
    discountReason: discount.reason,
    discountedSubtotalCents,
    depositCents,
    shippingCents: shipping.priceCents,
    shippingRate: shipping.rate,
    shippingFree: shipping.free,
    amountToFreeShippingCents: shipping.amountToFreeShippingCents,
    taxLines,
    taxCents: sum(taxLines.map((t) => t.taxCents)),
    totalCents,
    totalWeightGrams,
  };
}

function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
