import "server-only";
import { publicEnv } from "@/lib/env/public";
import { integrations } from "@/lib/integrations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { supabaseServer } from "@/lib/supabase/server";
import type { OrderStatus, OrderTimeline, PaymentStatus } from "./order-status";
import type { CurrentCustomer } from "./session";

/**
 * Lesezugriffe für die Kontoseiten. Alles läuft mit der Nutzer-Session (supabaseServer),
 * RLS beschränkt auf eigene Zeilen (Policies in 20260921121300_rls.sql). Nur der
 * Newsletter-Status wird zusätzlich per E-Mail gesucht und braucht dafür die Service Role.
 */

/** Feste Produktbilder wie im Warenkorb (src/lib/cart/server.ts), damit die Optik gleich bleibt. */
const IMAGE_BY_HANDLE: Record<string, string> = {
  wildberry: "/images/cans/wildberry.webp",
  "raspberry-lime": "/images/cans/raspberry-lime.webp",
  peach: "/images/cans/peach.webp",
  "founder-bundle-i": "/images/bundle-1.jpg",
  "founder-bundle-ii": "/images/bundle-2.jpg",
  "founder-bundle-iii-1": "/images/bundle-3.jpg",
};

export function orderItemImage(handle: string | null, imagePath: string | null): string | null {
  if (handle && IMAGE_BY_HANDLE[handle]) return IMAGE_BY_HANDLE[handle];
  if (!imagePath) return null;
  if (imagePath.startsWith("/") || imagePath.startsWith("https://")) return imagePath;
  const path = imagePath.replace(/^product-media\//, "");
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/product-media/${path}`;
}

export interface OrderSummary extends OrderTimeline {
  id: string;
  number: string;
  totalCents: number;
  itemCount: number;
  thumbs: { src: string; alt: string }[];
}

const ORDER_LIST_COLUMNS =
  "id, order_number, status, payment_status, placed_at, paid_at, shipped_at, delivered_at, total_cents, order_items (product_title, product_handle, image_path, quantity, position)";

type ItemThumbRow = {
  product_title: string;
  product_handle: string | null;
  image_path: string | null;
  quantity: number;
  position: number;
};

function toTimeline(row: {
  status: string;
  payment_status: string;
  placed_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}): OrderTimeline {
  return {
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    placedAt: row.placed_at,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
  };
}

/** Bestellungen der eingeloggten Person, neueste zuerst. Testbestellungen bleiben sichtbar (markiert im Backoffice). */
export async function listOrders(limit = 50): Promise<OrderSummary[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_LIST_COLUMNS)
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[konto] Bestellungen nicht geladen", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const items = ((row.order_items ?? []) as ItemThumbRow[]).sort(
      (a, b) => a.position - b.position,
    );
    return {
      ...toTimeline(row),
      id: row.id,
      number: row.order_number,
      totalCents: row.total_cents,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      thumbs: items
        .map((i) => ({ src: orderItemImage(i.product_handle, i.image_path), alt: i.product_title }))
        .filter((t): t is { src: string; alt: string } => t.src !== null)
        .slice(0, 3),
    };
  });
}

export interface AddressView {
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  houseNumber: string | null;
  addressAddition: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
}

/** Adress-Snapshot aus orders.shipping_address/billing_address (jsonb, snake_case oder camelCase). */
export function addressFromJson(value: Json | null): AddressView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, Json | undefined>;
  const s = (...keys: string[]) => {
    for (const k of keys) {
      const x = v[k];
      if (typeof x === "string" && x.trim()) return x.trim();
    }
    return null;
  };
  const street = s("street", "line1", "address1");
  const city = s("city");
  if (!street || !city) return null;
  return {
    firstName: s("first_name", "firstName") ?? "",
    lastName: s("last_name", "lastName") ?? "",
    company: s("company"),
    street,
    houseNumber: s("house_number", "houseNumber"),
    addressAddition: s("address_addition", "addressAddition", "line2", "address2"),
    postalCode: s("postal_code", "postalCode", "zip") ?? "",
    city,
    countryCode: s("country_code", "countryCode", "country") ?? "DE",
  };
}

export interface OrderItemView {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  unitDepositCents: number;
  /** Menge × (Preis + Pfand) − Rabatt (Zahlbetrag der Zeile, nicht als Preis anzeigen) */
  lineTotalCents: number;
  /** Menge × Preis ohne Pfand, vor Rabatt: Zeilenpreis der Anzeige (§ 7 PAngV, H22) */
  goodsTotalCents: number;
  /** Menge × Pfand, getrennt neben dem Zeilenpreis */
  depositTotalCents: number;
  basePriceText: string | null;
  image: string | null;
  handle: string | null;
}

export interface ShipmentView {
  carrier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemView[];
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  shippingCents: number;
  shippingName: string | null;
  depositCents: number;
  taxCents: number;
  taxLines: { rateBp: number; taxCents: number }[];
  shippingAddress: AddressView | null;
  billingAddress: AddressView | null;
  paymentMethodType: string | null;
  invoiceAvailable: boolean;
  shipments: ShipmentView[];
}

function taxLinesFrom(value: Json): { rateBp: number; taxCents: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) return null;
      const rate = Number((line as Record<string, Json>).rate_bp);
      const tax = Number((line as Record<string, Json>).tax_cents);
      return Number.isFinite(rate) && Number.isInteger(tax)
        ? { rateBp: rate, taxCents: tax }
        : null;
    })
    .filter((l): l is { rateBp: number; taxCents: number } => l !== null);
}

/** Tracking-Link: gespeicherter Link oder der Link des Versandanbieters (DHL). */
export function trackingLink(
  carrier: string,
  number: string | null,
  stored: string | null,
): string | null {
  if (stored && stored.startsWith("https://")) return stored;
  if (!number) return null;
  if (carrier.toLowerCase() === "dhl") return integrations().shipping.trackingUrl(number);
  return null;
}

export async function getOrderByNumber(number: string): Promise<OrderDetail | null> {
  if (!/^[A-Za-z0-9#-]{3,40}$/.test(number)) return null;
  const supabase = await supabaseServer();
  const { data: row, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, placed_at, paid_at, shipped_at, delivered_at, total_cents, subtotal_cents, discount_cents, discount_code, shipping_cents, shipping_rate_name, deposit_cents, tax_cents, tax_lines, shipping_address, billing_address, payment_method_type, invoice_pdf_path, invoice_status",
    )
    .eq("order_number", number)
    .maybeSingle();
  if (error || !row) return null;

  const [{ data: itemRows }, { data: shipmentRows }] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "id, product_title, variant_title, product_handle, image_path, quantity, unit_price_cents, unit_deposit_cents, line_total_cents, base_price_text, position",
      )
      .eq("order_id", row.id)
      .order("position", { ascending: true }),
    supabase
      .from("shipments")
      .select("carrier, tracking_number, tracking_url, shipped_at, created_at, is_return, status")
      .eq("order_id", row.id)
      .eq("is_return", false)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
  ]);

  const items: OrderItemView[] = (itemRows ?? []).map((i) => ({
    id: i.id,
    title: i.product_title,
    variantTitle: i.variant_title,
    quantity: i.quantity,
    unitDepositCents: i.unit_deposit_cents,
    lineTotalCents: i.line_total_cents,
    goodsTotalCents: i.quantity * i.unit_price_cents,
    depositTotalCents: i.quantity * i.unit_deposit_cents,
    basePriceText: i.base_price_text,
    image: orderItemImage(i.product_handle, i.image_path),
    handle: i.product_handle,
  }));

  return {
    ...toTimeline(row),
    id: row.id,
    number: row.order_number,
    totalCents: row.total_cents,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    thumbs: items
      .filter((i) => i.image)
      .slice(0, 3)
      .map((i) => ({ src: i.image as string, alt: i.title })),
    items,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    discountCode: row.discount_code,
    shippingCents: row.shipping_cents,
    shippingName: row.shipping_rate_name,
    depositCents: row.deposit_cents,
    taxCents: row.tax_cents,
    taxLines: taxLinesFrom(row.tax_lines),
    shippingAddress: addressFromJson(row.shipping_address),
    billingAddress: addressFromJson(row.billing_address),
    paymentMethodType: row.payment_method_type,
    invoiceAvailable: Boolean(row.invoice_pdf_path),
    shipments: (shipmentRows ?? []).map((s) => ({
      carrier: s.carrier,
      trackingNumber: s.tracking_number,
      trackingUrl: trackingLink(s.carrier, s.tracking_number, s.tracking_url),
      shippedAt: s.shipped_at,
    })),
  };
}

export interface SavedAddress extends AddressView {
  id: string;
  label: string | null;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export async function listAddresses(): Promise<SavedAddress[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("customer_addresses")
    .select(
      "id, label, first_name, last_name, company, street, house_number, address_addition, postal_code, city, country_code, phone, is_default_shipping, is_default_billing, created_at",
    )
    .order("is_default_shipping", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[konto] Adressen nicht geladen", error.message);
    return [];
  }
  return (data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    firstName: a.first_name,
    lastName: a.last_name,
    company: a.company,
    street: a.street,
    houseNumber: a.house_number,
    addressAddition: a.address_addition,
    postalCode: a.postal_code,
    city: a.city,
    countryCode: a.country_code,
    phone: a.phone,
    isDefaultShipping: a.is_default_shipping,
    isDefaultBilling: a.is_default_billing,
  }));
}

export type NewsletterState = "subscribed" | "pending" | "none";

/** Newsletter-Status per Kunden-ID oder E-Mail (Anmeldung im Footer kennt keinen Kunden). */
export async function getNewsletterState(customer: CurrentCustomer): Promise<NewsletterState> {
  const db = supabaseAdmin();
  const [byCustomer, byEmail] = await Promise.all([
    db.from("newsletter_contacts").select("status").eq("customer_id", customer.id),
    db.from("newsletter_contacts").select("status").eq("email", customer.email),
  ]);
  const rows = [...(byCustomer.data ?? []), ...(byEmail.data ?? [])];
  if (rows.some((r) => r.status === "subscribed")) return "subscribed";
  if (rows.some((r) => r.status === "pending")) return "pending";
  return "none";
}

export interface AccountOverview {
  orderCount: number;
  addressCount: number;
  lastOrder: OrderSummary | null;
}

export async function getAccountOverview(): Promise<AccountOverview> {
  const supabase = await supabaseServer();
  const [orders, addresses, { count: orderCount }] = await Promise.all([
    listOrders(1),
    supabase.from("customer_addresses").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
  ]);
  return {
    orderCount: orderCount ?? 0,
    addressCount: addresses.count ?? 0,
    lastOrder: orders[0] ?? null,
  };
}
