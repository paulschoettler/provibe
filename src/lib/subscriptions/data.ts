import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAddress } from "@/lib/checkout/session";
import type { AmountsSnapshot, StoredAddress } from "@/lib/checkout/types";
import { supabaseServer } from "@/lib/supabase/server";
import type { CurrentCustomer } from "@/lib/auth/session";
import {
  aboTitle,
  loadPricingContext,
  loadSubscribableProducts,
  loadVariants,
  quoteDelivery,
  type PricingContext,
  type SubscribableProduct,
} from "./catalog";
import { paymentMethodLabel } from "./mailer";
import { effectiveNextDelivery, remainingRetryDates } from "./schedule";
import { loadSubscriptionSettings } from "./settings";
import type {
  PaymentMethodRow,
  SubscriptionEventRow,
  SubscriptionRow,
  SubscriptionSettings,
} from "./types";

/**
 * Lesezugriffe des Kundenportals. Abos, Ereignisse, Zahlungsmittel und Bestellungen liest der
 * Kunde über seine Session mit RLS (eigene Zeilen über current_customer_id()); Katalog und Preise
 * kommen aus den öffentlichen Daten. Schreiben läuft ausschließlich über Server Actions.
 */

async function rlsClient(): Promise<SupabaseClient> {
  return (await supabaseServer()) as unknown as SupabaseClient;
}

export interface SubscriptionCardView {
  id: string;
  number: string;
  status: SubscriptionRow["status"];
  pauseReason: SubscriptionRow["pause_reason"];
  productTitle: string;
  productHandle: string;
  variantTitle: string;
  quantity: number;
  intervalWeeks: number;
  imageUrl: string | null;
  totalCents: number;
  goodsCents: number;
  depositCents: number;
  shippingCents: number;
  nextDelivery: string | null;
  skipNext: boolean;
  pausedUntil: string | null;
  pastDueSince: string | null;
  cancelEffectiveAt: string | null;
  createdAt: string;
}

function toCard(
  row: SubscriptionRow,
  snapshot: AmountsSnapshot,
  line: {
    productTitle: string;
    productHandle: string;
    variantTitle: string;
    imageUrl: string | null;
  },
): SubscriptionCardView {
  const next = effectiveNextDelivery(row);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    pauseReason: row.pause_reason,
    productTitle: aboTitle(line.productHandle, line.productTitle),
    productHandle: line.productHandle,
    variantTitle: line.variantTitle,
    quantity: row.quantity,
    intervalWeeks: row.interval_count,
    imageUrl: line.imageUrl,
    totalCents: snapshot.totalCents,
    goodsCents: snapshot.subtotalCents,
    depositCents: snapshot.depositCents,
    shippingCents: snapshot.shippingCents,
    nextDelivery: next ? next.toISOString() : null,
    skipNext: row.skip_next,
    pausedUntil: row.paused_until,
    pastDueSince: row.past_due_since,
    cancelEffectiveAt: row.cancel_effective_at,
    createdAt: row.created_at,
  };
}

/** Alle Abos des eingeloggten Kunden, offene zuerst. */
export async function listMySubscriptions(
  customer: CurrentCustomer,
): Promise<SubscriptionCardView[]> {
  const db = await rlsClient();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customer.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[abo] Abos nicht geladen", error.message);
    return [];
  }
  const rows = (data ?? []) as SubscriptionRow[];
  if (rows.length === 0) return [];
  const [variants, pricing] = await Promise.all([
    loadVariants(rows.map((r) => r.variant_id)),
    loadPricingContext(),
  ]);
  const rank = { past_due: 0, active: 1, paused: 2, draft: 3, cancelled: 4 } as const;
  return rows
    .flatMap((row) => {
      const variant = variants.get(row.variant_id);
      if (!variant) return [];
      const quote = quoteDelivery(row, variant, pricing);
      return [toCard(row, quote.snapshot, quote.line)];
    })
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

export interface DeliveryHistoryItem {
  orderNumber: string;
  placedAt: string;
  totalCents: number;
  status: string;
  kind: "initial" | "renewal";
}

export interface PackOption {
  variantId: string;
  title: string;
  unitCount: number;
  /** Warenwert je Lieferung nach Abo-Rabatt, ohne Pfand */
  goodsCents: number;
  depositCents: number;
  perCanCents: number;
  basePriceText: string;
}

export interface SubscriptionDetailView {
  card: SubscriptionCardView;
  row: SubscriptionRow;
  snapshot: AmountsSnapshot;
  basePriceText: string;
  discountBp: number;
  address: StoredAddress | null;
  paymentMethod: PaymentMethodRow | null;
  paymentLabel: string;
  history: DeliveryHistoryItem[];
  events: SubscriptionEventRow[];
  /** Sorten mit Bild (Auswahl "Sorte") */
  flavors: SubscribableProduct[];
  /** Packgrößen der aktuellen Sorte mit Abo-Preis je Lieferung */
  packs: PackOption[];
  currentProductId: string | null;
  retryDates: string[];
  settings: SubscriptionSettings;
  pendingIncrease: boolean;
}

function packOptions(
  row: SubscriptionRow,
  product: SubscribableProduct | undefined,
  variants: Awaited<ReturnType<typeof loadVariants>>,
  pricing: PricingContext,
): PackOption[] {
  if (!product) return [];
  return product.variants.flatMap((v) => {
    const variant = variants.get(v.id);
    if (!variant) return [];
    // gleicher Abo-Rabatt, Menge 1, aktueller Katalogpreis (gilt bei einem Wechsel)
    const quote = quoteDelivery(
      {
        ...row,
        variant_id: v.id,
        quantity: 1,
        locked_price_cents: null,
        price_change_effective_at: null,
      },
      variant,
      pricing,
    );
    const line = quote.snapshot.lines[0];
    return [
      {
        variantId: v.id,
        title: v.title,
        unitCount: v.unitCount,
        goodsCents: quote.snapshot.subtotalCents,
        depositCents: quote.snapshot.depositCents,
        perCanCents: Math.round(quote.snapshot.subtotalCents / v.unitCount),
        basePriceText: line?.basePriceText ?? "",
      },
    ];
  });
}

/** Detail eines eigenen Abos; null, wenn es nicht existiert oder einem anderen Kunden gehört. */
export async function getMySubscription(
  customer: CurrentCustomer,
  id: string,
): Promise<SubscriptionDetailView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await rlsClient();
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  const row = data as SubscriptionRow | null;
  if (!row || row.status === "draft") return null;

  const [pricing, settings, flavors, pmRes, eventsRes, linksRes] = await Promise.all([
    loadPricingContext(),
    loadSubscriptionSettings(),
    loadSubscribableProducts(),
    row.payment_method_id
      ? db
          .from("customer_payment_methods")
          .select("*")
          .eq("id", row.payment_method_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("subscription_events")
      .select("*")
      .eq("subscription_id", row.id)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("subscription_orders")
      .select("kind, created_at, orders (order_number, placed_at, total_cents, status)")
      .eq("subscription_id", row.id)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  const currentProduct = flavors.find((p) => p.variants.some((v) => v.id === row.variant_id));
  const variants = await loadVariants([
    row.variant_id,
    ...flavors.flatMap((p) => p.variants.map((v) => v.id)),
  ]);
  const variant = variants.get(row.variant_id);
  if (!variant) return null;
  const quote = quoteDelivery(row, variant, pricing);
  const paymentMethod = (pmRes.data as PaymentMethodRow | null) ?? null;
  const history = (
    (linksRes.data ?? []) as unknown as {
      kind: "initial" | "renewal";
      created_at: string;
      orders: {
        order_number: string;
        placed_at: string;
        total_cents: number;
        status: string;
      } | null;
    }[]
  )
    .filter((l) => l.orders)
    .map((l) => ({
      orderNumber: l.orders!.order_number,
      placedAt: l.orders!.placed_at,
      totalCents: l.orders!.total_cents,
      status: l.orders!.status,
      kind: l.kind,
    }));
  const retryDates =
    row.status === "past_due" && row.past_due_since && !row.pending_payment_intent_id
      ? remainingRetryDates(settings.retryDays, row.retry_count, new Date(row.past_due_since))
          .filter((d) => d.getTime() > Date.now())
          .map((d) => d.toISOString())
      : [];

  return {
    card: toCard(row, quote.snapshot, quote.line),
    row,
    snapshot: quote.snapshot,
    basePriceText: quote.snapshot.lines[0]?.basePriceText ?? "",
    discountBp: row.discount_bp,
    address: readAddress(row.shipping_address),
    paymentMethod,
    paymentLabel: paymentMethodLabel(paymentMethod),
    history,
    events: (eventsRes.data ?? []) as SubscriptionEventRow[],
    flavors,
    packs: packOptions(row, currentProduct, variants, pricing),
    currentProductId: currentProduct?.id ?? null,
    retryDates,
    settings,
    pendingIncrease: quote.pendingIncrease,
  };
}

/** Packgrößen je Sorte (für den Sortenwechsel: gleiche Dosenzahl in anderer Sorte finden). */
export function variantForFlavor(
  flavors: SubscribableProduct[],
  productId: string,
  unitCount: number,
): string | null {
  const product = flavors.find((p) => p.id === productId);
  return (
    product?.variants.find((v) => v.unitCount === unitCount)?.id ?? product?.variants[0]?.id ?? null
  );
}
