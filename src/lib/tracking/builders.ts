import type {
  AddPaymentInfoEvent,
  AddShippingInfoEvent,
  AddToCartEvent,
  BeginCheckoutEvent,
  GenerateLeadEvent,
  PurchaseEvent,
  RemoveFromCartEvent,
  SearchEvent,
  SignUpEvent,
  TrackingEvent,
  TrackingItem,
  ViewCartEvent,
  ViewItemEvent,
  ViewItemListEvent,
} from "./schema";

/**
 * Baut Events aus Shop-Daten. Rein und für Client und Server nutzbar. Preise kommen immer aus
 * serverseitig gerechneten Werten (Katalog, Warenkorb-Antwort, Snapshot), nie aus Eingaben.
 */

export const euro = (cents: number) => Math.round(cents) / 100;

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

function toItems(src: TrackingSource["items"]): TrackingItem[] {
  return src.map((i) => ({
    item_id: i.id ?? i.title,
    item_name: i.title,
    ...(i.variant ? { item_variant: i.variant } : {}),
    price: euro(i.unitPriceCents),
    quantity: i.quantity,
  }));
}

function base<N extends TrackingEvent["event"]>(name: N, eventId: string, src: TrackingSource) {
  return {
    event: name,
    event_id: eventId,
    ecommerce: {
      currency: "EUR" as const,
      value: euro(src.valueCents),
      ...(src.coupon ? { coupon: src.coupon } : {}),
      items: toItems(src.items),
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

/* ---------- Katalog ---------- */

/** Variante aus dem Katalog (VariantView) oder der Produktseite, Preis ohne Pfand. */
export interface CatalogItemSource {
  variantId: string;
  sku: string | null;
  title: string;
  variantTitle?: string | null;
  category?: string | null;
  goodsPriceCents: number;
}

export function catalogItem(src: CatalogItemSource, quantity = 1, index?: number): TrackingItem {
  return {
    item_id: src.sku || src.variantId,
    item_name: src.title,
    ...(src.variantTitle ? { item_variant: src.variantTitle } : {}),
    ...(src.category ? { item_category: src.category } : {}),
    price: euro(src.goodsPriceCents),
    quantity,
    ...(index !== undefined ? { index } : {}),
  };
}

/** Produktseite: view_item mit der Standardvariante. Die event_id vergibt der Browser. */
export function buildViewItemEvent(src: CatalogItemSource): ViewItemEvent {
  return {
    event: "view_item",
    event_id: "",
    ecommerce: { currency: "EUR", value: euro(src.goodsPriceCents), items: [catalogItem(src)] },
  };
}

/** Kollektion oder Suchtreffer: view_item_list, höchstens 24 Artikel. */
export function buildViewItemListEvent(
  listId: string,
  listName: string,
  items: CatalogItemSource[],
): ViewItemListEvent {
  return {
    event: "view_item_list",
    event_id: "",
    ecommerce: {
      currency: "EUR",
      item_list_id: listId,
      item_list_name: listName,
      items: items.slice(0, 24).map((item, i) => catalogItem(item, 1, i)),
    },
  };
}

export function buildSearchEvent(term: string): SearchEvent {
  return { event: "search", event_id: "", search_term: term.trim().slice(0, 80) };
}

/* ---------- Warenkorb ---------- */

/** Ausschnitt aus CartLineView (src/lib/cart/types.ts), Beträge vom Server gerechnet. */
export interface CartLineSource {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  unitPriceCents: number;
  quantity: number;
}

export function cartItem(line: CartLineSource, quantity = line.quantity): TrackingItem {
  return {
    item_id: line.variantId,
    item_name: line.productTitle,
    ...(line.variantTitle ? { item_variant: line.variantTitle } : {}),
    price: euro(line.unitPriceCents),
    quantity,
  };
}

export function buildCartChangeEvent(
  name: "add_to_cart" | "remove_from_cart",
  line: CartLineSource,
  quantity: number,
): AddToCartEvent | RemoveFromCartEvent {
  const q = Math.max(1, Math.round(Math.abs(quantity)));
  return {
    event: name,
    event_id: "",
    ecommerce: {
      currency: "EUR",
      value: euro(line.unitPriceCents * q),
      items: [cartItem(line, q)],
    },
  };
}

export function buildViewCartEvent(lines: CartLineSource[]): ViewCartEvent {
  return {
    event: "view_cart",
    event_id: "",
    ecommerce: {
      currency: "EUR",
      value: euro(lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)),
      items: lines.map((l) => cartItem(l)),
    },
  };
}

/** begin_checkout im Browser aus dem Warenkorb; event_id wie auf dem Server (Deduplizierung). */
export function buildBeginCheckoutFromCart(
  cartId: string,
  lines: CartLineSource[],
): BeginCheckoutEvent {
  return {
    ...buildViewCartEvent(lines),
    event: "begin_checkout",
    event_id: `begin_checkout_${cartId}`,
  };
}

/* ---------- Formulare ---------- */

export function buildSignUpEvent(eventId: string): SignUpEvent {
  return { event: "sign_up", event_id: eventId, method: "newsletter" };
}

export function buildGenerateLeadEvent(eventId: string): GenerateLeadEvent {
  return { event: "generate_lead", event_id: eventId, lead_type: "partner" };
}
