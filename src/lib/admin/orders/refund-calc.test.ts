import { describe, expect, it } from "vitest";
import {
  computeRefund,
  discountShare,
  refundedShippingFromItems,
  refundLineAmount,
  toStoredRefundItems,
  type RefundOrderState,
} from "./refund-calc";
import { capRestock, expandStock, readComponents, restockableByVariant } from "./stock";

// PV-10001 aus Figma: Wildberry 9er (26,10 € inkl. 2,25 € Pfand) + Founder Bundle I (35,80 €), Versand frei
const wildberry = {
  id: "item-wb",
  title: "Wildberry Eistee",
  quantity: 1,
  refundedQuantity: 0,
  unitPriceCents: 2385,
  unitDepositCents: 225,
  discountCents: 0,
};
const bundle = {
  id: "item-b1",
  title: "Founder Bundle I",
  quantity: 1,
  refundedQuantity: 0,
  unitPriceCents: 3430,
  unitDepositCents: 150,
  discountCents: 0,
};
const pv10001: RefundOrderState = {
  totalCents: 6190,
  shippingCents: 0,
  refundedCents: 0,
  refundedShippingCents: 0,
  items: [wildberry, bundle],
};

describe("Erstattungsbetrag aus Snapshots", () => {
  it("schlägt 26,10 € für eine Wildberry-Position vor (Figma)", () => {
    const r = computeRefund(pv10001, { lines: [{ orderItemId: "item-wb", quantity: 1 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountCents).toBe(2610);
    expect(r.value.lines[0]).toMatchObject({
      priceCents: 2385,
      depositCents: 225,
      discountCents: 0,
    });
    expect(r.value.isFull).toBe(false);
    expect(r.value.remainingAfterCents).toBe(3580);
  });

  it("erkennt die Vollerstattung", () => {
    const r = computeRefund(pv10001, {
      lines: [
        { orderItemId: "item-wb", quantity: 1 },
        { orderItemId: "item-b1", quantity: 1 },
      ],
    });
    expect(r.ok && r.value.amountCents === 6190 && r.value.isFull).toBe(true);
  });

  it("verteilt den Rabatt kumulativ ohne Rundungsverlust", () => {
    // 3 Stück à 10,00 € + 0,25 € Pfand, 1,00 € Rabatt auf die Position
    const item = {
      ...wildberry,
      quantity: 3,
      unitPriceCents: 1000,
      unitDepositCents: 25,
      discountCents: 100,
    };
    expect(discountShare(100, 3, 1)).toBe(33);
    expect(discountShare(100, 3, 2)).toBe(67);
    expect(discountShare(100, 3, 3)).toBe(100);
    const first = refundLineAmount(item, 1);
    const second = refundLineAmount({ ...item, refundedQuantity: 1 }, 1);
    const third = refundLineAmount({ ...item, refundedQuantity: 2 }, 1);
    expect([first.discountCents, second.discountCents, third.discountCents]).toEqual([33, 34, 33]);
    const sum = first.amountCents + second.amountCents + third.amountCents;
    expect(sum).toBe(3 * 1025 - 100);
  });

  it("begrenzt auf die noch offene Menge", () => {
    const state = { ...pv10001, items: [{ ...wildberry, quantity: 2, refundedQuantity: 1 }] };
    const r = computeRefund(state, { lines: [{ orderItemId: "item-wb", quantity: 2 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("höchstens 1 von 2");
  });

  it("lehnt fremde, doppelte und negative Positionen ab", () => {
    expect(computeRefund(pv10001, { lines: [{ orderItemId: "x", quantity: 1 }] }).ok).toBe(false);
    expect(
      computeRefund(pv10001, {
        lines: [
          { orderItemId: "item-wb", quantity: 1 },
          { orderItemId: "item-wb", quantity: 1 },
        ],
      }).ok,
    ).toBe(false);
    expect(computeRefund(pv10001, { lines: [{ orderItemId: "item-wb", quantity: -1 }] }).ok).toBe(
      false,
    );
    expect(computeRefund(pv10001, { lines: [] }).ok).toBe(false);
  });

  it("erstattet Versandkosten höchstens einmal", () => {
    const state = { ...pv10001, totalCents: 6680, shippingCents: 490 };
    const r = computeRefund(state, { lines: [], shippingCents: 490 });
    expect(r.ok && r.value.amountCents).toBe(490);
    const again = computeRefund(
      { ...state, refundedCents: 490, refundedShippingCents: 490 },
      { lines: [], shippingCents: 1 },
    );
    expect(again.ok).toBe(false);
  });

  it("erlaubt einen abweichenden Betrag bis zum erstattbaren Rest", () => {
    const r = computeRefund(pv10001, {
      lines: [{ orderItemId: "item-wb", quantity: 1 }],
      amountCents: 1000,
    });
    expect(r.ok && r.value.overridden && r.value.amountCents === 1000).toBe(true);
    const goodwill = computeRefund(pv10001, { lines: [], amountCents: 500 });
    expect(goodwill.ok && goodwill.value.amountCents).toBe(500);
    const tooMuch = computeRefund(
      { ...pv10001, refundedCents: 6000 },
      { lines: [], amountCents: 500 },
    );
    expect(tooMuch.ok).toBe(false);
    if (!tooMuch.ok) expect(tooMuch.error).toContain("1,90");
  });

  it("lehnt einen Vorschlag über dem Rest ab (nach Kulanzerstattung)", () => {
    const r = computeRefund(
      { ...pv10001, refundedCents: 4000 },
      { lines: [{ orderItemId: "item-wb", quantity: 1 }] },
    );
    expect(r.ok).toBe(false);
  });

  it("speichert Positionen und Versand in refunds.items", () => {
    const r = computeRefund(
      { ...pv10001, totalCents: 6680, shippingCents: 490 },
      {
        lines: [{ orderItemId: "item-wb", quantity: 1 }],
        shippingCents: 490,
      },
    );
    if (!r.ok) throw new Error(r.error);
    const stored = toStoredRefundItems(r.value);
    expect(stored).toHaveLength(2);
    expect(stored[1]).toEqual({ type: "shipping", amount_cents: 490 });
    expect(refundedShippingFromItems(stored)).toBe(490);
    expect(refundedShippingFromItems(null)).toBe(0);
    expect(refundedShippingFromItems([{ foo: 1 }])).toBe(0);
  });
});

describe("Bestandsrückbuchung", () => {
  it("löst Bundles in Komponenten auf wie reserve_stock", () => {
    const m = expandStock([
      { variantId: "wb9", components: null, quantity: 2 },
      {
        variantId: "bundle1",
        components: [
          { variant_id: "wb1", quantity: 2 },
          { variant_id: "cup", quantity: 1 },
        ],
        quantity: 3,
      },
      { variantId: "wb9", components: null, quantity: 1 },
      { variantId: null, components: null, quantity: 5 },
    ]);
    expect(Object.fromEntries(m)).toEqual({ wb9: 3, wb1: 6, cup: 3 });
  });

  it("bucht höchstens zurück, was als Abgang gebucht und noch nicht zurückgebucht ist", () => {
    const available = restockableByVariant([
      { variant_id: "wb9", delta: -3, reason: "sale" },
      { variant_id: "wb9", delta: 1, reason: "refund_restock" },
      { variant_id: "cup", delta: -1, reason: "sale" },
      { variant_id: "cup", delta: 2, reason: "correction" },
    ]);
    expect(available.get("wb9")).toBe(2);
    expect(available.get("cup")).toBe(0);
    const capped = capRestock(
      new Map([
        ["wb9", 3],
        ["cup", 1],
        ["x", 1],
      ]),
      available,
    );
    expect(capped.apply).toEqual([{ variantId: "wb9", quantity: 2 }]);
    expect(capped.skipped).toEqual([
      { variantId: "wb9", quantity: 1 },
      { variantId: "cup", quantity: 1 },
      { variantId: "x", quantity: 1 },
    ]);
  });

  it("liest den Komponenten-Snapshot tolerant", () => {
    expect(readComponents([{ variant_id: "a", quantity: 2, sku: "x", title: "t" }])).toEqual([
      { variant_id: "a", quantity: 2 },
    ]);
    expect(readComponents(null)).toBeNull();
    expect(readComponents([{ quantity: 2 }])).toBeNull();
  });
});
