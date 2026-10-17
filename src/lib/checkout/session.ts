import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import type { DiscountRejection, ShippingRateRule } from "@/lib/pricing";
import { loadCheckoutCart, loadShippingRates, loadTaxRates, type CheckoutCart } from "./cart-data";
import { asJson, checkoutDb } from "./db";
import { loadDiscountRule, type LoadedDiscount } from "./discount";
import { buildAmountsSnapshot } from "./snapshot";
import type { AmountsSnapshot, StoredAddress } from "./types";

/**
 * Checkout-Sessions: eine offene Session je Warenkorb. Status open → processing → completed oder
 * failed (abgelehnte Zahlung; ein neuer Versuch öffnet sie wieder). Läuft nach 30 Minuten ohne
 * Zahlung ab (expires_at); dann gibt ein Job die Reservierung frei (siehe jobs.ts), zusätzlich
 * räumt pg_cron abgelaufene Reservierungen alle zwei Minuten ab.
 */

export type CheckoutSessionRow = Database["public"]["Tables"]["checkout_sessions"]["Row"];

export const SESSION_TTL_MINUTES = 30;
const ACTIVE_STATUSES = ["open", "processing", "failed"] as const;

export function sessionExpiry(now = new Date()): string {
  return new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000).toISOString();
}

export async function findActiveSession(cartId: string): Promise<CheckoutSessionRow | null> {
  const { data } = await checkoutDb()
    .from("checkout_sessions")
    .select("*")
    .eq("cart_id", cartId)
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function findSessionById(id: string): Promise<CheckoutSessionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await checkoutDb()
    .from("checkout_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export interface CheckoutState {
  cart: CheckoutCart;
  session: CheckoutSessionRow | null;
  shippingRates: ShippingRateRule[];
  selectedRate: ShippingRateRule | null;
  discount: LoadedDiscount | null;
  discountRejection: DiscountRejection | null;
  snapshot: AmountsSnapshot;
  depositTaxRateBp: number;
}

/**
 * Warenkorb, Session, Versandtarife und Rabatt laden und den Betrags-Snapshot rechnen.
 * null, wenn kein Warenkorb existiert oder er leer ist.
 */
export async function loadCheckoutState(
  overrides: { shippingRateId?: string | null; email?: string | null } = {},
): Promise<CheckoutState | null> {
  const cart = await loadCheckoutCart();
  if (!cart || cart.lines.length === 0) return null;

  const [session, shippingRates, taxRates] = await Promise.all([
    findActiveSession(cart.id),
    loadShippingRates(),
    loadTaxRates(),
  ]);
  const email = overrides.email ?? session?.email ?? cart.email ?? null;
  const discount = await loadDiscountRule(cart.discountCodeId, email);
  const depositTaxRateBp = taxRates.get("standard") ?? 1900;

  const rateId = overrides.shippingRateId ?? session?.shipping_rate_id ?? null;
  const selectedRate = shippingRates.find((r) => r.id === rateId) ?? null;

  const { snapshot, totals } = buildAmountsSnapshot({
    lines: cart.lines,
    discount,
    // Ohne Auswahl zeigt die Übersicht den günstigsten passenden Tarif
    shippingRates: selectedRate ? [selectedRate] : shippingRates,
    depositTaxRateBp,
  });

  return {
    cart,
    session,
    shippingRates,
    selectedRate: selectedRate ?? (snapshot.shipping ? (totals.shippingRate ?? null) : null),
    discount,
    discountRejection: discount ? totals.discountReason : null,
    snapshot,
    depositTaxRateBp,
  };
}

export interface SessionDetailsInput {
  email: string;
  phone: string | null;
  shippingAddress: StoredAddress;
  billingAddress: StoredAddress | null;
  shippingRate: ShippingRateRule;
  snapshot: AmountsSnapshot;
}

/** Kontakt, Adressen und Versandart speichern; legt die Session bei Bedarf an. */
export async function saveSessionDetails(
  state: CheckoutState,
  input: SessionDetailsInput,
): Promise<CheckoutSessionRow> {
  const db = checkoutDb();
  const fields = {
    email: input.email,
    phone: input.phone,
    shipping_address: asJson(input.shippingAddress),
    billing_address: input.billingAddress ? asJson(input.billingAddress) : null,
    shipping_rate_id: input.shippingRate.id,
    shipping_method: asJson({
      id: input.shippingRate.id,
      name: input.shippingRate.name,
      price_cents: input.snapshot.shippingCents,
      list_price_cents: input.shippingRate.priceCents,
      delivery_time_text: input.snapshot.shipping?.deliveryTimeText ?? null,
    }),
    discount_code: input.snapshot.discountCode,
    amounts: asJson(input.snapshot),
    attribution: asJson(state.cart.attribution),
    customer_id: state.cart.customerId,
    expires_at: sessionExpiry(),
  };

  if (state.session) {
    const { data, error } = await db
      .from("checkout_sessions")
      .update({ ...fields, status: "open" })
      .eq("id", state.session.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(`Checkout-Session nicht gespeichert: ${error?.message}`);
    return data;
  }

  const { data, error } = await db
    .from("checkout_sessions")
    .insert({ ...fields, cart_id: state.cart.id, payment_provider: "stripe" })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Checkout-Session nicht angelegt: ${error?.message}`);

  // E-Mail am Warenkorb merken (Warenkorbabbrecher-Mail nur mit Werbeeinwilligung, Briefing 8)
  await db
    .from("carts")
    .update({ email: input.email, last_activity_at: new Date().toISOString() })
    .eq("id", state.cart.id);
  return data;
}

export function readAddress(value: unknown): StoredAddress | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<StoredAddress>;
  if (!a.first_name || !a.last_name || !a.street || !a.postal_code || !a.city) return null;
  return {
    first_name: a.first_name,
    last_name: a.last_name,
    company: a.company ?? null,
    street: a.street,
    house_number: a.house_number ?? null,
    address_addition: a.address_addition ?? null,
    postal_code: a.postal_code,
    city: a.city,
    country_code: "DE",
    phone: a.phone ?? null,
  };
}

export function readSnapshot(value: unknown): AmountsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<AmountsSnapshot>;
  return s.version === 1 && Array.isArray(s.lines) ? (s as AmountsSnapshot) : null;
}
