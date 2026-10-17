import { describe, expect, it } from "vitest";
import {
  adjustErrorMessage,
  adjustInputSchema,
  canAdjustNegative,
  checkAdjustment,
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
  it("unbegrenzt wird null", () => {
    expect(displayAvailable(999999)).toBeNull();
    expect(displayAvailable(499999)).toBeNull();
    expect(displayAvailable(12)).toBe(12);
  });
  it("Fehlercodes der Datenbank", () => {
    expect(adjustErrorMessage('ERROR: NEGATIVE_STOCK {"on_hand":1}')).toContain("negativ");
    expect(adjustErrorMessage("BUNDLE_STOCK_DERIVED")).toContain("Bundles");
    expect(adjustErrorMessage("irgendwas")).toContain("fehlgeschlagen");
  });
});
