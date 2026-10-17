import { describe, expect, it } from "vitest";
import { berlinLocalToIso, isoToBerlinLocal, parseDiscountForm } from "./form";
import { CODE_RE, generateDiscountCode } from "./rules";

describe("Zeit in Berlin", () => {
  it("Winter- und Sommerzeit", () => {
    expect(berlinLocalToIso("2026-12-24T18:00")).toBe("2026-12-24T17:00:00.000Z");
    expect(berlinLocalToIso("2026-07-01T00:00")).toBe("2026-06-30T22:00:00.000Z");
    expect(berlinLocalToIso("")).toBeNull();
    expect(berlinLocalToIso("24.12.2026")).toBeUndefined();
  });
  it("Rundreise", () => {
    expect(isoToBerlinLocal("2026-06-30T22:00:00.000Z")).toBe("2026-07-01T00:00");
    expect(isoToBerlinLocal(null)).toBe("");
  });
});

describe("Codes", () => {
  it("erzeugt gültige, zufällige Codes", () => {
    const a = generateDiscountCode();
    const b = generateDiscountCode();
    expect(a).toMatch(/^PV-[A-Z0-9]{8}$/);
    expect(CODE_RE.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("Rabattformular", () => {
  it("Prozent, Mindestwert, Limits und Produkte", () => {
    const r = parseDiscountForm({
      code: "sommer 10",
      kind: "percentage",
      valuePercent: "10,5",
      minSubtotal: "30",
      startsAt: "2026-12-01T00:00",
      endsAt: "",
      usageLimit: "100",
      usageLimitPerCustomer: "1",
      scope: "products",
      productIds: ["11111111-1111-4111-8111-111111111111"],
      combinable: "on",
      isActive: "on",
    });
    expect(r.errors).toEqual({});
    expect(r.discount).toMatchObject({
      code: "sommer 10",
      value: 1050,
      minSubtotalCents: 3000,
      startsAt: "2026-11-30T23:00:00.000Z",
      endsAt: null,
      usageLimit: 100,
      usageLimitPerCustomer: 1,
      appliesTo: { scope: "products", ids: ["11111111-1111-4111-8111-111111111111"] },
      combinable: true,
      isActive: true,
    });
  });
  it("leerer Code wird erzeugt, Betrag in Cent", () => {
    const r = parseDiscountForm({
      code: "",
      kind: "fixed_amount",
      valueAmount: "5",
      scope: "order",
    });
    expect(r.generated).toBe(true);
    expect(r.discount.value).toBe(500);
    expect(r.discount.isActive).toBe(false);
  });
  it("meldet Fehler am Feld", () => {
    const r = parseDiscountForm({
      code: "X1X",
      kind: "percentage",
      valuePercent: "150",
      usageLimit: "1,5",
    });
    expect(r.errors.valuePercent).toBeTruthy();
    expect(r.errors.usageLimit).toBeTruthy();
  });
});
