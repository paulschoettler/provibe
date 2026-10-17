import type { Database } from "@/lib/supabase/database.types";

/**
 * Statusfluss und abgeleitete Status der Bestellungen (reine Funktionen, getestet in status.test.ts).
 *
 * Statusfluss (Briefing Abschnitt 8): offen → bezahlt → in Bearbeitung → versendet → zugestellt,
 * storniert aus offen, bezahlt oder in Bearbeitung, erstattet erst nach vollständiger Erstattung.
 * Zahl- und Versandstatus in Listen und Detail werden nach Entscheidung H16 aus Bestellstatus,
 * Zahlungsdaten und Sendungen abgeleitet (deriveOrderBadges), nicht separat gepflegt.
 */

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
export type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
];

/** Reihenfolge der Status-Tabs in der Bestellliste (Figma 35:4502). */
export const ORDER_STATUS_TABS: readonly OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Offen",
  paid: "Bezahlt",
  processing: "In Bearbeitung",
  shipped: "Versendet",
  delivered: "Zugestellt",
  cancelled: "Storniert",
  refunded: "Erstattet",
  partially_refunded: "Teilweise erstattet",
};

/** Kleinschreibung für Verlaufstexte: "Status geändert: bezahlt → in Bearbeitung". */
export function statusLabelLower(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status].toLowerCase();
}

/** Zahlungsweg für manuelle Bestellungen (Backoffice, Zahlart "Rechnung"). */
export const MANUAL_PAYMENT_PROVIDER = "manual";
export const MANUAL_PAYMENT_METHOD = "invoice";

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "processing", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
  // Altstatus aus dem Enum (Shopify-Import): verhält sich wie "bezahlt mit Teilerstattung"
  partially_refunded: ["processing", "shipped", "delivered", "cancelled", "refunded"],
};

export interface TransitionContext {
  /** orders.payment_provider: stripe, mock, manual */
  paymentProvider: string;
  paymentStatus: PaymentStatus;
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Darf die Bestellung von `from` nach `to`? Zusätzlich zur Tabelle:
 * - "bezahlt" von Hand nur bei manuellen Bestellungen (Stripe bestätigt Zahlungen per Webhook)
 * - "in Bearbeitung" ohne Zahlung nur bei manuellen Bestellungen (Kauf auf Rechnung)
 * - "erstattet" nur, wenn die Zahlung vollständig erstattet ist (createRefund setzt das selbst)
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx: TransitionContext,
): TransitionCheck {
  if (from === to)
    return { ok: false, reason: `Die Bestellung ist bereits ${statusLabelLower(to)}.` };
  if (!TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: `Von ${statusLabelLower(from)} nach ${statusLabelLower(to)} ist nicht möglich.`,
    };
  }
  const manual = ctx.paymentProvider === MANUAL_PAYMENT_PROVIDER;
  if (from === "pending" && to === "paid" && !manual) {
    return {
      ok: false,
      reason: "Online-Zahlungen werden nur über den Zahlungsanbieter als bezahlt markiert.",
    };
  }
  if (from === "pending" && to === "processing" && !manual) {
    return { ok: false, reason: "Unbezahlte Online-Bestellungen können nicht bearbeitet werden." };
  }
  if (to === "refunded" && ctx.paymentStatus !== "refunded") {
    return {
      ok: false,
      reason: "Erstattet ist eine Bestellung erst nach vollständiger Erstattung.",
    };
  }
  return { ok: true };
}

/** Mögliche Zielstatus für die Aktionsknöpfe im Detail (ohne "erstattet", das setzt die Erstattung). */
export function allowedTransitions(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  return TRANSITIONS[from].filter((to) => to !== "refunded" && checkTransition(from, to, ctx).ok);
}

/**
 * Schritte, um eine Bestellung auf "versendet" zu bringen (für addShipment): bezahlt geht über
 * "in Bearbeitung", damit der Verlauf jeden Schritt zeigt. Leere Liste, wenn schon versendet.
 * null, wenn Versand aus diesem Status nicht möglich ist.
 */
export function pathToShipped(from: OrderStatus, ctx: TransitionContext): OrderStatus[] | null {
  if (from === "shipped" || from === "delivered") return [];
  const path: OrderStatus[] = [];
  let current = from;
  if (current === "pending" || current === "paid" || current === "partially_refunded") {
    if (!checkTransition(current, "processing", ctx).ok) return null;
    path.push("processing");
    current = "processing";
  }
  if (current !== "processing") return null;
  path.push("shipped");
  return path;
}

// ---------------------------------------------------------------------------------------------
// Abgeleitete Badges (H16)

export type BadgeTone = "green" | "yellow" | "blue" | "red" | "gray";

export interface OrderBadge {
  /** stabiler Schlüssel für Filter und Tests */
  key: string;
  label: string;
  tone: BadgeTone;
  /** Ring statt Punkt: Zustand wartet noch auf etwas (Figma: "Offen", "Erstattet") */
  hollow: boolean;
}

export interface BadgeShipment {
  status: ShipmentStatus;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  isReturn?: boolean;
}

export interface BadgeInput {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: string | null;
  isTest?: boolean;
  shipments?: BadgeShipment[];
}

export interface OrderBadges {
  payment: OrderBadge;
  fulfilment: OrderBadge;
  /** nur bei Testbestellungen gesetzt (markiert, nicht versteckt) */
  test: OrderBadge | null;
}

const badge = (key: string, label: string, tone: BadgeTone, hollow = false): OrderBadge => ({
  key,
  label,
  tone,
  hollow,
});

export function derivePaymentBadge(input: BadgeInput): OrderBadge {
  const manual = input.paymentProvider === MANUAL_PAYMENT_PROVIDER;
  switch (input.paymentStatus) {
    case "refunded":
      return badge("refunded", "Erstattet", "red", true);
    case "partially_refunded":
      return badge("partially_refunded", "Teilweise erstattet", "yellow");
    case "failed":
      return badge("failed", "Fehlgeschlagen", "red");
    case "paid":
      return input.status === "cancelled"
        ? badge("refund_due", "Erstattung offen", "yellow", true)
        : badge("paid", "Bezahlt", "green");
    case "authorized":
      return input.status === "cancelled"
        ? badge("cancelled", "Storniert", "red")
        : badge("authorized", "Autorisiert", "blue");
    case "unpaid":
    default:
      if (input.status === "cancelled") return badge("cancelled", "Storniert", "red");
      return manual
        ? badge("invoice_open", "Rechnung offen", "yellow", true)
        : badge("open", "Offen", "yellow", true);
  }
}

export function deriveFulfilmentBadge(input: BadgeInput): OrderBadge {
  const outbound = (input.shipments ?? []).filter((s) => !s.isReturn && s.status !== "cancelled");
  const isShipped = (s: BadgeShipment) =>
    Boolean(s.shippedAt) || ["shipped", "in_transit", "delivered", "returned"].includes(s.status);
  const isDelivered = (s: BadgeShipment) => Boolean(s.deliveredAt) || s.status === "delivered";
  const shipped = outbound.filter(isShipped);

  if (input.status === "cancelled") return badge("cancelled", "Storniert", "red");
  if (input.status === "refunded" && shipped.length === 0) {
    return badge("cancelled", "Storniert", "red");
  }
  if (outbound.some((s) => s.status === "returned")) return badge("returned", "Retoure", "gray");
  if (
    input.status === "delivered" ||
    (shipped.length > 0 && shipped.every(isDelivered) && shipped.length === outbound.length)
  ) {
    return badge("delivered", "Zugestellt", "green");
  }
  if (input.status === "shipped" || shipped.length > 0) {
    return badge("shipped", "Versendet", "blue");
  }
  if (input.status === "processing" || outbound.some((s) => s.status === "label_created")) {
    return badge("processing", "In Bearbeitung", "yellow");
  }
  return badge("open", "Offen", "yellow", true);
}

/** Zahl- und Versandstatus für Liste und Detail (H16), dazu das Test-Badge. */
export function deriveOrderBadges(input: BadgeInput): OrderBadges {
  return {
    payment: derivePaymentBadge(input),
    fulfilment: deriveFulfilmentBadge(input),
    test: input.isTest ? badge("test", "Test", "gray") : null,
  };
}
