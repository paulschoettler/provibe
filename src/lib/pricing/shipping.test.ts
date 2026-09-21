import { describe, expect, it } from "vitest";
import { selectShippingRate } from "./shipping";
import type { ShippingRateRule } from "./types";

const rates: ShippingRateRule[] = [
  {
    id: "light",
    name: "Päckchen",
    priceCents: 390,
    minSubtotalCents: 0,
    minWeightGrams: 0,
    maxWeightGrams: 2000,
    taxRateBp: 1900,
    freeAboveSubtotalCents: 5000,
  },
  {
    id: "heavy",
    name: "Paket",
    priceCents: 690,
    minSubtotalCents: 0,
    minWeightGrams: 2001,
    maxWeightGrams: 31500,
    taxRateBp: 1900,
    freeAboveSubtotalCents: 5000,
  },
];

describe("Versandtarif", () => {
  it("wählt nach Gewicht", () => {
    expect(selectShippingRate(rates, 1000, 500).rate?.id).toBe("light");
    expect(selectShippingRate(rates, 1000, 5000).rate?.id).toBe("heavy");
  });
  it("berechnet den Fehlbetrag zur Freigrenze", () => {
    const s = selectShippingRate(rates, 4200, 500);
    expect(s.amountToFreeShippingCents).toBe(800);
    expect(selectShippingRate(rates, 5000, 500).free).toBe(true);
  });
  it("liefert null ohne passenden Tarif", () => {
    expect(selectShippingRate(rates, 1000, 40000).rate).toBeNull();
  });
});
