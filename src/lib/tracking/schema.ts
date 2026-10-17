/**
 * Einheitliches Event-Schema der Tracking-Schicht (Briefing Abschnitt 6), angelehnt an GA4
 * E-Commerce. Meta, Google und TikTok werden daraus in src/lib/tracking/adapters.ts gemappt.
 * Rein (keine Server- oder Browser-Abhängigkeit), damit Client und Server es gleichermaßen nutzen.
 *
 * Beträge stehen hier in Euro als Dezimalzahl (so erwarten es die Anbieter), immer ohne Pfand.
 * In der Datenbank bleibt alles in Cent.
 */

export const TRACKING_EVENT_NAMES = [
  "page_view",
  "view_item_list",
  "view_item",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "sign_up",
  "generate_lead",
] as const;

export type TrackingEventName = (typeof TRACKING_EVENT_NAMES)[number];

export interface TrackingItem {
  /** SKU, sonst Varianten-ID (Warenkorb kennt keine SKU), beim Kauf der Produkttitel */
  item_id: string;
  item_name: string;
  item_variant?: string;
  item_category?: string;
  /** Preis je Stück in Euro (GA4 erwartet Dezimalzahlen), ohne Pfand */
  price: number;
  quantity: number;
  /** Position in einer Liste (view_item_list) */
  index?: number;
}

export interface EcommercePayload {
  currency: "EUR";
  /** Warenwert in Euro nach Rabatt, ohne Pfand und Versand */
  value: number;
  coupon?: string;
  items: TrackingItem[];
}

interface BaseEvent {
  event: TrackingEventName;
  /**
   * Gemeinsame ID für Browser- und Server-Event (Deduplizierung bei Conversions API und Events
   * API). Leer lassen, wenn das Event im Browser entsteht: track() vergibt dann eine neue ID.
   */
  event_id: string;
}

interface EcommerceEvent extends BaseEvent {
  ecommerce: EcommercePayload;
}

export interface PageViewEvent extends BaseEvent {
  event: "page_view";
  page: {
    /** Bereinigter Pfad (Tokens ersetzt, siehe paths.ts) */
    path: string;
    /** Bereinigte URL ohne Suchparameter außer Kampagnenparametern */
    location: string;
    title?: string;
  };
}

export interface ViewItemListEvent extends BaseEvent {
  event: "view_item_list";
  ecommerce: {
    currency: "EUR";
    item_list_id: string;
    item_list_name: string;
    items: TrackingItem[];
  };
}

export interface ViewItemEvent extends EcommerceEvent {
  event: "view_item";
}

export interface SearchEvent extends BaseEvent {
  event: "search";
  search_term: string;
}

export interface AddToCartEvent extends EcommerceEvent {
  event: "add_to_cart";
}

export interface RemoveFromCartEvent extends EcommerceEvent {
  event: "remove_from_cart";
}

export interface ViewCartEvent extends EcommerceEvent {
  event: "view_cart";
}

export interface BeginCheckoutEvent extends EcommerceEvent {
  event: "begin_checkout";
}

export interface AddShippingInfoEvent extends BaseEvent {
  event: "add_shipping_info";
  ecommerce: EcommercePayload & { shipping_tier: string };
}

export interface AddPaymentInfoEvent extends BaseEvent {
  event: "add_payment_info";
  ecommerce: EcommercePayload & { payment_type: string };
}

export interface PurchaseEvent extends BaseEvent {
  event: "purchase";
  ecommerce: EcommercePayload & {
    transaction_id: string;
    shipping: number;
    tax: number;
  };
}

export interface SignUpEvent extends BaseEvent {
  event: "sign_up";
  /** Woher die Anmeldung kommt; nie eine E-Mail-Adresse */
  method: "newsletter";
}

export interface GenerateLeadEvent extends BaseEvent {
  event: "generate_lead";
  lead_type: "partner";
}

export type TrackingEvent =
  | PageViewEvent
  | ViewItemListEvent
  | ViewItemEvent
  | SearchEvent
  | AddToCartEvent
  | RemoveFromCartEvent
  | ViewCartEvent
  | BeginCheckoutEvent
  | AddShippingInfoEvent
  | AddPaymentInfoEvent
  | PurchaseEvent
  | SignUpEvent
  | GenerateLeadEvent;

export function isTrackingEventName(value: unknown): value is TrackingEventName {
  return typeof value === "string" && (TRACKING_EVENT_NAMES as readonly string[]).includes(value);
}

/** Wert eines Events in Euro, falls es einen hat (für Protokoll und Anbieter). */
export function eventValue(event: TrackingEvent): number | null {
  if ("ecommerce" in event && "value" in event.ecommerce) return event.ecommerce.value;
  return null;
}

/** Alle Artikel eines Events (leer bei Events ohne Warenbezug). */
export function eventItems(event: TrackingEvent): TrackingItem[] {
  return "ecommerce" in event ? event.ecommerce.items : [];
}
