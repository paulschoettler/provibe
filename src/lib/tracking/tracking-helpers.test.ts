import { describe, expect, it } from "vitest";
import { buildCheckoutEvent, buildViewItemListEvent, buildBeginCheckoutFromCart } from "./builders";
import { resolveTrackingConfig } from "./config";
import { isSensitivePath, sanitizeLocation, sanitizePath } from "./paths";
import { decodeQueue, encodeQueue, QUEUE_MAX_CHARS } from "./queue";
import { buildSignUpEvent } from "./builders";

describe("Tracking-IDs aus shop_settings", () => {
  it("ohne Eintrag und ohne Env ist alles aus", () => {
    expect(resolveTrackingConfig(null)).toEqual({
      meta: null,
      google: null,
      tiktok: null,
      googleAdsLabels: {},
    });
    // Seed-Stand: leere IDs
    expect(
      resolveTrackingConfig({
        meta_pixel_id: "",
        ga4_measurement_id: "",
        google_ads_conversion_id: "",
        tiktok_pixel_id: "",
      }),
    ).toMatchObject({ meta: null, google: null, tiktok: null });
  });

  it("eingetragene IDs gelten, Schalter aus gewinnt", () => {
    const row = {
      meta_enabled: true,
      meta_pixel_id: "1372318701489027",
      google_enabled: true,
      google_ads_conversion_id: "aw-123456789",
      google_ads_labels: { purchase: "AbC_12", "x y": "nope", sign_up: "<script>" },
      tiktok_enabled: false,
      tiktok_pixel_id: "C1234567890ABCDEFGHI",
    };
    expect(resolveTrackingConfig(row)).toEqual({
      meta: "1372318701489027",
      google: "AW-123456789",
      tiktok: null,
      googleAdsLabels: { purchase: "AbC_12" },
    });
  });

  it("Schlüssel google_tag_id wird gelesen, GA4 (Statistik) nicht geladen", () => {
    expect(resolveTrackingConfig({ google_tag_id: "AW-987654321" }).google).toBe("AW-987654321");
    expect(resolveTrackingConfig({ google_tag_id: "G-ABCDEF1234" }).google).toBeNull();
    expect(
      resolveTrackingConfig({ ga4_measurement_id: "G-ABCDEF1234", google_enabled: true }).google,
    ).toBeNull();
  });

  it("Env nur als Rückfall, ungültige Formate nie", () => {
    const env = { NEXT_PUBLIC_META_PIXEL_ID: "1234567890", NEXT_PUBLIC_TIKTOK_PIXEL_ID: "bad id!" };
    expect(resolveTrackingConfig({}, env)).toMatchObject({ meta: "1234567890", tiktok: null });
    expect(resolveTrackingConfig({ meta_enabled: false }, env).meta).toBeNull();
    expect(resolveTrackingConfig({ meta_pixel_id: '123"><script>' }).meta).toBeNull();
  });
});

describe("Adressen ohne Tokens", () => {
  it("erkennt Seiten mit Zugangs-Token", () => {
    expect(isSensitivePath("/checkout/danke/7b8f0c1e-1d2a-4c3b-9e8f-1234567890ab")).toBe(true);
    expect(isSensitivePath("/newsletter/bestaetigen")).toBe(true);
    expect(isSensitivePath("/account/bestellungen/PV-1001")).toBe(true);
    expect(isSensitivePath("/checkout")).toBe(false);
    expect(isSensitivePath("/products/wildberry")).toBe(false);
    expect(isSensitivePath("/accounting")).toBe(false);
  });

  it("ersetzt Tokens im Pfad, behält Handles", () => {
    expect(sanitizePath("/checkout/danke/7b8f0c1e-1d2a-4c3b-9e8f-1234567890ab")).toBe(
      "/checkout/danke/:token",
    );
    expect(sanitizePath("/products/provibe-eistee-raspberry-lime")).toBe(
      "/products/provibe-eistee-raspberry-lime",
    );
    expect(sanitizePath("/x/a1b2c3d4e5f6a7b8c9d0e1f2")).toBe("/x/:token");
  });

  it("entfernt Suchparameter bis auf Kampagne und Klick-IDs", () => {
    expect(
      sanitizeLocation(
        "https://shop.test/newsletter/bestaetigen?token=abc&email=a%40b.de&utm_source=ig&fbclid=XY#top",
      ),
    ).toBe("https://shop.test/newsletter/bestaetigen?utm_source=ig&fbclid=XY");
    expect(sanitizeLocation("https://shop.test/search?q=peach")).toBe("https://shop.test/search");
    expect(sanitizeLocation("kein url")).toBe("");
  });
});

describe("Warteschlange pv_track_q", () => {
  const src = {
    items: [{ id: "PV-WB-9", title: "Wildberry", unitPriceCents: 2385, quantity: 1 }],
    valueCents: 2385,
  };

  it("nimmt nur Server-Events auf und dedupliziert über event_id", () => {
    const e1 = buildCheckoutEvent("add_shipping_info", "asi_1", src, {
      shipping_tier: "DHL Paket",
    });
    const json = encodeQueue([], e1)!;
    expect(decodeQueue(json)).toEqual([e1]);
    expect(decodeQueue(encodeURIComponent(json))).toEqual([e1]);
    expect(decodeQueue(encodeQueue([e1], e1))).toHaveLength(1);
    expect(encodeQueue([], buildViewItemListEvent("all", "Alle", []))).toBeNull();
  });

  it("hält höchstens drei Events und bleibt unter der Cookie-Grenze", () => {
    let queue = decodeQueue(null);
    for (let i = 0; i < 5; i++)
      queue = decodeQueue(encodeQueue(queue, buildSignUpEvent(`su_${i}`)));
    expect(queue.map((e) => e.event_id)).toEqual(["su_2", "su_3", "su_4"]);

    const many = {
      items: Array.from({ length: 40 }, (_, i) => ({
        id: `PV-SKU-${i}-${"x".repeat(30)}`,
        title: `Produkt mit sehr langem Namen ${i}`,
        unitPriceCents: 1000,
        quantity: 1,
      })),
      valueCents: 40000,
    };
    const big = encodeQueue(
      [],
      buildCheckoutEvent("add_payment_info", "api_1", many, { payment_type: "card" }),
    )!;
    expect(encodeURIComponent(big).length).toBeLessThanOrEqual(QUEUE_MAX_CHARS);
    expect(decodeQueue(big)[0].event_id).toBe("api_1");
  });

  it("verwirft Fremdes und Kaputtes", () => {
    expect(decodeQueue("kaputt")).toEqual([]);
    expect(
      decodeQueue(
        JSON.stringify([{ event: "purchase", event_id: "x", ecommerce: { value: 1, items: [] } }]),
      ),
    ).toEqual([]);
    expect(decodeQueue(JSON.stringify([{ event: "sign_up" }]))).toEqual([]);
    expect(decodeQueue(JSON.stringify({ event: "sign_up", event_id: "x" }))).toEqual([]);
  });
});

describe("begin_checkout im Browser", () => {
  it("nutzt dieselbe event_id wie der Server", () => {
    const e = buildBeginCheckoutFromCart("cart-1", [
      {
        variantId: "v-1",
        productTitle: "Peach",
        variantTitle: "9 Dosen",
        unitPriceCents: 2385,
        quantity: 2,
      },
    ]);
    expect(e.event_id).toBe("begin_checkout_cart-1");
    expect(e.ecommerce.value).toBe(47.7);
  });
});
