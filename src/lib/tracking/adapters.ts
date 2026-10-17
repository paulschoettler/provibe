import type { PublicTrackingConfig } from "./config";
import { eventItems, eventValue, type TrackingEvent, type TrackingItem } from "./schema";

/**
 * Abbildung des einheitlichen Event-Schemas auf die Anbieter. Reine Funktionen: Sie liefern nur
 * die Aufrufe, das Senden übernimmt src/components/tracking/track.ts. null heißt: Dieses Event
 * geht an den Anbieter nicht.
 */

/* ---------- Meta Pixel (fbq) ---------- */

export interface MetaCall {
  name: string;
  params: Record<string, unknown>;
  /** Für die Deduplizierung mit der Conversions API (fbq(..., { eventID })) */
  eventID: string;
}

const META_NAMES: Partial<Record<TrackingEvent["event"], string>> = {
  page_view: "PageView",
  view_item: "ViewContent",
  search: "Search",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "Purchase",
  sign_up: "CompleteRegistration",
  generate_lead: "Lead",
};

function metaContents(items: TrackingItem[]) {
  return items.map((i) => ({ id: i.item_id, quantity: i.quantity, item_price: i.price }));
}

export function toMeta(event: TrackingEvent): MetaCall | null {
  const name = META_NAMES[event.event];
  if (!name) return null;
  const params: Record<string, unknown> = {};
  const items = eventItems(event);
  if (items.length) {
    params.content_ids = items.map((i) => i.item_id);
    params.content_type = "product";
    params.contents = metaContents(items);
    params.num_items = items.reduce((sum, i) => sum + i.quantity, 0);
  }
  const value = eventValue(event);
  if (value !== null) {
    params.value = value;
    params.currency = "EUR";
  }
  if (event.event === "view_item" && items[0]) params.content_name = items[0].item_name;
  if (event.event === "search") params.search_string = event.search_term;
  if (event.event === "sign_up") params.content_name = "Newsletter";
  if (event.event === "generate_lead") params.content_category = "Partneranfrage";
  return { name, params, eventID: event.event_id };
}

/* ---------- Google Ads (gtag, GA4-Ereignisnamen) ---------- */

export type GtagCall = ["event", string, Record<string, unknown>];

export function toGoogle(event: TrackingEvent, config: PublicTrackingConfig): GtagCall[] {
  if (!config.google) return [];
  const calls: GtagCall[] = [];
  if (event.event === "page_view") {
    calls.push([
      "event",
      "page_view",
      { page_location: event.page.location, page_title: event.page.title ?? "" },
    ]);
  } else if (event.event === "search") {
    calls.push(["event", "search", { search_term: event.search_term }]);
  } else if (event.event === "sign_up") {
    calls.push(["event", "sign_up", { method: event.method }]);
  } else if (event.event === "generate_lead") {
    calls.push(["event", "generate_lead", { lead_type: event.lead_type }]);
  } else {
    calls.push(["event", event.event, { ...event.ecommerce }]);
  }

  // Conversion-Label für dieses Event hinterlegt? Dann zusätzlich als Ads-Conversion senden.
  const label = config.googleAdsLabels[event.event];
  if (label) {
    const conversion: Record<string, unknown> = { send_to: `${config.google}/${label}` };
    const value = eventValue(event);
    if (value !== null) {
      conversion.value = value;
      conversion.currency = "EUR";
    }
    if (event.event === "purchase") conversion.transaction_id = event.ecommerce.transaction_id;
    calls.push(["event", "conversion", conversion]);
  }
  return calls;
}

/* ---------- TikTok Pixel (ttq) ---------- */

export type TikTokCall =
  | { kind: "page" }
  | { kind: "track"; name: string; params: Record<string, unknown>; eventId: string };

const TIKTOK_NAMES: Partial<Record<TrackingEvent["event"], string>> = {
  view_item: "ViewContent",
  search: "Search",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo",
  purchase: "CompletePayment",
  sign_up: "CompleteRegistration",
  generate_lead: "SubmitForm",
};

export function toTikTok(event: TrackingEvent): TikTokCall | null {
  if (event.event === "page_view") return { kind: "page" };
  const name = TIKTOK_NAMES[event.event];
  if (!name) return null;
  const params: Record<string, unknown> = {};
  const items = eventItems(event);
  if (items.length) {
    params.contents = items.map((i) => ({
      content_id: i.item_id,
      content_type: "product",
      content_name: i.item_name,
      quantity: i.quantity,
      price: i.price,
    }));
  }
  const value = eventValue(event);
  if (value !== null) {
    params.value = value;
    params.currency = "EUR";
  }
  if (event.event === "search") params.query = event.search_term;
  return { kind: "track", name, params, eventId: event.event_id };
}
