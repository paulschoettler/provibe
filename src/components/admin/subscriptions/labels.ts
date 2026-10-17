import type { BadgeTone } from "@/components/admin/ui/Badge";
import type { IconName } from "@/components/admin/ui/Icon";
import type { SubscriptionStatus } from "@/lib/subscriptions/types";

/**
 * Beschriftungen und Farben des Abo-Backoffice (Figma 79:2120, 82:2420). Status wie im Portal:
 * aktiv grün, Zahlung offen gelb, pausiert grau, gekündigt rot.
 */

export const STATUS_BADGE: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Entwurf", tone: "gray" },
  active: { label: "Aktiv", tone: "green" },
  paused: { label: "Pausiert", tone: "gray" },
  past_due: { label: "Zahlung offen", tone: "yellow" },
  cancelled: { label: "Gekündigt", tone: "red" },
};

/** Status-Slugs in der URL (deutsch, teilbar) */
export const STATUS_SLUGS: { slug: string; status: SubscriptionStatus | "all"; label: string }[] = [
  { slug: "alle", status: "all", label: "Alle" },
  { slug: "aktiv", status: "active", label: "Aktiv" },
  { slug: "pausiert", status: "paused", label: "Pausiert" },
  { slug: "offen", status: "past_due", label: "Zahlung offen" },
  { slug: "gekuendigt", status: "cancelled", label: "Gekündigt" },
];

export function percentFromBp(bp: number): string {
  const value = bp / 100;
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

export function intervalText(weeks: number): string {
  return weeks === 1 ? "jede Woche" : `alle ${weeks} Wochen`;
}

export const PAYMENT_STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: "Bezahlt", tone: "green" },
  partially_refunded: { label: "Teilweise erstattet", tone: "blue" },
  refunded: { label: "Erstattet", tone: "gray" },
  unpaid: { label: "Offen", tone: "yellow" },
  authorized: { label: "Autorisiert", tone: "blue" },
  failed: { label: "Fehlgeschlagen", tone: "red" },
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Offen",
  paid: "Bezahlt",
  processing: "In Bearbeitung",
  shipped: "Versendet",
  delivered: "Zugestellt",
  cancelled: "Storniert",
  refunded: "Erstattet",
  partially_refunded: "Teilweise erstattet",
};

export const ACTOR_LABEL: Record<string, string> = {
  customer: "Kunde",
  staff: "Team",
  system: "System",
  public: "Kündigung ohne Login",
};

export interface EventDisplay {
  title: string;
  icon: IconName;
  tone: "default" | "accent" | "green" | "red";
}

/** Ereignisarten aus subscription_events (Migration 20261017107000) */
export const EVENT_DISPLAY: Record<string, EventDisplay> = {
  created: { title: "Abo angelegt", icon: "plus", tone: "accent" },
  activated: { title: "Abo aktiviert", icon: "haken", tone: "green" },
  changed: { title: "Abo geändert", icon: "notiz", tone: "default" },
  skipped: { title: "Nächste Lieferung übersprungen", icon: "chevron-rechts", tone: "default" },
  unskipped: { title: "Überspringen zurückgenommen", icon: "chevron-links", tone: "default" },
  skipped_delivery: { title: "Lieferung übersprungen", icon: "chevron-rechts", tone: "default" },
  paused: { title: "Abo pausiert", icon: "kalender", tone: "default" },
  resumed: { title: "Abo fortgesetzt", icon: "haken", tone: "green" },
  payment_failed: { title: "Zahlung fehlgeschlagen", icon: "warnung", tone: "red" },
  payment_action_required: {
    title: "Zahlung braucht Bestätigung (3-D Secure)",
    icon: "warnung",
    tone: "red",
  },
  payment_action_abandoned: {
    title: "Offene Bestätigung verworfen",
    icon: "stornieren",
    tone: "default",
  },
  payment_method_changed: { title: "Zahlungsmittel geändert", icon: "karte", tone: "default" },
  address_changed: { title: "Lieferadresse geändert", icon: "ort", tone: "default" },
  order_created: { title: "Bestellung angelegt", icon: "bestellungen", tone: "green" },
  reminder_sent: { title: "Erinnerung verschickt", icon: "emails", tone: "default" },
  price_notice_sent: { title: "Preisänderung angekündigt", icon: "emails", tone: "accent" },
  cancelled: { title: "Abo gekündigt", icon: "stornieren", tone: "red" },
  cancellation_scheduled: { title: "Kündigung vorgemerkt", icon: "kalender", tone: "red" },
  discount_changed: { title: "Rabatt geändert", icon: "rabatte", tone: "accent" },
  stock_missing: { title: "Lieferung verschoben (Bestand fehlt)", icon: "bestand", tone: "red" },
};

export function eventDisplay(kind: string): EventDisplay {
  return EVENT_DISPLAY[kind] ?? { title: kind.replace(/_/g, " "), icon: "notiz", tone: "default" };
}

export const CANCEL_KIND_LABEL: Record<string, string> = {
  ordinary: "ordentlich",
  extraordinary: "außerordentlich",
};

export const REQUEST_STATUS: Record<string, { label: string; tone: BadgeTone; hollow?: boolean }> =
  {
    received: { label: "Eingegangen", tone: "blue", hollow: true },
    matched: { label: "Zugeordnet", tone: "green" },
    unmatched: { label: "Ungeklärt", tone: "yellow" },
    resolved: { label: "Erledigt", tone: "gray" },
  };
