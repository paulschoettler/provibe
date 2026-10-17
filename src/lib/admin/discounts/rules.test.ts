import { describe, expect, it } from "vitest";
import { validateDiscount } from "@/lib/pricing";
import {
  describeDiscount,
  discountInputSchema,
  discountStatus,
  maskEmail,
  normalizeCode,
  parseAppliesTo,
  parseEuroToCents,
  parsePercentToBasisPoints,
  previewDiscount,
  toPricingRule,
  type DiscountRowLike,
} from "./rules";

const row = (over: Partial<DiscountRowLike> = {}): DiscountRowLike => ({
  code: "PRESALE10",
  kind: "percentage",
  value: 1000,
  min_subtotal_cents: 0,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
  usage_limit_per_customer: null,
  usage_count: 0,
  is_active: true,
  ...over,
});

describe("Eingaben", () => {
  it("normalisiert Codes", () => {
    expect(normalizeCode("  presale 10 ")).toBe("PRESALE10");
    expect(discountInputSchema.safeParse({ code: "ab", kind: "free_shipping" }).success).toBe(
      false,
    );
    expect(discountInputSchema.safeParse({ code: "SOMMER!", kind: "free_shipping" }).success).toBe(
      false,
    );
  });
  it("parst Prozent und Euro", () => {
    expect(parsePercentToBasisPoints("10")).toBe(1000);
    expect(parsePercentToBasisPoints("10,5 %")).toBe(1050);
    expect(parsePercentToBasisPoints("0")).toBeNull();
    expect(parsePercentToBasisPoints("101")).toBeNull();
    expect(parseEuroToCents("12")).toBe(1200);
    expect(parseEuroToCents("12,5")).toBe(1250);
    expect(parseEuroToCents("1.234,50 €")).toBe(123450);
    expect(parseEuroToCents("12.50")).toBe(1250);
    expect(parseEuroToCents("abc")).toBeNull();
  });
  it("prüft Wert je Art, Zeitraum und Limits", () => {
    const base = { code: "TEST10" };
    expect(discountInputSchema.safeParse({ ...base, kind: "percentage", value: 0 }).success).toBe(
      false,
    );
    expect(
      discountInputSchema.safeParse({ ...base, kind: "percentage", value: 10001 }).success,
    ).toBe(false);
    expect(discountInputSchema.safeParse({ ...base, kind: "fixed_amount", value: 0 }).success).toBe(
      false,
    );
    const fs = discountInputSchema.parse({ ...base, kind: "free_shipping", value: 500 });
    expect(fs.value).toBe(0);
    expect(
      discountInputSchema.safeParse({
        ...base,
        kind: "percentage",
        value: 1000,
        startsAt: "2026-11-01T00:00:00Z",
        endsAt: "2026-10-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      discountInputSchema.safeParse({
        ...base,
        kind: "percentage",
        value: 1000,
        usageLimit: 5,
        usageLimitPerCustomer: 6,
      }).success,
    ).toBe(false);
    expect(
      discountInputSchema.safeParse({
        ...base,
        kind: "free_shipping",
        appliesTo: { scope: "products", ids: ["11111111-1111-1111-1111-111111111111"] },
      }).success,
    ).toBe(false);
    const ok = discountInputSchema.parse({
      ...base,
      kind: "fixed_amount",
      value: 500,
      startsAt: "",
      usageLimit: "",
      minSubtotalCents: 3000,
    });
    expect(ok).toMatchObject({
      code: "TEST10",
      startsAt: null,
      usageLimit: null,
      appliesTo: { scope: "order" },
    });
  });
  it("applies_to aus der Datenbank", () => {
    expect(parseAppliesTo({ scope: "order" })).toEqual({ scope: "order" });
    expect(parseAppliesTo({ scope: "products", ids: [] })).toEqual({ scope: "order" });
    expect(parseAppliesTo(null)).toEqual({ scope: "order" });
  });
});

describe("Gleiche Regeln wie die Kasse", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("Status aus validateDiscount", () => {
    expect(discountStatus(row(), now)).toBe("active");
    expect(discountStatus(row({ is_active: false }), now)).toBe("inactive");
    expect(discountStatus(row({ starts_at: "2026-11-01T00:00:00Z" }), now)).toBe("scheduled");
    expect(discountStatus(row({ ends_at: "2026-10-01T00:00:00Z" }), now)).toBe("expired");
    expect(discountStatus(row({ usage_limit: 5, usage_count: 5 }), now)).toBe("exhausted");
    // Mindestbestellwert ist kein Status
    expect(discountStatus(row({ min_subtotal_cents: 5000 }), now)).toBe("active");
  });
  it("toPricingRule entspricht der Abbildung im Checkout", () => {
    const rule = toPricingRule(row({ usage_limit_per_customer: 1 }), { customerUsageCount: 1 });
    expect(validateDiscount(rule, 5000, now)).toBe("customer_limit_reached");
  });
  it("Vorschau rechnet wie evaluateDiscount", () => {
    const rule = toPricingRule(row());
    expect(previewDiscount(rule, { subtotalCents: 2610 }, now)).toMatchObject({
      ok: true,
      discountCents: 261,
    });
    const fixed = toPricingRule(row({ kind: "fixed_amount", value: 5000 }));
    expect(previewDiscount(fixed, { subtotalCents: 2610 }, now).discountCents).toBe(2610);
    const min = toPricingRule(row({ min_subtotal_cents: 5000 }));
    expect(previewDiscount(min, { subtotalCents: 2610 }, now)).toMatchObject({
      ok: false,
      reason: "min_subtotal_not_reached",
    });
    const ship = toPricingRule(row({ kind: "free_shipping", value: 0 }));
    expect(previewDiscount(ship, { subtotalCents: 2610 }, now)).toMatchObject({
      ok: true,
      freeShipping: true,
    });
  });
  it("Produktbindung", () => {
    const rule = toPricingRule(row(), { productIds: ["p1"] });
    const lines = [
      {
        variantId: "v1",
        productId: "p1",
        quantity: 1,
        unitPriceCents: 2000,
        unitDepositCents: 0,
        taxRateBp: 1900,
        weightGrams: 0,
      },
      {
        variantId: "v2",
        productId: "p2",
        quantity: 1,
        unitPriceCents: 3000,
        unitDepositCents: 0,
        taxRateBp: 1900,
        weightGrams: 0,
      },
    ];
    expect(previewDiscount(rule, { subtotalCents: 5000, lines }, now).perLineCents).toEqual([
      200, 0,
    ]);
  });
});

describe("Anzeige", () => {
  it("beschreibt Rabatte", () => {
    expect(describeDiscount(row())).toBe("10 %");
    expect(
      describeDiscount(row({ kind: "fixed_amount", value: 500, min_subtotal_cents: 3000 })),
    ).toBe("5,00 € ab 30,00 €");
    expect(describeDiscount(row({ kind: "free_shipping", value: 0 }))).toBe("Versandkostenfrei");
  });
  it("maskiert E-Mails", () => {
    expect(maskEmail("mail@paulschoettler.de")).toBe("ma***@paulschoettler.de");
  });
});
