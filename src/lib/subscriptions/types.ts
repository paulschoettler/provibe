/**
 * Typen des Abos. Beträge in Cent, Zeitpunkte als ISO-Zeichenketten in UTC.
 * Datenbank: subscriptions, subscription_events, subscription_orders, customer_payment_methods,
 * subscription_cancellation_requests (Migrationen 20260921121200 und 20261017107000).
 */

export type SubscriptionStatus = "draft" | "active" | "paused" | "past_due" | "cancelled";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  paused: "Pausiert",
  past_due: "Zahlung offen",
  cancelled: "Gekündigt",
};

export type PauseReason = "customer" | "payment_failed" | "staff";
export type CancelKind = "ordinary" | "extraordinary";
export type ActorType = "customer" | "staff" | "system" | "public";

/** Zeile aus public.subscriptions (inklusive der Spalten aus Migration 20261017107000). */
export interface SubscriptionRow {
  id: string;
  number: string;
  customer_id: string;
  status: SubscriptionStatus;
  variant_id: string;
  quantity: number;
  interval_unit: "week" | "month";
  interval_count: number;
  discount_bp: number;
  stripe_customer_id: string | null;
  payment_method_id: string | null;
  shipping_address: unknown;
  next_order_at: string | null;
  last_order_at: string | null;
  paused_until: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  skip_next: boolean;
  price_notice_sent_at: string | null;
  price_change_effective_at: string | null;
  locked_price_cents: number | null;
  retry_count: number;
  last_payment_error: string | null;
  last_payment_failed_at: string | null;
  past_due_since: string | null;
  next_retry_at: string | null;
  pending_payment_intent_id: string | null;
  cancel_effective_at: string | null;
  cancel_kind: CancelKind | null;
  pause_reason: PauseReason | null;
  reminder_sent_for: string | null;
  processing_started_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Felder, die subscription_apply übernehmen darf (Spiegel der Liste in der Migration). */
export type SubscriptionPatch = Partial<
  Pick<
    SubscriptionRow,
    | "status"
    | "variant_id"
    | "quantity"
    | "interval_unit"
    | "interval_count"
    | "discount_bp"
    | "payment_method_id"
    | "shipping_address"
    | "next_order_at"
    | "last_order_at"
    | "paused_until"
    | "cancelled_at"
    | "cancel_reason"
    | "skip_next"
    | "price_notice_sent_at"
    | "price_change_effective_at"
    | "locked_price_cents"
    | "retry_count"
    | "last_payment_error"
    | "last_payment_failed_at"
    | "past_due_since"
    | "next_retry_at"
    | "pending_payment_intent_id"
    | "cancel_effective_at"
    | "cancel_kind"
    | "pause_reason"
    | "reminder_sent_for"
    | "processing_started_at"
    | "stripe_customer_id"
  >
>;

export interface PaymentMethodRow {
  id: string;
  customer_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  created_at: string;
}

export interface SubscriptionEventRow {
  id: number;
  subscription_id: string;
  kind: string;
  data: Record<string, unknown>;
  actor_type: ActorType;
  actor_id: string | null;
  created_at: string;
}

/** Einstellungen aus shop_settings mit Standardwerten. */
export interface SubscriptionSettings {
  /** Standardrabatt in Basispunkten (1000 = 10 %) */
  discountBp: number;
  /** Rabatt je Produkt beziehungsweise Variante, überschreibt den Standard */
  productDiscounts: { products: Record<string, number>; variants: Record<string, number> };
  /** erlaubte Intervalle in Wochen */
  intervals: number[];
  defaultInterval: number;
  /** Erinnerung so viele Tage vor der Lieferung */
  reminderDays: number;
  /** Wiederholungen nach einer abgelehnten Zahlung, Tage ab dem ersten Fehlschlag */
  retryDays: number[];
  /** längste Pause in Tagen (H25: höchstens 6 Monate) */
  pauseMaxDays: number;
}

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  discountBp: 1000,
  productDiscounts: { products: {}, variants: {} },
  intervals: [2, 4, 6, 8],
  defaultInterval: 4,
  reminderDays: 3,
  retryDays: [3, 7],
  pauseMaxDays: 183,
};

/** Kündigungsgründe im Portal-Dialog (Figma 68:1287). */
export const CANCEL_REASONS = [
  { id: "zu_viel_vorrat", label: "Zu viel Vorrat" },
  { id: "zu_teuer", label: "Zu teuer" },
  { id: "geschmack", label: "Geschmack passt nicht" },
  { id: "lieber_einzeln", label: "Lieber einzeln bestellen" },
  { id: "anderer_grund", label: "Anderer Grund" },
] as const;

export type CancelReasonId = (typeof CANCEL_REASONS)[number]["id"];

/** Ergebnis einer Abo-Aktion für Formulare (useActionState). */
export interface AboFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const INITIAL_ABO_STATE: AboFormState = { status: "idle" };
