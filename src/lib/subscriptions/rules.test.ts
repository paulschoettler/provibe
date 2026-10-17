import { describe, expect, it } from "vitest";
import {
  effectiveVariantPrice,
  intervalLabel,
  isAllowedInterval,
  isSubscribable,
  normalizeSubscriptionNumber,
  parseSubscriptionSettings,
  resolveDiscountBp,
} from "./rules";
import { DEFAULT_SUBSCRIPTION_SETTINGS } from "./types";

const P = "11111111-1111-1111-1111-111111111111";
const V = "22222222-2222-2222-2222-222222222222";

describe("abonnierbare Varianten", () => {
  it("Sorten und Mixed 9 bis 48 Dosen, keine Bundles, kein Merch, keine Einzeldose", () => {
    expect(isSubscribable({ productKind: "simple", unitCount: 9, depositCentsPerUnit: 25 })).toBe(
      true,
    );
    expect(isSubscribable({ productKind: "simple", unitCount: 48, depositCentsPerUnit: 25 })).toBe(
      true,
    );
    expect(isSubscribable({ productKind: "bundle", unitCount: 9, depositCentsPerUnit: 25 })).toBe(
      false,
    );
    expect(isSubscribable({ productKind: "simple", unitCount: 1, depositCentsPerUnit: 0 })).toBe(
      false,
    );
    expect(isSubscribable({ productKind: "simple", unitCount: 1, depositCentsPerUnit: 25 })).toBe(
      false,
    );
    expect(
      isSubscribable({
        productKind: "simple",
        unitCount: 9,
        depositCentsPerUnit: 25,
        variantActive: false,
      }),
    ).toBe(false);
    expect(
      isSubscribable({
        productKind: "simple",
        unitCount: 9,
        depositCentsPerUnit: 25,
        productStatus: "draft",
      }),
    ).toBe(false);
  });
});

describe("Einstellungen", () => {
  it("ohne Zeilen gelten die Standardwerte", () => {
    expect(parseSubscriptionSettings({})).toEqual(DEFAULT_SUBSCRIPTION_SETTINGS);
  });
  it("liest die Werte aus shop_settings und normalisiert sie", () => {
    const s = parseSubscriptionSettings({
      subscription_discount_bp: 1500,
      subscription_product_discounts: {
        products: { [P]: 500 },
        variants: { [V]: 2000, "kein-uuid": 300 },
      },
      subscription_intervals: { weeks: [8, 2, 4, 4, 99], default: 6 },
      subscription_reminder_days: 5,
      subscription_retry_days: [7, 3],
      subscription_pause_max_days: 400,
    });
    expect(s.discountBp).toBe(1500);
    expect(s.productDiscounts.variants).toEqual({ [V]: 2000 });
    expect(s.intervals).toEqual([2, 4, 8]);
    expect(s.defaultInterval).toBe(4);
    expect(s.reminderDays).toBe(5);
    expect(s.retryDays).toEqual([3, 7]);
    expect(s.pauseMaxDays).toBe(183);
  });
  it("Rabatt: Variante vor Produkt vor Standard", () => {
    const s = parseSubscriptionSettings({
      subscription_product_discounts: { products: { [P]: 500 }, variants: { [V]: 2000 } },
    });
    expect(resolveDiscountBp(s, P, V)).toBe(2000);
    expect(resolveDiscountBp(s, P, "33333333-3333-3333-3333-333333333333")).toBe(500);
    expect(resolveDiscountBp(s, "44444444-4444-4444-4444-444444444444", "x")).toBe(1000);
  });
  it("Intervalle und Beschriftung", () => {
    expect(isAllowedInterval(DEFAULT_SUBSCRIPTION_SETTINGS, 4)).toBe(true);
    expect(isAllowedInterval(DEFAULT_SUBSCRIPTION_SETTINGS, 3)).toBe(false);
    expect(intervalLabel(4)).toBe("alle 4 Wochen");
  });
});

describe("Abo-Nummer (H25)", () => {
  it("normalisiert Eingaben", () => {
    expect(normalizeSubscriptionNumber("ABO-1001")).toBe("ABO-1001");
    expect(normalizeSubscriptionNumber("abo 1001")).toBe("ABO-1001");
    expect(normalizeSubscriptionNumber("1001")).toBe("ABO-1001");
    expect(normalizeSubscriptionNumber("12")).toBeNull();
  });
});

describe("Preisbindung bis zur Ankündigung", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("ohne Bindung gilt der Katalogpreis und wird gebunden", () => {
    expect(
      effectiveVariantPrice(
        2610,
        { locked_price_cents: null, price_change_effective_at: null },
        now,
      ),
    ).toMatchObject({ priceCents: 2610, newLockedPriceCents: 2610 });
  });
  it("Erhöhung ohne Ankündigung oder vor dem Stichtag: alter Preis", () => {
    expect(
      effectiveVariantPrice(
        2790,
        { locked_price_cents: 2610, price_change_effective_at: null },
        now,
      ),
    ).toMatchObject({ priceCents: 2610, pendingIncrease: true, newLockedPriceCents: null });
    expect(
      effectiveVariantPrice(
        2790,
        { locked_price_cents: 2610, price_change_effective_at: "2026-11-14T00:00:00Z" },
        now,
      ).priceCents,
    ).toBe(2610);
  });
  it("nach dem Stichtag gilt der neue Preis, die Ankündigung ist erledigt", () => {
    expect(
      effectiveVariantPrice(
        2790,
        { locked_price_cents: 2610, price_change_effective_at: "2026-10-01T00:00:00Z" },
        now,
      ),
    ).toMatchObject({ priceCents: 2790, newLockedPriceCents: 2790, clearNotice: true });
  });
  it("Senkungen gelten sofort", () => {
    expect(
      effectiveVariantPrice(
        2490,
        { locked_price_cents: 2610, price_change_effective_at: null },
        now,
      ),
    ).toMatchObject({ priceCents: 2490, newLockedPriceCents: 2490 });
  });
});
