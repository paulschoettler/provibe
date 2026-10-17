import { describe, expect, it } from "vitest";
import {
  adjustErrorMessage,
  adjustInputSchema,
  canAdjustNegative,
  checkAdjustment,
  componentsText,
  displayAvailable,
  stockStatus,
  thresholdSchema,
  type AdjustContext,
} from "./rules";

const ctx = (over: Partial<AdjustContext> = {}): AdjustContext => ({
  role: "fulfillment",
  onHand: 10,
  isBundle: false,
  trackInventory: true,
  ...over,
});

describe("Buchungsregeln", () => {
  it("Wareneingang positiv, Schwund negativ, Retoure positiv", () => {
    expect(checkAdjustment({ delta: 24, reason: "purchase" }, ctx())).toMatchObject({
      ok: true,
      newOnHand: 34,
    });
    expect(checkAdjustment({ delta: -24, reason: "purchase" }, ctx()).ok).toBe(false);
    expect(checkAdjustment({ delta: -2, reason: "damaged" }, ctx())).toMatchObject({
      ok: true,
      newOnHand: 8,
    });
    expect(checkAdjustment({ delta: 2, reason: "damaged" }, ctx()).ok).toBe(false);
    expect(checkAdjustment({ delta: 1, reason: "refund_restock" }, ctx()).ok).toBe(true);
    expect(checkAdjustment({ delta: -1, reason: "refund_restock" }, ctx()).ok).toBe(false);
  });

  it("negativer Bestand nur mit Korrektur und Owner/Admin", () => {
    expect(
      checkAdjustment({ delta: -11, reason: "correction" }, ctx({ role: "fulfillment" })).ok,
    ).toBe(false);
    expect(checkAdjustment({ delta: -11, reason: "damaged" }, ctx({ role: "owner" })).ok).toBe(
      false,
    );
    const r = checkAdjustment({ delta: -11, reason: "correction" }, ctx({ role: "admin" }));
    expect(r).toMatchObject({ ok: true, allowNegative: true, newOnHand: -1 });
    expect(checkAdjustment({ delta: -11, reason: "correction" }, ctx({ role: "owner" })).ok).toBe(
      true,
    );
    expect(checkAdjustment({ delta: -10, reason: "correction" }, ctx())).toMatchObject({
      ok: true,
      allowNegative: false,
      newOnHand: 0,
    });
    expect(canAdjustNegative("support")).toBe(false);
  });

  it("Bundles haben keinen eigenen Bestand", () => {
    expect(checkAdjustment({ delta: 5, reason: "purchase" }, ctx({ isBundle: true })).ok).toBe(
      false,
    );
  });

  it("Packs haben keinen eigenen Bestand (H24), gebucht wird die Dose", () => {
    const r = checkAdjustment({ delta: 24, reason: "purchase" }, ctx({ isPack: true }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("Dosen");
  });

  it("ohne Bestandsführung erlaubt, mit Hinweis", () => {
    const r = checkAdjustment({ delta: 5, reason: "purchase" }, ctx({ trackInventory: false }));
    expect(r.ok && r.warnings.length).toBe(1);
  });
});

describe("Eingaben", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  it("Korrektur braucht eine Notiz, 0 ist keine Änderung", () => {
    expect(
      adjustInputSchema.safeParse({ variantId: id, delta: -2, reason: "correction" }).success,
    ).toBe(false);
    expect(
      adjustInputSchema.safeParse({
        variantId: id,
        delta: -2,
        reason: "correction",
        note: "Inventur",
      }).success,
    ).toBe(true);
    expect(
      adjustInputSchema.safeParse({ variantId: id, delta: 0, reason: "purchase" }).success,
    ).toBe(false);
    expect(
      adjustInputSchema.safeParse({ variantId: id, delta: 1.5, reason: "purchase" }).success,
    ).toBe(false);
    expect(adjustInputSchema.safeParse({ variantId: id, delta: 1, reason: "sale" }).success).toBe(
      false,
    );
  });
  it("Warnschwelle", () => {
    expect(thresholdSchema.safeParse(10).success).toBe(true);
    expect(thresholdSchema.safeParse(-1).success).toBe(false);
  });
});

describe("Status", () => {
  const row = {
    kind: "simple" as const,
    trackInventory: true,
    allowBackorder: false,
    available: 20,
    lowStockThreshold: 10,
  };
  it("ok, niedrig, ausverkauft, nicht geführt, Nachbestellung", () => {
    expect(stockStatus(row)).toBe("ok");
    expect(stockStatus({ ...row, available: 10 })).toBe("low");
    expect(stockStatus({ ...row, available: 0 })).toBe("out");
    expect(stockStatus({ ...row, trackInventory: false, available: 999999 })).toBe("untracked");
    expect(stockStatus({ ...row, allowBackorder: true, available: 999999 })).toBe("backorder");
  });
  it("Bundles aus Komponenten", () => {
    expect(stockStatus({ ...row, kind: "bundle", available: 499999 })).toBe("bundle");
    expect(stockStatus({ ...row, kind: "bundle", available: 0 })).toBe("out");
    expect(stockStatus({ ...row, kind: "bundle", available: 3 })).toBe("low");
  });
  it("Packs aus Dosen: ausverkauft oder abgeleitet, Warnschwelle gilt an der Dose", () => {
    expect(stockStatus({ ...row, role: "pack", available: 999999 })).toBe("pack");
    expect(stockStatus({ ...row, role: "pack", available: 3 })).toBe("pack");
    expect(stockStatus({ ...row, role: "pack", available: 0 })).toBe("out");
    expect(stockStatus({ ...row, role: "unit", available: 40, lowStockThreshold: 48 })).toBe("low");
  });
  it("unbegrenzt wird null", () => {
    expect(displayAvailable(999999)).toBeNull();
    expect(displayAvailable(499999)).toBeNull();
    expect(displayAvailable(12)).toBe(12);
  });
  it("Fehlercodes der Datenbank", () => {
    expect(adjustErrorMessage('ERROR: NEGATIVE_STOCK {"on_hand":1}')).toContain("negativ");
    expect(adjustErrorMessage("BUNDLE_STOCK_DERIVED")).toContain("Bundles");
    expect(adjustErrorMessage("PACK_STOCK_DERIVED")).toContain("Dosen");
    expect(adjustErrorMessage("irgendwas")).toContain("fehlgeschlagen");
  });
});

describe("Zusammensetzung aus Lagereinheiten (H24)", () => {
  const can = (title: string, quantity: number) => ({
    variantId: title,
    sku: null,
    productTitle: `${title} Eistee`,
    variantTitle: "1 Dose (Bundle-Komponente)",
    quantity,
  });
  it("Sorten-Pack, Mixed und Founder Bundle", () => {
    expect(componentsText([can("Wildberry", 9)])).toBe("9 Dosen Wildberry");
    expect(componentsText([can("Wildberry", 4), can("Raspberry Lime", 4), can("Peach", 4)])).toBe(
      "je 4 Dosen Wildberry, Raspberry Lime und Peach",
    );
    expect(
      componentsText([
        can("Peach", 2),
        can("Wildberry", 2),
        can("Raspberry Lime", 2),
        {
          variantId: "cup",
          sku: "PV-CUP",
          productTitle: "provibe Clear Cup",
          variantTitle: "Standard",
          quantity: 1,
        },
      ]),
    ).toBe("je 2 Dosen Peach, Wildberry und Raspberry Lime + 1 × provibe Clear Cup");
    expect(componentsText([])).toBe("");
  });
});
