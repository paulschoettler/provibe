import { describe, expect, it } from "vitest";
import {
  buildAmountsSnapshot,
  hasSubscriptionLines,
  lineDescription,
  subscriptionSavingsCents,
} from "@/lib/checkout/snapshot";
import type { CheckoutRawLine } from "@/lib/checkout/types";
import type { ShippingRateRule } from "@/lib/pricing";
import { formatDay } from "./schedule";
import { subscriptionTerms } from "./terms";

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

function line(overrides: Partial<CheckoutRawLine> = {}): CheckoutRawLine {
  return {
    cartItemId: "ci-1",
    variantId: "v9",
    productId: "p-wild",
    productHandle: "wildberry",
    productKind: "simple",
    productTitle: "Wildberry Eistee",
    productSubtitle: null,
    variantTitle: "9 Dosen",
    sku: null,
    unitCount: 9,
    quantity: 1,
    priceCents: 2610,
    depositCentsPerUnit: 25,
    depositCentsPerCan: 25,
    depositCansPerItem: 9,
    netContentPerUnit: 0.33,
    basePriceMeasure: "l",
    taxClass: "reduced",
    taxRateBp: 700,
    weightGrams: 3640,
    imageUrl: null,
    components: null,
    ...overrides,
  };
}

describe("Abo-Position im Checkout-Snapshot", () => {
  it("rechnet den Abo-Preis ein, Pfand unverändert, Grundpreis nach Rabatt", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [line({ subscription: { intervalWeeks: 4, discountBp: 1000 } })],
      discount: null,
      shippingRates: [dhl],
      depositTaxRateBp: 1900,
    });
    const l = snapshot.lines[0];
    expect(l.unitPriceCents).toBe(2146);
    expect(l.unitDepositCents).toBe(225);
    expect(l.subscription).toEqual({
      intervalWeeks: 4,
      discountBp: 1000,
      listUnitPriceCents: 2385,
    });
    expect(l.basePriceText).toBe("7,23 € / l");
    expect(snapshot.totalCents).toBe(2861);
    expect(subscriptionSavingsCents(snapshot)).toBe(239);
    expect(hasSubscriptionLines(snapshot)).toBe(true);
  });
  it("Mischwarenkorb: Einmalkauf zum Listenpreis, Versandgrenze auf der Summe", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [
        line({ subscription: { intervalWeeks: 4, discountBp: 1000 } }),
        line({
          cartItemId: "ci-2",
          variantId: "r12",
          unitCount: 12,
          priceCents: 3460,
          depositCansPerItem: 12,
        }),
      ],
      discount: null,
      shippingRates: [dhl],
      depositTaxRateBp: 1900,
    });
    expect(snapshot.subtotalCents).toBe(2146 + 3160);
    expect(snapshot.shippingCents).toBe(0);
    expect(snapshot.totalCents).toBe(5831);
  });
  it("Beschreibung nennt das Intervall", () => {
    expect(lineDescription(line({ subscription: { intervalWeeks: 6, discountBp: 1000 } }))).toBe(
      "9 Dosen à 0,33 l · im Abo alle 6 Wochen",
    );
    expect(lineDescription(line())).toBe("9 Dosen à 0,33 l");
  });
});

describe("Pflichtangaben vor dem Button", () => {
  it("Preis je Lieferung gilt für das Abo allein, auch wenn die erste Bestellung versandfrei ist", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [
        line({ subscription: { intervalWeeks: 4, discountBp: 1000 } }),
        line({
          cartItemId: "ci-2",
          variantId: "r12",
          unitCount: 12,
          priceCents: 3460,
          depositCansPerItem: 12,
        }),
      ],
      discount: null,
      shippingRates: [dhl],
      depositTaxRateBp: 1900,
    });
    const [t] = subscriptionTerms(snapshot, [dhl], 1900, new Date("2026-10-17T12:00:00Z"));
    expect(t.intervalWeeks).toBe(4);
    expect(t.goodsCents).toBe(2146);
    expect(t.depositCents).toBe(225);
    expect(t.shippingCents).toBe(490);
    expect(t.totalCents).toBe(2861);
    expect(formatDay(t.nextDelivery)).toBe("14.11.2026");
  });
  it("ohne Abo-Positionen keine Angaben", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [line()],
      discount: null,
      shippingRates: [dhl],
      depositTaxRateBp: 1900,
    });
    expect(subscriptionTerms(snapshot, [dhl], 1900)).toEqual([]);
    expect(hasSubscriptionLines(snapshot)).toBe(false);
  });
});
