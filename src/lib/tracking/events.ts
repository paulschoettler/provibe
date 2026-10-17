/**
 * Zentrale Tracking-Schicht (Briefing Abschnitt 6), hier zunächst nur das Event-Schema und eine
 * stille Ausgabe. Solange es kein Consent-Banner und keine Pixel-IDs gibt, wird nichts gesendet
 * und kein Skript geladen. Später:
 *   - Browser: ein kleines Client-Skript pusht serverseitig erzeugte Events nach window.dataLayer,
 *     aber nur mit Einwilligung der Kategorie "marketing" bzw. "statistik".
 *   - Server: purchase feuert aus dem Stripe-Webhook (Meta Conversions API, TikTok Events API,
 *     GA4 Measurement Protocol) mit derselben event_id zur Deduplizierung.
 * Schema angelehnt an GA4 E-Commerce, damit Meta und TikTok daraus gemappt werden können.
 */

export type TrackingEventName =
  "begin_checkout" | "add_shipping_info" | "add_payment_info" | "purchase";

export interface TrackingItem {
  item_id: string;
  item_name: string;
  item_variant?: string;
  /** Preis je Stück in Euro (GA4 erwartet Dezimalzahlen), ohne Pfand */
  price: number;
  quantity: number;
}

interface BaseEvent {
  event: TrackingEventName;
  /** Gemeinsame ID für Browser- und Server-Event (Deduplizierung) */
  event_id: string;
  ecommerce: {
    currency: "EUR";
    /** Warenwert in Euro nach Rabatt, ohne Pfand und Versand */
    value: number;
    coupon?: string;
    items: TrackingItem[];
  };
}

export interface BeginCheckoutEvent extends BaseEvent {
  event: "begin_checkout";
}

export interface AddShippingInfoEvent extends BaseEvent {
  event: "add_shipping_info";
  ecommerce: BaseEvent["ecommerce"] & { shipping_tier: string };
}

export interface AddPaymentInfoEvent extends BaseEvent {
  event: "add_payment_info";
  ecommerce: BaseEvent["ecommerce"] & { payment_type: string };
}

export interface PurchaseEvent extends BaseEvent {
  event: "purchase";
  ecommerce: BaseEvent["ecommerce"] & {
    transaction_id: string;
    shipping: number;
    tax: number;
  };
}

export type TrackingEvent =
  BeginCheckoutEvent | AddShippingInfoEvent | AddPaymentInfoEvent | PurchaseEvent;

const euro = (cents: number) => Math.round(cents) / 100;

/** Minimale Eingabe, damit Snapshot und Bestellung gleichermaßen passen. */
export interface TrackingSource {
  items: {
    id?: string;
    title: string;
    variant?: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  valueCents: number;
  coupon?: string | null;
}

function base<N extends TrackingEventName>(name: N, eventId: string, src: TrackingSource) {
  return {
    event: name,
    event_id: eventId,
    ecommerce: {
      currency: "EUR" as const,
      value: euro(src.valueCents),
      ...(src.coupon ? { coupon: src.coupon } : {}),
      items: src.items.map((i) => ({
        item_id: i.id ?? i.title,
        item_name: i.title,
        ...(i.variant ? { item_variant: i.variant } : {}),
        price: euro(i.unitPriceCents),
        quantity: i.quantity,
      })),
    },
  };
}

export function buildCheckoutEvent(
  name: "begin_checkout",
  eventId: string,
  src: TrackingSource,
): BeginCheckoutEvent;
export function buildCheckoutEvent(
  name: "add_shipping_info",
  eventId: string,
  src: TrackingSource,
  extra: { shipping_tier: string },
): AddShippingInfoEvent;
export function buildCheckoutEvent(
  name: "add_payment_info",
  eventId: string,
  src: TrackingSource,
  extra: { payment_type: string },
): AddPaymentInfoEvent;
export function buildCheckoutEvent(
  name: "begin_checkout" | "add_shipping_info" | "add_payment_info",
  eventId: string,
  src: TrackingSource,
  extra?: Record<string, string>,
): TrackingEvent {
  const event = base(name, eventId, src);
  return { ...event, ecommerce: { ...event.ecommerce, ...extra } } as TrackingEvent;
}

export function buildPurchaseEvent(order: {
  id: string;
  orderNumber: string;
  items: { title: string; description: string; unitPriceCents: number; quantity: number }[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  taxCents: number;
}): PurchaseEvent {
  const event = base("purchase", `purchase_${order.id}`, {
    items: order.items.map((i) => ({
      title: i.title,
      variant: i.description,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    valueCents: order.subtotalCents - order.discountCents,
    coupon: order.discountCode,
  });
  return {
    ...event,
    ecommerce: {
      ...event.ecommerce,
      transaction_id: order.orderNumber,
      shipping: euro(order.shippingCents),
      tax: euro(order.taxCents),
    },
  };
}

/**
 * Ausgabe eines Events. Bewusst ein No-op, bis Consent-Banner, Consent-Log und Pixel-IDs
 * existieren (Phase 8). Gibt das Event zurück, damit Aufrufer es testen oder weiterreichen können.
 */
export async function emitTrackingEvent<T extends TrackingEvent>(event: T): Promise<T> {
  return event;
}
