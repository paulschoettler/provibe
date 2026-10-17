import { describe, expect, it } from "vitest";
import type { ShippingRateRule } from "@/lib/pricing";
import { buildCartView, depositPerItemCents, type CartRawLine } from "./mapping";

/** Versandtarif wie in der Datenbank: 4,90 €, kostenlos ab 50 € Warenwert ohne Pfand. */
const dhl: ShippingRateRule = {
  id: "rate-de",
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

/** Wildberry 9er: 26,10 € brutto inklusive 9 × 25 Cent Pfand, 0,33 l je Dose. */
function pack(overrides: Partial<CartRawLine> = {}): CartRawLine {
  return {
    id: "line-1",
    variantId: "variant-1",
    productId: "product-1",
    productHandle: "wildberry",
    productTitle: "Wildberry",
    variantTitle: "9 Dosen",
    unitCount: 9,
    quantity: 1,
    priceCents: 2610,
    depositCentsPerUnit: 25,
    netContentPerUnit: 0.33,
    basePriceMeasure: "l",
    taxRateBp: 1900,
    weightGrams: 3640,
    imageUrl: "/images/cans/wildberry.webp",
    productUrl: "/products/wildberry",
    ...overrides,
  };
}

describe("depositPerItemCents", () => {
  it("multipliziert Pfand je Dose mit der Anzahl Dosen", () => {
    expect(depositPerItemCents({ priceCents: 2610, depositCentsPerUnit: 25, unitCount: 9 })).toBe(
      225,
    );
  });

  it("gibt 0 zurück, wenn kein Pfand hinterlegt ist", () => {
    expect(depositPerItemCents({ priceCents: 2990, depositCentsPerUnit: 0, unitCount: 1 })).toBe(0);
  });

  it("begrenzt defensiv auf 0, wenn das Pfand über dem Preis läge", () => {
    expect(depositPerItemCents({ priceCents: 100, depositCentsPerUnit: 25, unitCount: 9 })).toBe(0);
  });
});

describe("buildCartView", () => {
  it("liefert den leeren Warenkorb, wenn keine Zeilen da sind", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: "2026-09-21T10:00:00.000Z",
      lines: [],
      shippingRates: [dhl],
    });
    expect(view.id).toBe("cart-1");
    expect(view.lines).toEqual([]);
    expect(view.itemCount).toBe(0);
    expect(view.totals).toBeNull();
  });

  it("rechnet das Pfand aus dem Preis heraus und weist es getrennt aus", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [pack()],
      shippingRates: [dhl],
    });
    const line = view.lines[0];
    expect(line.unitDepositCents).toBe(225);
    expect(line.unitPriceCents).toBe(2385);
    // Die Zeilensumme bleibt der Zahlbetrag: Warenwert plus Pfand
    expect(line.lineTotalCents).toBe(2610);
    // Angezeigt werden Preis ohne Pfand und Pfand getrennt (§ 7 PAngV, H22)
    expect(line.lineGoodsCents).toBe(2385);
    expect(line.lineDepositCents).toBe(225);
    expect(view.totals?.subtotalCents).toBe(2385);
    expect(view.totals?.depositCents).toBe(225);
  });

  it("zählt Mengen und Zeilensummen über mehrere Positionen", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [
        pack({ quantity: 2 }),
        pack({
          id: "line-2",
          variantId: "variant-2",
          productId: "product-2",
          productHandle: "provibe-shirt",
          productTitle: "provibe Shirt",
          variantTitle: "M",
          unitCount: 1,
          quantity: 1,
          priceCents: 2990,
          depositCentsPerUnit: 0,
          netContentPerUnit: null,
          basePriceMeasure: "piece",
          weightGrams: 300,
        }),
      ],
      shippingRates: [dhl],
    });
    expect(view.itemCount).toBe(3);
    expect(view.lines[0].lineTotalCents).toBe(5220);
    expect(view.lines[0].lineGoodsCents).toBe(4770);
    expect(view.lines[0].lineDepositCents).toBe(450);
    expect(view.lines[1].lineTotalCents).toBe(2990);
    expect(view.lines[1].lineGoodsCents).toBe(2990);
    expect(view.lines[1].lineDepositCents).toBe(0);
    expect(view.totals?.subtotalCents).toBe(2385 * 2 + 2990);
    expect(view.totals?.depositCents).toBe(450);
    expect(view.totals?.totalWeightGrams).toBe(3640 * 2 + 300);
  });

  it("formatiert den Grundpreis je Liter ohne Pfand (PAngV)", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [pack()],
      shippingRates: [dhl],
    });
    // (26,10 € − 2,25 € Pfand) / (9 × 0,33 l) = 8,03 € je Liter
    expect(view.lines[0].basePriceText).toBe("8,03 € / l");
  });

  it("nennt Stückpreis als Grundpreis, wenn keine Füllmenge hinterlegt ist", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [
        pack({
          unitCount: 1,
          priceCents: 2990,
          depositCentsPerUnit: 0,
          netContentPerUnit: null,
          basePriceMeasure: "piece",
        }),
      ],
      shippingRates: [dhl],
    });
    expect(view.lines[0].basePriceText).toBe("29,90 € / Stück");
  });

  it("schlägt Versand auf, solange die Freigrenze nicht erreicht ist", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [pack()],
      shippingRates: [dhl],
    });
    expect(view.totals?.shippingCents).toBe(490);
    expect(view.totals?.shippingFree).toBe(false);
    // Freigrenze zählt den Warenwert ohne Pfand: 50,00 € − 23,85 €
    expect(view.totals?.amountToFreeShippingCents).toBe(2615);
    expect(view.totals?.totalCents).toBe(2385 + 225 + 490);
  });

  it("liefert kostenlosen Versand über der Freigrenze", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [pack({ quantity: 3 })],
      shippingRates: [dhl],
    });
    expect(view.totals?.shippingFree).toBe(true);
    expect(view.totals?.shippingCents).toBe(0);
    expect(view.totals?.amountToFreeShippingCents).toBe(0);
    expect(view.totals?.totalCents).toBe(2610 * 3);
  });

  it("weist die enthaltene MwSt. für Ware, Pfand und Versand aus", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [pack()],
      shippingRates: [dhl],
    });
    // 19 % aus 26,10 € Ware plus Pfand und 4,90 € Versand
    expect(view.totals?.taxLines).toHaveLength(1);
    expect(view.totals?.taxCents).toBe(495);
  });

  it("behandelt Bundle-Pfand aus den Komponenten wie normales Pfand", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [
        pack({
          productHandle: "founder-bundle-i",
          productTitle: "Founder Bundle I",
          variantTitle: "Standard",
          unitCount: 1,
          priceCents: 3580,
          // 6 Dosen à 25 Cent stecken im Bundle
          depositCentsPerUnit: 150,
          netContentPerUnit: null,
          basePriceMeasure: "piece",
        }),
      ],
      shippingRates: [dhl],
    });
    expect(view.lines[0].unitDepositCents).toBe(150);
    expect(view.lines[0].unitPriceCents).toBe(3430);
    expect(view.lines[0].lineGoodsCents).toBe(3430);
    expect(view.lines[0].lineDepositCents).toBe(150);
    expect(view.lines[0].basePriceText).toBe("34,30 € / Stück");
  });

  it("Zeilenpreis ohne Pfand plus Pfand ergibt immer den Zahlbetrag der Zeile", () => {
    const view = buildCartView({
      cartId: "cart-1",
      updatedAt: null,
      lines: [
        pack({ quantity: 4 }),
        pack({ id: "line-2", quantity: 1, priceCents: 13200, unitCount: 48 }),
      ],
      shippingRates: [dhl],
    });
    for (const line of view.lines) {
      expect(line.lineGoodsCents + line.lineDepositCents).toBe(line.lineTotalCents);
    }
    expect(view.lines.reduce((s, l) => s + l.lineGoodsCents, 0)).toBe(view.totals?.subtotalCents);
    expect(view.lines.reduce((s, l) => s + l.lineDepositCents, 0)).toBe(view.totals?.depositCents);
  });
});
