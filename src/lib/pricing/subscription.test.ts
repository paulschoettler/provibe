import { describe, expect, it } from "vitest";
import type { PricedLine, ShippingRateRule } from "./types";
import {
  clampBasisPoints,
  formatBasisPointsPercent,
  subscriptionDeliveryPrice,
  subscriptionDiscountCents,
  subscriptionUnitPriceCents,
} from "./subscription";

const dhl: ShippingRateRule = {
  id: "dhl",
  name: "DHL Paket",
  priceCents: 490,
  freeAboveSubtotalCents: 5000,
  minSubtotalCents: 0,
  maxSubtotalCents: null,
  minWeightGrams: 0,
  maxWeightGrams: null,
  taxRateBp: 1900,
  deliveryTimeText: "3–5 Werktage",
};

/** Wildberry 9er: 23,85 € Warenwert ohne Pfand, 9 × 0,25 € Pfand */
function nine(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    variantId: "v9",
    productId: "p",
    quantity: 1,
    unitPriceCents: 2385,
    unitDepositCents: 225,
    taxRateBp: 700,
    weightGrams: 3640,
    ...overrides,
  };
}

describe("Abo-Rabatt", () => {
  it("rundet kaufmännisch und wirkt nur auf den Warenwert", () => {
    expect(subscriptionDiscountCents(2385, 1000)).toBe(239); // 238,5 → 239
    expect(subscriptionUnitPriceCents(2385, 1000)).toBe(2146);
    expect(subscriptionUnitPriceCents(2385, 0)).toBe(2385);
  });
  it("begrenzt Basispunkte auf 0 bis 100 Prozent", () => {
    expect(clampBasisPoints(-5)).toBe(0);
    expect(clampBasisPoints(12_000)).toBe(10_000);
    expect(clampBasisPoints(Number.NaN)).toBe(0);
    expect(subscriptionDiscountCents(1000, 20_000)).toBe(1000);
  });
  it("formatiert Prozent für Badges", () => {
    expect(formatBasisPointsPercent(1000)).toBe("10 %");
    expect(formatBasisPointsPercent(750)).toBe("7,5 %");
  });
});

describe("Preis je Lieferung", () => {
  it("9er im Abo: Warenwert mit Rabatt, Pfand unverändert, Versand unter der Schwelle", () => {
    const p = subscriptionDeliveryPrice({ line: nine(), discountBp: 1000, shippingRates: [dhl] });
    expect(p.goodsCents).toBe(2146);
    expect(p.listGoodsCents).toBe(2385);
    expect(p.savingsCents).toBe(239);
    expect(p.depositCents).toBe(225);
    expect(p.shippingCents).toBe(490);
    expect(p.totalCents).toBe(2146 + 225 + 490); // 28,61 € wie im Figma-Entwurf
  });
  it("Versandgrenze zählt auf dem rabattierten Warenwert ohne Pfand", () => {
    // 24er: 64,90 € Warenwert, mit 10 % 58,41 € → versandkostenfrei
    const p = subscriptionDeliveryPrice({
      line: nine({ unitPriceCents: 6490, unitDepositCents: 600 }),
      discountBp: 1000,
      shippingRates: [dhl],
    });
    expect(p.shippingCents).toBe(0);
    expect(p.totalCents).toBe(5841 + 600);
    // Knapp über 50 € vor Rabatt, darunter nach Rabatt: Versand fällt an
    const q = subscriptionDeliveryPrice({
      line: nine({ unitPriceCents: 5200, unitDepositCents: 450 }),
      discountBp: 1000,
      shippingRates: [dhl],
    });
    expect(q.goodsCents).toBe(4680);
    expect(q.shippingCents).toBe(490);
  });
  it("weist die enthaltene MwSt. je Satz aus (Ware 7 %, Pfand und Versand 19 %)", () => {
    const p = subscriptionDeliveryPrice({ line: nine(), discountBp: 1000, shippingRates: [dhl] });
    const rates = p.totals.taxLines.map((t) => t.rateBp);
    expect(rates).toEqual([1900, 700]);
    expect(p.totals.taxLines.find((t) => t.rateBp === 700)?.grossCents).toBe(2146);
    expect(p.totals.taxLines.find((t) => t.rateBp === 1900)?.grossCents).toBe(225 + 490);
  });
  it("Menge 2 verdoppelt Warenwert und Pfand", () => {
    const p = subscriptionDeliveryPrice({
      line: nine({ quantity: 2 }),
      discountBp: 1000,
      shippingRates: [dhl],
    });
    expect(p.goodsCents).toBe(4292);
    expect(p.depositCents).toBe(450);
  });
});
