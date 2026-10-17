import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadTable } from "../lib/csv";
import {
  buildVariantIndex,
  groupOrderRows,
  importedOrderNumber,
  mapPaymentMethod,
  mapStatuses,
  matchVariant,
  parseOrderGroup,
  planOrder,
  splitDeposit,
  type CatalogVariant,
  type ParsedOrder,
} from "../map/orders";

const NOW = new Date("2026-10-17T12:00:00Z");

/** Ausschnitt des Katalogs wie in der Datenbank (Seed aus dem Shopify-Snapshot). */
function variant(
  partial: Partial<CatalogVariant> & Pick<CatalogVariant, "id" | "sku" | "names">,
): CatalogVariant {
  return {
    productId: `p-${partial.id}`,
    handle: "wildberry",
    productTitle: "Wildberry Eistee",
    variantTitle: "9 Dosen",
    legacySku: null,
    unitCount: 9,
    weightGrams: 3400,
    taxClass: "standard",
    netContentPerUnit: 0.33,
    basePriceMeasure: "l",
    depositCentsPerUnit: 25,
    shopifyVariantId: null,
    components: null,
    ...partial,
  };
}

const CATALOG: CatalogVariant[] = [
  variant({
    id: "wb9",
    sku: "PV-WB-09",
    legacySku: "WILDBERRY-1",
    names: ["Wildberry Eistee - 9"],
  }),
  variant({
    id: "wb48",
    sku: "PV-WB-48",
    legacySku: "WILDBERRY-6",
    unitCount: 48,
    variantTitle: "48 Dosen",
    names: ["Wildberry Eistee - 48"],
  }),
  variant({
    id: "pe12",
    sku: "PV-PE-12",
    handle: "peach",
    productTitle: "Peach Eistee",
    variantTitle: "12 Dosen",
    unitCount: 12,
    names: ["Peach Eistee - 12"],
  }),
  variant({
    id: "rl24",
    sku: "PV-RL-24",
    handle: "raspberry-lime",
    productTitle: "Raspberry-Lime Eistee",
    variantTitle: "24 Dosen",
    unitCount: 24,
    names: ["Raspberry-Lime Eistee - 24"],
  }),
  variant({
    id: "fb2m",
    sku: "PV-FB2-M",
    handle: "founder-bundle-ii",
    productTitle: "Founder Bundle II",
    variantTitle: "M",
    unitCount: 1,
    netContentPerUnit: null,
    basePriceMeasure: "piece",
    depositCentsPerUnit: 150, // 6 Dosen × 25 Cent aus den Komponenten (H1)
    components: [{ variant_id: "x", sku: "PV-SHIRT-M", title: "provibe shirt, M", quantity: 1 }],
    names: ["Founder Bundle ll - M"],
  }),
  variant({
    id: "cup",
    sku: "PV-CUP",
    handle: "provibe-clear-cup",
    productTitle: "provibe clear cup",
    variantTitle: "Standard",
    unitCount: 1,
    depositCentsPerUnit: 0,
    netContentPerUnit: null,
    basePriceMeasure: "piece",
    names: ["provibe clear cup"],
  }),
];
const INDEX = buildVariantIndex(CATALOG);

function fixtureOrders(): ParsedOrder[] {
  const table = loadTable(path.join(import.meta.dirname, "..", "fixtures", "orders.csv")).table;
  const { groups, orphans } = groupOrderRows(table.rows);
  expect(orphans).toEqual([]);
  return groups.map((g) => {
    const r = parseOrderGroup(g);
    if (!r.ok) throw new Error(r.reason);
    return r.value;
  });
}

describe("Pfandrechnung", () => {
  it("rechnet unit_count × Pfand je Dose aus dem Shopify-Preis heraus", () => {
    expect(splitDeposit(2610, { depositCentsPerUnit: 25, unitCount: 9 })).toEqual({
      unitPriceCents: 2385,
      unitDepositCents: 225,
    });
    expect(splitDeposit(13200, { depositCentsPerUnit: 25, unitCount: 48 })).toEqual({
      unitPriceCents: 12000,
      unitDepositCents: 1200,
    });
  });

  it("nimmt bei Bundles das Pfand der Komponenten", () => {
    expect(splitDeposit(4580, { depositCentsPerUnit: 150, unitCount: 1 })).toEqual({
      unitPriceCents: 4430,
      unitDepositCents: 150,
    });
  });

  it("freie Positionen und Produkte ohne Pfand bleiben unverändert", () => {
    expect(splitDeposit(200, null)).toEqual({ unitPriceCents: 200, unitDepositCents: 0 });
    expect(splitDeposit(1990, { depositCentsPerUnit: 0, unitCount: 1 })).toEqual({
      unitPriceCents: 1990,
      unitDepositCents: 0,
    });
  });

  it("Pfand nie höher als der Preis (z.B. Gratisartikel)", () => {
    expect(splitDeposit(0, { depositCentsPerUnit: 25, unitCount: 9 })).toEqual({
      unitPriceCents: 0,
      unitDepositCents: 0,
    });
  });
});

describe("Status-Mapping", () => {
  const base = { cancelledAt: null, fulfilledAt: null, now: NOW };
  it.each([
    ["paid", "fulfilled", "2026-05-12T07:15:00Z", "delivered", "paid", "fulfilled"],
    ["paid", "fulfilled", "2026-10-14T14:30:00Z", "shipped", "paid", "fulfilled"],
    ["paid", "unfulfilled", null, "paid", "paid", "unfulfilled"],
    ["paid", "", null, "paid", "paid", "unfulfilled"],
    ["paid", "partial", null, "processing", "paid", "partial"],
    ["refunded", "fulfilled", "2026-05-12T07:15:00Z", "refunded", "refunded", "fulfilled"],
    [
      "partially_refunded",
      "fulfilled",
      null,
      "partially_refunded",
      "partially_refunded",
      "fulfilled",
    ],
    ["pending", "unfulfilled", null, "pending", "unpaid", "unfulfilled"],
    ["authorized", "unfulfilled", null, "pending", "authorized", "unfulfilled"],
    ["expired", "unfulfilled", null, "pending", "failed", "unfulfilled"],
  ])("%s / %s → %s", (fin, ful, fulfilledAt, status, payment, fulfillment) => {
    const r = mapStatuses({ ...base, financialStatus: fin, fulfillmentStatus: ful, fulfilledAt });
    expect([r.status, r.paymentStatus, r.fulfillmentStatus]).toEqual([
      status,
      payment,
      fulfillment,
    ]);
  });

  it("storniert schlägt alles", () => {
    const r = mapStatuses({
      ...base,
      financialStatus: "voided",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: "2026-08-01T10:00:00Z",
    });
    expect([r.status, r.paymentStatus]).toEqual(["cancelled", "unpaid"]);
  });

  it("warnt bei unbekanntem Zahlungsstatus", () => {
    expect(
      mapStatuses({ ...base, financialStatus: "seltsam", fulfillmentStatus: "" }).warning,
    ).toMatch(/unbekannt/);
  });
});

describe("Bestellungen aus dem Export", () => {
  const orders = fixtureOrders();

  it("aggregiert Positionszeilen zur Bestellung", () => {
    expect(orders.map((o) => [o.name, o.lines.length])).toEqual([
      ["#1001", 2],
      ["#1002", 1],
      ["#1003", 2],
      ["#1004", 1],
    ]);
    const o = orders[0];
    expect(o).toMatchObject({
      shopifyOrderId: "6100000000001",
      email: "erika.mustermann@example.com",
      createdAt: "2026-05-10T12:03:15.000Z",
      totalCents: 5463,
      discountCode: "PRESALE10",
      discountAmountCents: 607,
      taxes: [{ name: "DE MwSt 19%", rateBp: 1900, cents: 872 }],
    });
    expect(o.shipping).toMatchObject({
      first_name: "Erika",
      last_name: "Mustermann",
      street: "Musterstraße",
      house_number: "12a",
      address_addition: "2. OG",
      country_code: "DE",
    });
  });

  it("ordnet Varianten über Legacy-SKU und Namen zu", () => {
    expect(matchVariant({ sku: "WILDBERRY-1", name: "egal" }, INDEX)).toMatchObject({
      variant: { id: "wb9" },
      via: "sku",
    });
    expect(matchVariant({ sku: null, name: "Peach  Eistee – 12" }, INDEX)).toMatchObject({
      variant: { id: "pe12" },
      via: "name",
    });
    expect(matchVariant({ sku: "STICKER-1", name: "provibe Sticker" }, INDEX)).toBeNull();
  });

  it("verteilt den Bestellrabatt anteilig und rechnet das Pfand heraus (#1001)", () => {
    const plan = planOrder(orders[0], INDEX, NOW);
    expect(
      plan.items.map((i) => [
        i.sku,
        i.unit_price_cents,
        i.unit_deposit_cents,
        i.discount_cents,
        i.line_total_cents,
      ]),
    ).toEqual([
      ["PV-WB-09", 2385, 225, 261, 2349],
      ["PV-PE-12", 3160, 300, 346, 3114],
    ]);
    expect(plan).toMatchObject({
      orderNumber: "#1001",
      status: "delivered",
      paymentStatus: "paid",
      subtotalCents: 5545,
      depositCents: 525,
      discountCents: 607,
      totalCents: 5463,
      taxLines: [{ rate_bp: 1900, taxable_cents: 5463, tax_cents: 872 }],
      paymentMethodType: "card",
    });
    expect(plan.items[0].base_price_text).toBe("8,03 € / l");
    expect(plan.warnings).toEqual([]);
  });

  it("Bundle mit Komponenten-Pfand und Versand (#1002)", () => {
    const plan = planOrder(orders[1], INDEX, NOW);
    expect(plan.items[0]).toMatchObject({
      sku: "PV-FB2-M",
      unit_price_cents: 4430,
      unit_deposit_cents: 150,
      line_total_cents: 4580,
    });
    expect(plan.items[0].components).toHaveLength(1);
    expect(plan).toMatchObject({
      status: "paid",
      shippingCents: 490,
      totalCents: 5070,
      paymentMethodType: "paypal",
    });
  });

  it("freie Position ohne Variante mit Hinweis (#1003)", () => {
    const plan = planOrder(orders[2], INDEX, NOW);
    expect(plan.freeLines).toBe(1);
    expect(plan.items[1]).toMatchObject({
      variant_id: null,
      product_title: "provibe Sticker",
      sku: "STICKER-1",
      unit_deposit_cents: 0,
    });
    expect(plan.warnings.some((w) => w.includes("ohne passende Variante"))).toBe(true);
    expect(plan.status).toBe("partially_refunded");
    expect(orders[2].refundedCents).toBe(200);
  });

  it("stornierte Gastbestellung (#1004)", () => {
    const plan = planOrder(orders[3], INDEX, NOW);
    expect(plan).toMatchObject({
      status: "cancelled",
      paymentStatus: "unpaid",
      depositCents: 1200,
      subtotalCents: 12000,
    });
  });

  it("meldet Summenabweichungen, übernimmt aber das Shopify-Total", () => {
    const plan = planOrder({ ...orders[1], totalCents: 9999 }, INDEX, NOW);
    expect(plan.totalCents).toBe(9999);
    expect(plan.warnings.some((w) => w.startsWith("Summen weichen ab"))).toBe(true);
  });

  it("lehnt Bestellungen ohne E-Mail oder in Fremdwährung ab", () => {
    const g = {
      name: "#9",
      firstLine: 2,
      rows: [
        {
          line: 2,
          data: {
            Name: "#9",
            Email: "",
            Total: "1.00",
            "Created at": "2026-01-01",
            "Lineitem quantity": "1",
            "Lineitem name": "x",
            "Lineitem price": "1.00",
          },
        },
      ],
    };
    expect(parseOrderGroup(g)).toMatchObject({ ok: false });
    g.rows[0].data.Email = "a@example.com";
    (g.rows[0].data as Record<string, string>).Currency = "USD";
    expect(parseOrderGroup(g)).toMatchObject({ ok: false, reason: expect.stringMatching(/USD/) });
  });
});

describe("Nummern und Zahlungsarten", () => {
  it("bewahrt die Shopify-Nummer und berührt den eigenen Nummernkreis nicht", () => {
    expect(importedOrderNumber("#1042")).toBe("#1042");
    expect(importedOrderNumber("PV-10001")).toBe("SHOPIFY-PV-10001");
  });

  it("kürzt Zahlungsarten", () => {
    expect(mapPaymentMethod("Shopify Payments")).toBe("card");
    expect(mapPaymentMethod("PayPal Express Checkout")).toBe("paypal");
    expect(mapPaymentMethod("Klarna Pay Later")).toBe("klarna");
    expect(mapPaymentMethod("manual")).toBe("bank_transfer");
    expect(mapPaymentMethod(null)).toBeNull();
  });
});
