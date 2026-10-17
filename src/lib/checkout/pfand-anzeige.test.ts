import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartSummary, DepositNote } from "@/components/cart/cart-parts";
import { buildCartView, type CartRawLine } from "@/lib/cart/mapping";
import type { ShippingRateRule } from "@/lib/pricing";
import { orderConfirmationEmail } from "./emails";
import { lineAmounts, type OrderView } from "./order-view";

/**
 * Entscheidung H22 (§ 7 PAngV): Preise erscheinen ohne Pfand, das Pfand steht getrennt daneben
 * ("zzgl. 2,25 € Pfand"). Nur der Zahlbetrag "Gesamt" enthält das Pfand und sagt das auch.
 * Leerzeichen in formatEur sind geschützt (U+00A0), deshalb normalisiert norm() sie für Vergleiche.
 */
const norm = (s: string) => s.replace(/ | /g, " ");

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

const wildberry: CartRawLine = {
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
  imageUrl: null,
  productUrl: "/products/wildberry",
};

describe("lineAmounts", () => {
  it("trennt Zeilenpreis ohne Pfand und Pfand", () => {
    expect(lineAmounts({ quantity: 2, unitPriceCents: 2385, unitDepositCents: 225 })).toEqual({
      goodsCents: 4770,
      depositCents: 450,
    });
    expect(lineAmounts({ quantity: 1, unitPriceCents: 2990, unitDepositCents: 0 })).toEqual({
      goodsCents: 2990,
      depositCents: 0,
    });
  });
});

describe("Warenkorb-Anzeige", () => {
  it("Pfandhinweis je Zeile lautet zzgl., nie inkl.", () => {
    const html = norm(renderToStaticMarkup(createElement(DepositNote, { lineDepositCents: 225 })));
    expect(html).toContain("zzgl. 2,25 € Pfand");
    expect(html).not.toContain("inkl.");
    expect(renderToStaticMarkup(createElement(DepositNote, { lineDepositCents: 0 }))).toBe("");
  });

  it("Summenblock: Zwischensumme ohne Pfand, Pfand, Versand, Zahlbetrag inkl. Pfand", () => {
    const view = buildCartView({
      cartId: "c",
      updatedAt: null,
      lines: [wildberry],
      shippingRates: [dhl],
    });
    const html = norm(renderToStaticMarkup(createElement(CartSummary, { totals: view.totals! })));
    expect(html).toContain("Zwischensumme (ohne Pfand)");
    expect(html).toContain("23,85 €");
    expect(html).toContain("2,25 €");
    expect(html).toContain("4,90 €");
    // 23,85 + 2,25 + 4,90 = 31,00 € Zahlbetrag
    expect(html).toContain("31,00 €");
    expect(html).toContain("Zahlbetrag inkl. Pfand und MwSt.");
  });
});

describe("Bestellmail", () => {
  const order: OrderView = {
    id: "o1",
    orderNumber: "PV-10001",
    email: "test@provibe-drinks.de",
    placedAt: "2026-10-17T10:00:00.000Z",
    paidAt: "2026-10-17T10:01:00.000Z",
    paymentStatus: "paid",
    paymentLabel: "Karte",
    items: [
      {
        title: "Wildberry Eistee",
        description: "9 Dosen à 0,33 l",
        quantity: 2,
        displayTotalCents: 5220,
        unitPriceCents: 2385,
        unitDepositCents: 225,
        basePriceText: "8,03 € / l",
        imageUrl: null,
      },
    ],
    itemCount: 2,
    subtotalCents: 4770,
    discountCents: 0,
    discountCode: null,
    depositCents: 450,
    depositLabel: "Pfand (18 Dosen à 0,25 €)",
    shippingCents: 0,
    shippingName: "DHL Paket",
    shippingFree: true,
    deliveryTimeText: "3 bis 5 Werktage",
    taxLines: [{ rateBp: 1900, grossCents: 5220, taxCents: 833 }],
    taxCents: 833,
    totalCents: 5220,
    shippingAddress: {
      first_name: "Test",
      last_name: "Kundin",
      company: null,
      street: "Teststraße",
      house_number: "1",
      address_addition: null,
      postal_code: "10115",
      city: "Berlin",
      country_code: "DE",
      phone: null,
    },
    billingAddress: null,
    legalVersionIds: [],
    isTest: true,
    marketingOptIn: false,
  };

  it("zeigt Positionen ohne Pfand und das Pfand getrennt, Gesamt als Zahlbetrag", () => {
    const mail = orderConfirmationEmail(order, {}, null, "https://example.test");
    const html = norm(mail.html);
    const text = norm(mail.text);
    // Zeilenpreis in der Positionstabelle: 2 × 23,85 € ohne Pfand, nicht 52,20 € mit Pfand
    expect(html).toContain('vertical-align:top">47,70 €</td>');
    expect(html).not.toContain('vertical-align:top">52,20 €</td>');
    expect(html).toContain("zzgl. 4,50 € Pfand");
    expect(html).not.toMatch(/inkl\. [\d,]+ € Pfand/);
    expect(html).toContain("Zahlbetrag inkl. Pfand und MwSt.");
    expect(text).toContain("2 × Wildberry Eistee (9 Dosen à 0,33 l): 47,70 € zzgl. 4,50 € Pfand");
    expect(text).toContain("Gesamt: 52,20 € (Zahlbetrag inkl. Pfand und MwSt.");
  });
});
