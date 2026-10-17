import { describe, expect, it } from "vitest";
import {
  automationConfigSchemas,
  decideAbandonedCart,
  decideReviewRequest,
  decideWelcome,
  delayLabel,
  parseAutomationConfig,
  sweepBucket,
} from "./rules";

const NOW = new Date("2026-10-17T12:00:00Z");
const consent = { status: "subscribed", confirmed_at: "2026-10-01T10:00:00Z" };

describe("Konfiguration", () => {
  it("erzwingt mindestens 24 Stunden und Werbeeinwilligung beim Warenkorbabbrecher", () => {
    expect(automationConfigSchemas.abandoned_cart.safeParse({ delay_hours: 2 }).success).toBe(
      false,
    );
    expect(
      automationConfigSchemas.abandoned_cart.safeParse({ requires_marketing_consent: false })
        .success,
    ).toBe(false);
    expect(
      automationConfigSchemas.review_request.safeParse({ requires_marketing_consent: false })
        .success,
    ).toBe(false);
  });
  it("fällt bei ungültigen gespeicherten Werten auf sichere Standards zurück", () => {
    expect(parseAutomationConfig("abandoned_cart", { delay_hours: 1 })).toEqual({
      delay_hours: 24,
      max_age_days: 7,
      requires_marketing_consent: true,
      template: "abandoned_cart",
    });
    expect(parseAutomationConfig("welcome", { delay_minutes: 5 }).delay_minutes).toBe(5);
  });
  it("beschreibt Verzögerungen", () => {
    expect(delayLabel("welcome", { delay_minutes: 0 })).toBe("sofort");
    expect(delayLabel("abandoned_cart", { delay_hours: 24 })).toBe("24 Stunden");
    expect(delayLabel("review_request", { delay_days: 7 })).toBe("7 Tage nach Zustellung");
  });
});

describe("decideWelcome", () => {
  it("sendet nur nach eigenem Double Opt-in", () => {
    expect(
      decideWelcome({
        enabled: true,
        alreadySent: false,
        contact: { ...consent, source: "footer" },
      }),
    ).toEqual({
      send: true,
    });
    expect(
      decideWelcome({
        enabled: true,
        alreadySent: false,
        contact: { ...consent, source: "import_shopify" },
      }).send,
    ).toBe(false);
    expect(
      decideWelcome({
        enabled: true,
        alreadySent: false,
        contact: { status: "pending", confirmed_at: null, source: "footer" },
      }).send,
    ).toBe(false);
    expect(
      decideWelcome({
        enabled: false,
        alreadySent: false,
        contact: { ...consent, source: "footer" },
      }).send,
    ).toBe(false);
  });
});

describe("decideAbandonedCart", () => {
  const config = parseAutomationConfig("abandoned_cart", {});
  const cart = {
    status: "active",
    email: "a@b.de",
    last_activity_at: "2026-10-16T10:00:00Z",
    abandoned_email_sent_at: null,
    converted_order_id: null,
    item_count: 2,
  };
  it("sendet nach 24 Stunden nur mit Werbeeinwilligung", () => {
    expect(decideAbandonedCart({ enabled: true, config, cart, consent, now: NOW })).toEqual({
      send: true,
    });
    expect(
      decideAbandonedCart({ enabled: true, config, cart, consent: null, now: NOW }),
    ).toMatchObject({
      send: false,
      reason: "Keine Werbeeinwilligung",
    });
  });
  it("sendet nicht vor 24 Stunden, nicht bei Bestellung, nicht doppelt, nicht zu alt", () => {
    expect(
      decideAbandonedCart({
        enabled: true,
        config,
        cart: { ...cart, last_activity_at: "2026-10-17T00:00:00Z" },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
    expect(
      decideAbandonedCart({
        enabled: true,
        config,
        cart: { ...cart, converted_order_id: "o1" },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
    expect(
      decideAbandonedCart({
        enabled: true,
        config,
        cart: { ...cart, abandoned_email_sent_at: "x" },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
    expect(
      decideAbandonedCart({
        enabled: true,
        config,
        cart: { ...cart, last_activity_at: "2026-10-01T00:00:00Z" },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
    expect(
      decideAbandonedCart({
        enabled: true,
        config,
        cart: { ...cart, item_count: 0 },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
  });
});

describe("decideReviewRequest", () => {
  const config = parseAutomationConfig("review_request", {});
  const order = {
    status: "delivered",
    delivered_at: "2026-10-09T10:00:00Z",
    review_request_sent_at: null,
    is_test: false,
  };
  it("sendet nach der Wartezeit nur mit Werbeeinwilligung (H20)", () => {
    expect(decideReviewRequest({ enabled: true, config, order, consent, now: NOW })).toEqual({
      send: true,
    });
    expect(
      decideReviewRequest({ enabled: true, config, order, consent: null, now: NOW }).send,
    ).toBe(false);
    expect(decideReviewRequest({ enabled: false, config, order, consent, now: NOW }).send).toBe(
      false,
    );
  });
  it("wartet bis zur Verzögerung und lässt Stornos aus", () => {
    expect(
      decideReviewRequest({
        enabled: true,
        config,
        order: { ...order, delivered_at: "2026-10-15T10:00:00Z" },
        consent,
        now: NOW,
      }),
    ).toEqual({ send: false, reason: "Noch zu früh", final: false });
    expect(
      decideReviewRequest({
        enabled: true,
        config,
        order: { ...order, status: "refunded" },
        consent,
        now: NOW,
      }).send,
    ).toBe(false);
  });
});

describe("sweepBucket", () => {
  it("rundet auf Viertelstunden", () => {
    expect(sweepBucket(new Date("2026-10-17T12:07:30Z"))).toEqual({
      key: "2026-10-17T12:00:00.000Z",
      next: "2026-10-17T12:15:00.000Z",
    });
  });
});
