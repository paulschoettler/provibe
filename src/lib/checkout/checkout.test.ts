import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  deliveryWindow,
  formatDeliveryWindow,
  formatGermanDate,
} from "./delivery";
import { formatOrderNumber, isOrderNumber, parseOrderNumber } from "./order-number";
import {
  buildAmountsSnapshot,
  buildOrderItems,
  depositLabel,
  lineDescription,
  normalizeDeliveryText,
  orderTaxLines,
  splitStreet,
} from "./snapshot";
import { checkTestCard, expiryValid, luhnValid } from "./test-cards";
import type { CheckoutRawLine } from "./types";
import type { ShippingRateRule } from "@/lib/pricing";

describe("Nummernkreis", () => {
  it("beginnt bei PV-10001 und zählt ohne führende Null", () => {
    expect(formatOrderNumber(10001)).toBe("PV-10001");
    expect(formatOrderNumber(10002)).toBe("PV-10002");
    expect(formatOrderNumber(123456)).toBe("PV-123456");
  });
  it("erkennt und zerlegt das Format", () => {
    expect(isOrderNumber("PV-10001")).toBe(true);
    expect(isOrderNumber("PV-1001")).toBe(false);
    expect(isOrderNumber("#1001")).toBe(false);
    expect(parseOrderNumber("PV-10042")).toBe(10042);
    expect(parseOrderNumber("#1001")).toBeNull();
  });
  it("lehnt ungültige Werte ab", () => {
    expect(() => formatOrderNumber(0)).toThrow(RangeError);
    expect(() => formatOrderNumber(1.5)).toThrow(RangeError);
  });
});

describe("Zustellfenster", () => {
  it("Samstag plus 3 bis 5 Werktage ergibt Mittwoch bis Freitag (Figma-Beispiel)", () => {
    // Sa., 17.10.2026, 14:00 Uhr in Berlin (12:00 UTC)
    const w = deliveryWindow(new Date("2026-10-17T12:00:00Z"));
    expect(formatGermanDate(w.orderDate)).toBe("Sa., 17.10.2026");
    expect(formatDeliveryWindow(w)).toBe("Mi., 21.10. bis Fr., 23.10.2026");
  });
  it("Montag ergibt Donnerstag bis Montag (Wochenende zählt nicht)", () => {
    const w = deliveryWindow(new Date("2026-10-19T08:00:00Z"));
    expect(formatDeliveryWindow(w)).toBe("Do., 22.10. bis Mo., 26.10.2026");
  });
  it("rechnet im Berliner Kalender: kurz nach Mitternacht zählt schon der neue Tag", () => {
    // 22:30 UTC am Freitag = 00:30 Uhr Samstag in Berlin (Sommerzeit)
    const w = deliveryWindow(new Date("2026-10-16T22:30:00Z"));
    expect(formatGermanDate(w.orderDate)).toBe("Sa., 17.10.2026");
  });
  it("zeigt beim Jahreswechsel beide Jahre", () => {
    const w = deliveryWindow(new Date("2026-12-28T10:00:00Z"));
    expect(formatDeliveryWindow(w)).toBe("Do., 31.12.2026 bis Mo., 04.01.2027");
  });
  it("addBusinessDays überspringt Samstag und Sonntag", () => {
    const friday = new Date(Date.UTC(2026, 9, 16));
    expect(addBusinessDays(friday, 1).getUTCDate()).toBe(19);
  });
});

const rate: ShippingRateRule = {
  id: "rate-de",
  name: "DHL Paket",
  priceCents: 490,
  freeAboveSubtotalCents: 5000,
  minSubtotalCents: 0,
  minWeightGrams: 0,
  taxRateBp: 1900,
  deliveryTimeText: "3–5 Werktage",
};

function can(overrides: Partial<CheckoutRawLine> = {}): CheckoutRawLine {
  return {
    cartItemId: "ci-1",
    variantId: "v-wb-9",
    productId: "p-wb",
    productHandle: "wildberry",
    productKind: "simple",
    productTitle: "Wildberry",
    productSubtitle: null,
    variantTitle: "9 Dosen",
    sku: "PV-WB-09",
    unitCount: 9,
    quantity: 1,
    priceCents: 2610,
    depositCentsPerUnit: 25,
    depositCentsPerCan: 25,
    depositCansPerItem: 9,
    netContentPerUnit: 0.33,
    basePriceMeasure: "l",
    taxClass: "standard",
    taxRateBp: 1900,
    weightGrams: 400,
    imageUrl: "/images/cans/wildberry.webp",
    components: null,
    ...overrides,
  };
}

const bundle = can({
  cartItemId: "ci-2",
  variantId: "v-fb1",
  productId: "p-fb1",
  productHandle: "founder-bundle-i",
  productKind: "bundle",
  productTitle: "Founder Bundle I",
  productSubtitle: "2 Dosen je Sorte und Trinkbecher",
  variantTitle: "Standard",
  sku: "PV-FB1",
  unitCount: 1,
  priceCents: 3580,
  depositCentsPerUnit: 150,
  depositCentsPerCan: 25,
  depositCansPerItem: 6,
  netContentPerUnit: null,
  basePriceMeasure: "piece",
  imageUrl: "/images/bundle-1.jpg",
  components: [
    { variant_id: "v-wb-1", sku: "PV-WB-01", title: "Wildberry, 1 Dose", quantity: 2 },
    { variant_id: "v-cup", sku: "PV-CUP", title: "Clear Cup", quantity: 1 },
  ],
});

describe("Warenkorb zu Bestellpositionen", () => {
  it("rechnet das Figma-Beispiel: Wildberry 9er plus Founder Bundle I", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [can(), bundle],
      discount: null,
      shippingRates: [rate],
      depositTaxRateBp: 1900,
      now: new Date("2026-10-17T12:00:00Z"),
    });
    expect(snapshot.subtotalCents).toBe(5815); // 23,85 + 34,30 ohne Pfand
    expect(snapshot.depositCents).toBe(375);
    expect(snapshot.depositCans).toBe(15);
    expect(depositLabel(snapshot).replace(/\s/g, " ")).toBe("Pfand (15 Dosen à 0,25 €)");
    expect(snapshot.shippingFree).toBe(true);
    expect(snapshot.shipping?.deliveryTimeText).toBe("3 bis 5 Werktage");
    expect(snapshot.totalCents).toBe(6190);
    expect(snapshot.taxCents).toBe(988); // inkl. 9,88 € MwSt.
    expect(snapshot.lines[0].displayTotalCents).toBe(2610);
    expect(snapshot.lines[0].basePriceText).toBe("8,03 € / l");
    expect(snapshot.lines[0].description).toBe("9 Dosen à 0,33 l");
    expect(snapshot.lines[1].description).toBe("2 Dosen je Sorte und Trinkbecher");
  });

  it("überführt den Snapshot in order_items mit Preis-Snapshot", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [can({ quantity: 2 }), bundle],
      discount: {
        id: "d-1",
        code: "PRESALE10",
        kind: "percentage",
        value: 1000,
        minSubtotalCents: 0,
        usageCount: 0,
        isActive: true,
      },
      shippingRates: [rate],
      depositTaxRateBp: 1900,
    });
    const items = buildOrderItems(snapshot, "order-1");
    expect(items).toMatchInlineSnapshot(`
      [
        {
          "base_price_text": "8,03 € / l",
          "components": null,
          "discount_cents": 477,
          "image_path": "/images/cans/wildberry.webp",
          "line_total_cents": 4743,
          "order_id": "order-1",
          "position": 0,
          "product_handle": "wildberry",
          "product_id": "p-wb",
          "product_title": "Wildberry",
          "quantity": 2,
          "sku": "PV-WB-09",
          "tax_class": "standard",
          "tax_rate_bp": 1900,
          "unit_count": 9,
          "unit_deposit_cents": 225,
          "unit_price_cents": 2385,
          "variant_id": "v-wb-9",
          "variant_title": "9 Dosen",
          "weight_grams": 800,
        },
        {
          "base_price_text": "34,30 € / Stück",
          "components": [
            {
              "quantity": 2,
              "sku": "PV-WB-01",
              "title": "Wildberry, 1 Dose",
              "variant_id": "v-wb-1",
            },
            {
              "quantity": 1,
              "sku": "PV-CUP",
              "title": "Clear Cup",
              "variant_id": "v-cup",
            },
          ],
          "discount_cents": 343,
          "image_path": "/images/bundle-1.jpg",
          "line_total_cents": 3237,
          "order_id": "order-1",
          "position": 1,
          "product_handle": "founder-bundle-i",
          "product_id": "p-fb1",
          "product_title": "Founder Bundle I",
          "quantity": 1,
          "sku": "PV-FB1",
          "tax_class": "standard",
          "tax_rate_bp": 1900,
          "unit_count": 1,
          "unit_deposit_cents": 150,
          "unit_price_cents": 3430,
          "variant_id": "v-fb1",
          "variant_title": "Standard",
          "weight_grams": 400,
        },
      ]
    `);
    expect(snapshot.discountCode).toBe("PRESALE10");
    expect(snapshot.discountCodeId).toBe("d-1");
    // Summe der Positionen plus Versand ergibt den Gesamtbetrag
    const lineSum = items.reduce((s, i) => s + i.line_total_cents, 0);
    expect(lineSum + snapshot.shippingCents).toBe(snapshot.totalCents);
    expect(orderTaxLines(snapshot)[0]).toEqual({
      rate_bp: 1900,
      taxable_cents: snapshot.totalCents,
      tax_cents: snapshot.taxCents,
    });
  });

  it("berechnet Versand unter der Grenze und ohne Rabatt-Code", () => {
    const { snapshot } = buildAmountsSnapshot({
      lines: [can()],
      discount: null,
      shippingRates: [rate],
      depositTaxRateBp: 1900,
    });
    expect(snapshot.shippingCents).toBe(490);
    expect(snapshot.totalCents).toBe(2610 + 490);
    expect(snapshot.amountToFreeShippingCents).toBe(5000 - 2385);
    expect(snapshot.discountCode).toBeNull();
  });

  it("weist abgelehnte Rabattcodes nicht als eingelöst aus", () => {
    const { snapshot, totals } = buildAmountsSnapshot({
      lines: [can()],
      discount: {
        id: "d-2",
        code: "AB100",
        kind: "fixed_amount",
        value: 500,
        minSubtotalCents: 10000,
        usageCount: 0,
        isActive: true,
      },
      shippingRates: [rate],
      depositTaxRateBp: 1900,
    });
    expect(totals.discountReason).toBe("min_subtotal_not_reached");
    expect(snapshot.discountCode).toBeNull();
    expect(snapshot.discountCents).toBe(0);
  });

  it("formuliert Lieferzeit und Positionstext ohne Gedankenstrich", () => {
    expect(normalizeDeliveryText("3–5 Werktage")).toBe("3 bis 5 Werktage");
    expect(normalizeDeliveryText(null)).toBe("3 bis 5 Werktage");
    expect(lineDescription(can({ unitCount: 24 }))).toBe("24 Dosen à 0,33 l");
  });
});

describe("Straße und Hausnummer", () => {
  it.each([
    ["Musterstraße 12", "Musterstraße", "12"],
    ["Musterstraße 12a", "Musterstraße", "12a"],
    ["Kurt-Viermetz-Straße 1a", "Kurt-Viermetz-Straße", "1a"],
    ["Am Bahnhof 3 b", "Am Bahnhof", "3b"],
    ["Hauptstr. 12-14", "Hauptstr.", "12-14"],
    ["Straße des 17. Juni 100", "Straße des 17. Juni", "100"],
  ])("%s", (input, street, number) => {
    expect(splitStreet(input)).toEqual({ street, houseNumber: number });
  });
  it("lässt Eingaben ohne Hausnummer unverändert", () => {
    expect(splitStreet("Packstation")).toEqual({ street: "Packstation", houseNumber: null });
  });
});

describe("Mock-Testkarten", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const base = { expiry: "12 / 30", cvc: "123" };

  it("4242 4242 4242 4242 ist erfolgreich", () => {
    expect(checkTestCard({ ...base, number: "4242 4242 4242 4242" }, now)).toEqual({
      ok: true,
      outcome: "succeeded",
      last4: "4242",
      brand: "Visa",
    });
  });
  it("4000 0000 0000 0002 wird abgelehnt", () => {
    const r = checkTestCard({ ...base, number: "4000000000000002" }, now);
    expect(r.ok && r.outcome).toBe("declined");
  });
  it("4000 0025 0000 3155 verlangt 3-D-Secure", () => {
    const r = checkTestCard({ ...base, number: "4000-0025-0000-3155" }, now);
    expect(r.ok && r.outcome).toBe("requires_action");
  });
  it("prüft Luhn, Ablaufdatum und CVC", () => {
    expect(luhnValid("4242424242424241")).toBe(false);
    expect(checkTestCard({ ...base, number: "4242 4242 4242 4241" }, now)).toMatchObject({
      ok: false,
      field: "cardNumber",
    });
    expect(
      checkTestCard({ number: "4242424242424242", expiry: "09/26", cvc: "123" }, now),
    ).toMatchObject({
      ok: false,
      field: "cardExpiry",
    });
    expect(
      checkTestCard({ number: "4242424242424242", expiry: "10/26", cvc: "1" }, now),
    ).toMatchObject({
      ok: false,
      field: "cardCvc",
    });
    expect(expiryValid("10/2026", now)).toBe(true);
    expect(expiryValid("13/30", now)).toBe(false);
  });
  it("lehnt gültige, aber fremde Kartennummern im Testmodus ab", () => {
    expect(checkTestCard({ ...base, number: "5555 5555 5555 4444" }, now)).toMatchObject({
      ok: false,
      field: "cardNumber",
    });
  });
});
