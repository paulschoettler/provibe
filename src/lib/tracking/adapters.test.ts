import { describe, expect, it } from "vitest";
import { toGoogle, toMeta, toTikTok } from "./adapters";
import {
  buildCartChangeEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildSearchEvent,
  buildSignUpEvent,
  buildViewItemEvent,
  buildViewItemListEvent,
} from "./builders";
import type { PublicTrackingConfig } from "./config";
import type { TrackingEvent } from "./schema";

const item = {
  variantId: "v-1",
  sku: "PV-WB-9",
  title: "Wildberry Eistee",
  variantTitle: "9 Dosen",
  goodsPriceCents: 2385,
};
const viewItem = { ...buildViewItemEvent(item), event_id: "view_item_1" };
const addToCart = {
  ...buildCartChangeEvent(
    "add_to_cart",
    {
      variantId: "v-1",
      productTitle: "Wildberry Eistee",
      variantTitle: "9 Dosen",
      unitPriceCents: 2385,
      quantity: 1,
    },
    2,
  ),
  event_id: "atc_1",
};
const checkoutSrc = {
  items: [
    {
      id: "PV-WB-9",
      title: "Wildberry Eistee",
      variant: "9 Dosen",
      unitPriceCents: 2385,
      quantity: 2,
    },
  ],
  valueCents: 4770,
  coupon: "PRESALE10",
};
const purchase = buildPurchaseEvent({
  id: "o-1",
  orderNumber: "PV-1001",
  items: [{ title: "Wildberry Eistee", description: "9 Dosen", unitPriceCents: 2385, quantity: 2 }],
  subtotalCents: 4770,
  discountCents: 477,
  discountCode: "PRESALE10",
  shippingCents: 0,
  taxCents: 685,
});
const pageView: TrackingEvent = {
  event: "page_view",
  event_id: "pv_1",
  page: {
    path: "/products/wildberry",
    location: "https://example.test/products/wildberry",
    title: "Wildberry",
  },
};

const config: PublicTrackingConfig = {
  meta: "1372318701489027",
  google: "AW-123456789",
  tiktok: "C1234567890ABCDEFGHI",
  googleAdsLabels: { purchase: "AbCdEf123" },
};

describe("Meta Pixel", () => {
  it("Standard-Events mit value, currency und content_ids", () => {
    expect(toMeta(pageView)).toEqual({ name: "PageView", params: {}, eventID: "pv_1" });
    expect(toMeta(viewItem)).toMatchObject({
      name: "ViewContent",
      eventID: "view_item_1",
      params: {
        content_ids: ["PV-WB-9"],
        content_type: "product",
        value: 23.85,
        currency: "EUR",
        content_name: "Wildberry Eistee",
      },
    });
    expect(toMeta(addToCart)?.params).toMatchObject({
      value: 47.7,
      num_items: 2,
      content_ids: ["v-1"],
    });
    expect(toMeta(buildCheckoutEvent("begin_checkout", "bc_1", checkoutSrc))?.name).toBe(
      "InitiateCheckout",
    );
    expect(
      toMeta(buildCheckoutEvent("add_payment_info", "api_1", checkoutSrc, { payment_type: "card" }))
        ?.name,
    ).toBe("AddPaymentInfo");
    expect(toMeta(purchase)).toMatchObject({
      name: "Purchase",
      eventID: "purchase_o-1",
      params: { value: 42.93, currency: "EUR", content_ids: ["Wildberry Eistee"] },
    });
  });

  it("Formulare und Suche", () => {
    expect(toMeta(buildSignUpEvent("su_1"))?.name).toBe("CompleteRegistration");
    expect(toMeta({ event: "generate_lead", event_id: "gl", lead_type: "partner" })?.name).toBe(
      "Lead",
    );
    expect(toMeta({ ...buildSearchEvent(" peach "), event_id: "s" })?.params).toEqual({
      search_string: "peach",
    });
  });

  it("Events ohne Meta-Entsprechung gehen nicht an Meta", () => {
    expect(toMeta(buildViewItemListEvent("all", "Alle", [item]))).toBeNull();
    expect(toMeta({ ...addToCart, event: "remove_from_cart" })).toBeNull();
    expect(
      toMeta(buildCheckoutEvent("add_shipping_info", "asi", checkoutSrc, { shipping_tier: "DHL" })),
    ).toBeNull();
  });
});

describe("Google Ads (gtag)", () => {
  it("GA4-Ereignisnamen mit E-Commerce-Daten", () => {
    expect(toGoogle(viewItem, config)).toEqual([["event", "view_item", viewItem.ecommerce]]);
    expect(toGoogle(pageView, config)).toEqual([
      [
        "event",
        "page_view",
        { page_location: "https://example.test/products/wildberry", page_title: "Wildberry" },
      ],
    ]);
    const list = buildViewItemListEvent("all", "Alle", [item, item]);
    expect(toGoogle(list, config)[0][2]).toMatchObject({
      item_list_id: "all",
      items: [{ index: 0 }, { index: 1 }],
    });
  });

  it("purchase zusätzlich als Ads-Conversion mit Label", () => {
    const calls = toGoogle(purchase, config);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([
      "event",
      "conversion",
      {
        send_to: "AW-123456789/AbCdEf123",
        value: 42.93,
        currency: "EUR",
        transaction_id: "PV-1001",
      },
    ]);
  });

  it("ohne Google-ID nichts", () => {
    expect(toGoogle(purchase, { ...config, google: null })).toEqual([]);
  });
});

describe("TikTok Pixel (ttq)", () => {
  it("page und Standard-Events", () => {
    expect(toTikTok(pageView)).toEqual({ kind: "page" });
    expect(toTikTok(viewItem)).toMatchObject({
      kind: "track",
      name: "ViewContent",
      eventId: "view_item_1",
      params: {
        value: 23.85,
        currency: "EUR",
        contents: [{ content_id: "PV-WB-9", content_type: "product", quantity: 1 }],
      },
    });
    expect(toTikTok(purchase)).toMatchObject({ name: "CompletePayment", params: { value: 42.93 } });
    expect(toTikTok(buildSignUpEvent("su"))).toMatchObject({ name: "CompleteRegistration" });
    expect(
      toTikTok({ event: "generate_lead", event_id: "gl", lead_type: "partner" }),
    ).toMatchObject({ name: "SubmitForm" });
  });

  it("view_cart und view_item_list gehen nicht an TikTok", () => {
    expect(toTikTok(buildViewItemListEvent("all", "Alle", [item]))).toBeNull();
    expect(toTikTok({ ...addToCart, event: "view_cart" })).toBeNull();
  });
});
