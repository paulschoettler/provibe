/**
 * Darstellung des Bestellstatus im Kundenkonto (Status-Stepper, Badge, Zustellfenster).
 * Reine Logik ohne Datenbank, damit sie testbar bleibt. Zeiten liegen in UTC in der
 * Datenbank und werden für die Anzeige in Europe/Berlin formatiert.
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type PaymentStatus =
  "unpaid" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";

export interface OrderTimeline {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export type StepState = "done" | "current" | "open";

export interface OrderStep {
  key: "bestellt" | "bezahlt" | "versendet" | "zugestellt";
  label: string;
  state: StepState;
  /** "17.10." oder "erwartet" oder null */
  dateText: string | null;
}

export type BadgeTone = "butter" | "success" | "neutral" | "alert";

export interface StatusBadge {
  label: string;
  tone: BadgeTone;
}

const TZ = "Europe/Berlin";

const shortDate = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TZ,
});
const longDate = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});
const weekdayDate = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: TZ,
});
const weekdayDateYear = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

/** "17.10." */
export function formatShortDate(iso: string): string {
  const text = shortDate.format(new Date(iso));
  return text.endsWith(".") ? text : `${text}.`;
}

/** "17.10.2026" */
export function formatDate(iso: string): string {
  return longDate.format(new Date(iso));
}

/** "Sa., 17.10.2026" */
export function formatWeekdayDate(iso: string, withYear = true): string {
  const text = (withYear ? weekdayDateYear : weekdayDate).format(new Date(iso));
  return withYear || text.endsWith(".") ? text : `${text}.`;
}

/**
 * Wie weit ist die Bestellung? 0 bestellt, 1 bezahlt, 2 versendet, 3 zugestellt.
 * Zeitstempel zählen, auch wenn der Status (noch) nicht nachgezogen wurde.
 */
export function reachedStep(o: OrderTimeline): number {
  if (o.status === "delivered" || o.deliveredAt) return 3;
  if (o.status === "shipped" || o.shippedAt) return 2;
  if (
    o.status === "paid" ||
    o.status === "processing" ||
    o.paidAt ||
    o.paymentStatus === "paid" ||
    o.paymentStatus === "partially_refunded"
  ) {
    return 1;
  }
  return 0;
}

/** Storniert oder erstattet: kein Fortschritt, stattdessen Hinweis */
export function isClosedWithoutDelivery(o: Pick<OrderTimeline, "status">): boolean {
  return o.status === "cancelled" || o.status === "refunded";
}

export function orderSteps(o: OrderTimeline): OrderStep[] {
  const reached = reachedStep(o);
  const defs: { key: OrderStep["key"]; label: string; at: string | null }[] = [
    { key: "bestellt", label: "Bestellt", at: o.placedAt },
    { key: "bezahlt", label: "Bezahlt", at: o.paidAt },
    { key: "versendet", label: "Versendet", at: o.shippedAt },
    { key: "zugestellt", label: "Zugestellt", at: o.deliveredAt },
  ];
  return defs.map((d, i) => {
    const state: StepState =
      i < reached || (i === 3 && reached === 3) ? "done" : i === reached ? "current" : "open";
    let dateText: string | null = d.at ? formatShortDate(d.at) : null;
    if (!dateText && d.key === "zugestellt" && reached === 2) dateText = "erwartet";
    return { key: d.key, label: d.label, state, dateText };
  });
}

const BADGES: Record<OrderStatus, StatusBadge> = {
  pending: { label: "Offen", tone: "neutral" },
  paid: { label: "Bezahlt", tone: "butter" },
  processing: { label: "In Bearbeitung", tone: "butter" },
  shipped: { label: "Versendet", tone: "butter" },
  delivered: { label: "Zugestellt", tone: "success" },
  cancelled: { label: "Storniert", tone: "alert" },
  refunded: { label: "Erstattet", tone: "neutral" },
  partially_refunded: { label: "Teilweise erstattet", tone: "neutral" },
};

export function statusBadge(o: Pick<OrderTimeline, "status">): StatusBadge {
  return BADGES[o.status] ?? BADGES.pending;
}

const PAYMENT_BADGES: Record<PaymentStatus, StatusBadge> = {
  unpaid: { label: "Offen", tone: "neutral" },
  authorized: { label: "Autorisiert", tone: "neutral" },
  paid: { label: "Bezahlt", tone: "butter" },
  partially_refunded: { label: "Teilweise erstattet", tone: "neutral" },
  refunded: { label: "Erstattet", tone: "neutral" },
  failed: { label: "Fehlgeschlagen", tone: "alert" },
};

export function paymentBadge(status: PaymentStatus): StatusBadge {
  return PAYMENT_BADGES[status] ?? PAYMENT_BADGES.unpaid;
}

const PAYMENT_METHODS: Record<string, string> = {
  card: "Karte",
  klarna: "Klarna",
  paypal: "PayPal",
  sepa_debit: "SEPA-Lastschrift",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  link: "Link",
  invoice: "Rechnung",
};

export function paymentMethodLabel(type: string | null): string {
  if (!type) return "Zahlart wird nach der Zahlung angezeigt";
  return PAYMENT_METHODS[type] ?? type;
}

/** Werktage (Mo bis Fr) addieren, Feiertage bleiben unberücksichtigt. Rechnet auf UTC-Tagen. */
export function addBusinessDays(iso: string, days: number): Date {
  const date = new Date(iso);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const wd = date.getUTCDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  return date;
}

/**
 * Zustellfenster wie im Checkout (Frage H10): Bestelldatum plus 3 bis 5 Werktage.
 * Liefert null, sobald zugestellt, storniert oder erstattet.
 */
export function deliveryWindowText(o: OrderTimeline): string | null {
  if (reachedStep(o) === 3 || isClosedWithoutDelivery(o)) return null;
  const from = addBusinessDays(o.placedAt, 3).toISOString();
  const to = addBusinessDays(o.placedAt, 5).toISOString();
  return `${formatWeekdayDate(from, false)} bis ${formatWeekdayDate(to)}`;
}

/** Kurzer Satz für die Übersicht: "Mit DHL unterwegs. Zustellung voraussichtlich …" */
export function statusSentence(o: OrderTimeline, carrier = "DHL"): string {
  if (o.status === "cancelled") return "Diese Bestellung wurde storniert.";
  if (o.status === "refunded") return "Diese Bestellung wurde erstattet.";
  const step = reachedStep(o);
  const window = deliveryWindowText(o);
  if (step === 3) {
    return o.deliveredAt ? `Zugestellt am ${formatDate(o.deliveredAt)}.` : "Zugestellt.";
  }
  if (step === 2) return `Mit ${carrier} unterwegs. Zustellung voraussichtlich ${window}.`;
  if (step === 1) return `Wir packen schon. Zustellung voraussichtlich ${window}.`;
  return "Wir warten noch auf die Bestätigung deiner Zahlung.";
}
