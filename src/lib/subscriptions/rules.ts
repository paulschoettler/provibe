import { clampBasisPoints } from "@/lib/pricing/subscription";
import { DEFAULT_SUBSCRIPTION_SETTINGS, type SubscriptionSettings } from "./types";

/**
 * Reine Regeln des Abos ohne Datenbank (getestet in rules.test.ts): Einstellungen lesen,
 * Rabatt je Produkt oder Variante auflösen, abonnierbare Varianten erkennen, Intervalle prüfen.
 */

/** Abonnierbar sind die Packgrößen der Sorten und des Mixed-Produkts (9 bis 48 Dosen), Plan B. */
export const MIN_SUBSCRIPTION_UNITS = 9;
export const MAX_SUBSCRIPTION_UNITS = 48;
/** Höchstmenge je Abo-Lieferung (Pakete einer Packgröße) */
export const MAX_SUBSCRIPTION_QUANTITY = 48;

export interface SubscribableInput {
  productKind: string;
  productStatus?: string;
  variantActive?: boolean;
  unitCount: number;
  /** Pfand je Dose am Produkt; Getränke tragen Pfand, Merch nicht */
  depositCentsPerUnit: number;
}

export function isSubscribable(input: SubscribableInput): boolean {
  if (input.productKind !== "simple") return false;
  if (input.productStatus !== undefined && input.productStatus !== "active") return false;
  if (input.variantActive === false) return false;
  if (input.depositCentsPerUnit <= 0) return false;
  return input.unitCount >= MIN_SUBSCRIPTION_UNITS && input.unitCount <= MAX_SUBSCRIPTION_UNITS;
}

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toBpMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = toInt(raw, NaN);
    if (Number.isFinite(n) && /^[0-9a-f-]{36}$/i.test(key)) out[key] = clampBasisPoints(n);
  }
  return out;
}

/** Werte aus shop_settings (Schlüssel subscription_*) mit Standardwerten zusammenführen. */
export function parseSubscriptionSettings(rows: Record<string, unknown>): SubscriptionSettings {
  const d = DEFAULT_SUBSCRIPTION_SETTINGS;
  const intervalsRaw = rows.subscription_intervals as
    { weeks?: unknown; default?: unknown } | unknown[] | undefined;
  const weeksRaw = Array.isArray(intervalsRaw) ? intervalsRaw : intervalsRaw?.weeks;
  const intervals = Array.isArray(weeksRaw)
    ? [...new Set(weeksRaw.map((w) => toInt(w, 0)).filter((w) => w >= 1 && w <= 52))].sort(
        (a, b) => a - b,
      )
    : d.intervals;
  const safeIntervals = intervals.length > 0 ? intervals : d.intervals;
  const defaultRaw = Array.isArray(intervalsRaw) ? undefined : intervalsRaw?.default;
  const defaultInterval = toInt(defaultRaw, d.defaultInterval);

  const discountsRaw = rows.subscription_product_discounts as
    { products?: unknown; variants?: unknown } | undefined;
  const retryRaw = rows.subscription_retry_days;
  const retryDays = Array.isArray(retryRaw)
    ? retryRaw.map((n) => toInt(n, 0)).filter((n) => n >= 1 && n <= 60)
    : d.retryDays;

  return {
    discountBp: clampBasisPoints(toInt(rows.subscription_discount_bp, d.discountBp)),
    productDiscounts: {
      products: toBpMap(discountsRaw?.products),
      variants: toBpMap(discountsRaw?.variants),
    },
    intervals: safeIntervals,
    defaultInterval: safeIntervals.includes(defaultInterval)
      ? defaultInterval
      : safeIntervals.includes(d.defaultInterval)
        ? d.defaultInterval
        : safeIntervals[0],
    reminderDays: Math.min(14, Math.max(1, toInt(rows.subscription_reminder_days, d.reminderDays))),
    retryDays: [...new Set(retryDays)].sort((a, b) => a - b),
    pauseMaxDays: Math.min(
      d.pauseMaxDays,
      Math.max(7, toInt(rows.subscription_pause_max_days, d.pauseMaxDays)),
    ),
  };
}

/** Rabatt für eine neue Abo-Position: Variante vor Produkt vor Standard. */
export function resolveDiscountBp(
  settings: SubscriptionSettings,
  productId: string,
  variantId: string,
): number {
  const byVariant = settings.productDiscounts.variants[variantId];
  if (byVariant !== undefined) return byVariant;
  const byProduct = settings.productDiscounts.products[productId];
  if (byProduct !== undefined) return byProduct;
  return settings.discountBp;
}

export function isAllowedInterval(settings: SubscriptionSettings, weeks: number): boolean {
  return Number.isInteger(weeks) && settings.intervals.includes(weeks);
}

/** "alle 4 Wochen", "jede Woche" */
export function intervalLabel(weeks: number): string {
  return weeks === 1 ? "jede Woche" : `alle ${weeks} Wochen`;
}

/** Abo-Nummer ABO-1001 (H25). Eingaben wie "abo 1001" oder "1001" werden normalisiert. */
export function normalizeSubscriptionNumber(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length < 4 || digits.length > 9) return null;
  return `ABO-${Number(digits)}`;
}

export interface PriceLockView {
  locked_price_cents: number | null;
  price_change_effective_at: string | null;
}

export interface EffectivePrice {
  /** Variantenpreis inklusive Pfand, der für diese Lieferung gilt */
  priceCents: number;
  /** neuer Wert für locked_price_cents, null wenn unverändert */
  newLockedPriceCents: number | null;
  /** Ankündigung erledigt (Preis gilt jetzt): price_notice_sent_at und Termin zurücksetzen */
  clearNotice: boolean;
  /** Preis ist gestiegen, aber noch nicht angekündigt beziehungsweise noch nicht wirksam */
  pendingIncrease: boolean;
}

/**
 * Preisbindung im Abo (Plan B): Preiserhöhungen gelten erst nach Ankündigung mit mindestens vier
 * Wochen Vorlauf (price_change_effective_at). Bis dahin gilt der gebundene Preis. Senkungen
 * gelten sofort zugunsten des Kunden.
 */
export function effectiveVariantPrice(
  currentPriceCents: number,
  lock: PriceLockView,
  now: Date,
): EffectivePrice {
  const locked = lock.locked_price_cents;
  if (locked === null || locked === undefined) {
    return {
      priceCents: currentPriceCents,
      newLockedPriceCents: currentPriceCents,
      clearNotice: false,
      pendingIncrease: false,
    };
  }
  if (currentPriceCents <= locked) {
    return {
      priceCents: currentPriceCents,
      newLockedPriceCents: currentPriceCents === locked ? null : currentPriceCents,
      clearNotice: currentPriceCents !== locked && Boolean(lock.price_change_effective_at),
      pendingIncrease: false,
    };
  }
  const effective = lock.price_change_effective_at
    ? new Date(lock.price_change_effective_at)
    : null;
  if (effective && now.getTime() >= effective.getTime()) {
    return {
      priceCents: currentPriceCents,
      newLockedPriceCents: currentPriceCents,
      clearNotice: true,
      pendingIncrease: false,
    };
  }
  return {
    priceCents: locked,
    newLockedPriceCents: null,
    clearNotice: false,
    pendingIncrease: true,
  };
}

/** Mindestvorlauf einer Preisankündigung in Tagen (Plan B: vier Wochen). */
export const PRICE_NOTICE_DAYS = 28;
