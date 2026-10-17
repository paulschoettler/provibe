import { describe, expect, it } from "vitest";
import { calculateCartTotals } from "./cart-totals";
import type { DiscountRule, PricedLine, ShippingRateRule } from "./types";

// Ist-Stand PROVIBE: 4,90 € pauschal, versandkostenfrei ab 50 €, nur Deutschland
const deRates: ShippingRateRule[] = [
  {
    id: "de-standard",
    name: "DHL Paket",
    priceCents: 490,
    freeAboveSubtotalCents: 5000,
    minSubtotalCents: 0,
    minWeightGrams: 0,
    taxRateBp: 1900,
  },
];

const wildberry9: PricedLine = {
  variantId: "v-wb-9",
  productId: "p-wb",
  quantity: 1,
  unitPriceCents: 2610,
  unitDepositCents: 225, // 9 × 0,25 €
  taxRateBp: 1900,
  weightGrams: 3600,
};

const cup: PricedLine = {
  variantId: "v-cup",
  productId: "p-cup",
  quantity: 1,
  unitPriceCents: 1990,
  unitDepositCents: 0,
  taxRateBp: 1900,
  weightGrams: 150,
};

const presale10: DiscountRule = {
  code: "PRESALE10",
  kind: "percentage",
  value: 1000,
  minSubtotalCents: 0,
  usageCount: 0,
  isActive: true,
};

describe("Warenkorbsummen", () => {
  it("berechnet Pfand getrennt, Versand unter 50 € und die enthaltene MwSt.", () => {
    const t = calculateCartTotals({ lines: [wildberry9], shippingRates: deRates });
    expect(t.subtotalCents).toBe(2610);
    expect(t.depositCents).toBe(225);
    expect(t.shippingCents).toBe(490);
    expect(t.shippingFree).toBe(false);
    expect(t.amountToFreeShippingCents).toBe(2390);
    expect(t.totalCents).toBe(2610 + 225 + 490);
    expect(t.taxLines).toEqual([{ rateBp: 1900, grossCents: 3325, taxCents: 531 }]);
    expect(t.taxCents).toBe(531);
  });

  it("gewährt Versandkostenfreiheit ab 50 € Warenwert (ohne Pfand)", () => {
    const t = calculateCartTotals({
      lines: [{ ...wildberry9, quantity: 2 }],
      shippingRates: deRates,
    });
    expect(t.subtotalCents).toBe(5220);
    expect(t.shippingCents).toBe(0);
    expect(t.shippingFree).toBe(true);
    expect(t.amountToFreeShippingCents).toBe(0);
  });

  it("rechnet Pfand nicht auf die Versandkostenfreigrenze an", () => {
    // 49,90 € Waren + 4,50 € Pfand = 54,40 € Zahlbetrag, aber Warenwert unter 50 €
    const t = calculateCartTotals({
      lines: [{ ...wildberry9, unitPriceCents: 4990, unitDepositCents: 450 }],
      shippingRates: deRates,
    });
    expect(t.shippingCents).toBe(490);
    expect(t.amountToFreeShippingCents).toBe(10);
  });

  it("wendet PRESALE10 nur auf Waren an, nie auf Pfand, und prüft die Grenze danach", () => {
    const t = calculateCartTotals({
      lines: [{ ...wildberry9, quantity: 2 }],
      discount: presale10,
      shippingRates: deRates,
    });
    expect(t.discountCents).toBe(522);
    expect(t.discountedSubtotalCents).toBe(4698); // unter 50 € → Versand fällt wieder an
    expect(t.shippingCents).toBe(490);
    expect(t.depositCents).toBe(450);
    expect(t.totalCents).toBe(4698 + 450 + 490);
    expect(t.discountCode).toBe("PRESALE10");
  });

  it("verteilt Rabatte ohne Rundungsdifferenz auf die Positionen", () => {
    const t = calculateCartTotals({
      lines: [wildberry9, cup],
      discount: presale10,
      shippingRates: deRates,
    });
    expect(t.discountCents).toBe(460);
    expect(t.lines.map((l) => l.discountCents)).toEqual([261, 199]);
    expect(t.lines.reduce((a, l) => a + l.discountCents, 0)).toBe(460);
  });

  it("meldet abgelaufene, inaktive und zu kleine Warenkörbe", () => {
    const expired = { ...presale10, endsAt: new Date("2026-01-01") };
    expect(
      calculateCartTotals({ lines: [cup], discount: expired, shippingRates: deRates })
        .discountReason,
    ).toBe("expired");
    const inactive = { ...presale10, isActive: false };
    expect(
      calculateCartTotals({ lines: [cup], discount: inactive, shippingRates: deRates })
        .discountReason,
    ).toBe("inactive");
    const minimum = { ...presale10, minSubtotalCents: 5000 };
    const t = calculateCartTotals({ lines: [cup], discount: minimum, shippingRates: deRates });
    expect(t.discountReason).toBe("min_subtotal_not_reached");
    expect(t.discountCents).toBe(0);
  });

  it("begrenzt Festbeträge auf den Warenwert und lässt Pfand stehen", () => {
    const big: DiscountRule = {
      ...presale10,
      code: "HUNDERT",
      kind: "fixed_amount",
      value: 100_00,
    };
    const t = calculateCartTotals({ lines: [wildberry9], discount: big, shippingRates: deRates });
    expect(t.discountCents).toBe(2610);
    expect(t.discountedSubtotalCents).toBe(0);
    expect(t.totalCents).toBe(225 + 490);
  });

  it("Gratisversand-Code setzt den Versand auf 0", () => {
    const free: DiscountRule = { ...presale10, code: "FREI", kind: "free_shipping", value: 0 };
    const t = calculateCartTotals({ lines: [cup], discount: free, shippingRates: deRates });
    expect(t.shippingCents).toBe(0);
    expect(t.shippingFree).toBe(true);
    expect(t.discountCents).toBe(0);
  });

  it("gibt ohne passenden Tarif keinen Versand zurück (Zone abgeschaltet)", () => {
    const t = calculateCartTotals({ lines: [cup], shippingRates: [] });
    expect(t.shippingRate).toBeNull();
    expect(t.shippingCents).toBe(0);
  });

  it("fasst Steuern je Satz zusammen (Vorbereitung 7 %)", () => {
    const reduced: PricedLine = {
      ...cup,
      variantId: "v-x",
      productId: "p-x",
      taxRateBp: 700,
      unitPriceCents: 1070,
    };
    const t = calculateCartTotals({ lines: [cup, reduced], shippingRates: [] });
    expect(t.taxLines).toEqual([
      { rateBp: 1900, grossCents: 1990, taxCents: 318 },
      { rateBp: 700, grossCents: 1070, taxCents: 70 },
    ]);
  });

  it("begrenzt den Rabatt auf die genannten Produkte; eine leere Liste trifft nichts", () => {
    const onlyCup = calculateCartTotals({
      lines: [wildberry9, cup],
      discount: { ...presale10, productIds: ["p-cup"] },
      shippingRates: deRates,
    });
    expect(onlyCup.lines.map((l) => l.discountCents)).toEqual([0, 199]);

    const nothing = calculateCartTotals({
      lines: [wildberry9, cup],
      discount: { ...presale10, productIds: [] },
      shippingRates: deRates,
    });
    expect(nothing.discountCents).toBe(0);
    expect(nothing.discountReason).toBe("not_applicable");

    const whole = calculateCartTotals({
      lines: [wildberry9, cup],
      discount: presale10,
      shippingRates: deRates,
    });
    expect(whole.discountCents).toBe(460);
  });
});
