import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Status-Badge nach Figma (24:3082): 22 px hoch, Pill, Punkt plus Text (Farbe nie allein).
 * hollow zeigt einen Ring statt Punkt für wartende Zustände ("Offen", "Erstattung offen").
 * Die Töne entsprechen BadgeTone aus src/lib/admin/orders/status.ts, ergänzt um "accent" (Rollen).
 */
export type BadgeTone = "green" | "yellow" | "blue" | "red" | "gray" | "accent";

const TONES: Record<BadgeTone, { box: string; dot: string }> = {
  green: { box: "bg-admin-gruen-hell text-admin-gruen", dot: "bg-admin-gruen border-admin-gruen" },
  yellow: {
    box: "bg-admin-gelb-hell text-admin-gelb-text",
    dot: "bg-admin-gelb border-admin-gelb",
  },
  blue: { box: "bg-admin-blau-hell text-admin-blau", dot: "bg-admin-blau border-admin-blau" },
  red: { box: "bg-admin-rot-hell text-admin-rot", dot: "bg-admin-rot border-admin-rot" },
  gray: { box: "bg-admin-grau-hell text-admin-grau-text", dot: "bg-admin-grau border-admin-grau" },
  accent: {
    box: "bg-admin-akzent-hell text-admin-akzent",
    dot: "bg-admin-akzent border-admin-akzent",
  },
};

export interface BadgeProps {
  tone?: BadgeTone;
  hollow?: boolean;
  /** Ohne Punkt (zum Beispiel Zähler "4 Warnungen") */
  noDot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "gray", hollow, noDot, className, children }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span
      className={cx(
        "rounded-admin-badge inline-flex h-[22px] shrink-0 items-center gap-1.5 px-2 text-[12px] leading-[1.4] font-medium whitespace-nowrap",
        t.box,
        className,
      )}
    >
      {noDot ? null : (
        <span
          aria-hidden="true"
          className={cx(
            "size-[7px] shrink-0 rounded-full border-[1.5px]",
            hollow ? "border-current bg-transparent" : t.dot,
          )}
        />
      )}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Feste Status-Zuordnungen                                                                       */
/* ---------------------------------------------------------------------------------------------- */

export interface StatusDef {
  label: string;
  tone: BadgeTone;
  hollow?: boolean;
}

/** Bestellstatus (Enum order_status, Briefing 8: offen bis erstattet) */
export const ORDER_STATUS_BADGES: Record<string, StatusDef> = {
  pending: { label: "Offen", tone: "yellow", hollow: true },
  paid: { label: "Bezahlt", tone: "green" },
  processing: { label: "In Bearbeitung", tone: "yellow" },
  shipped: { label: "Versendet", tone: "blue" },
  delivered: { label: "Zugestellt", tone: "green" },
  cancelled: { label: "Storniert", tone: "red" },
  refunded: { label: "Erstattet", tone: "red", hollow: true },
  partially_refunded: { label: "Teilweise erstattet", tone: "yellow" },
};

/** Zahlstatus (Enum payment_status). Für Listen besser deriveOrderBadges (H16) verwenden. */
export const PAYMENT_STATUS_BADGES: Record<string, StatusDef> = {
  unpaid: { label: "Offen", tone: "yellow", hollow: true },
  authorized: { label: "Autorisiert", tone: "blue" },
  paid: { label: "Bezahlt", tone: "green" },
  partially_refunded: { label: "Teilweise erstattet", tone: "yellow" },
  refunded: { label: "Erstattet", tone: "red", hollow: true },
  failed: { label: "Fehlgeschlagen", tone: "red" },
};

/** Versandstatus (abgeleitet nach H16, Schlüssel wie deriveFulfilmentBadge) */
export const FULFILMENT_STATUS_BADGES: Record<string, StatusDef> = {
  open: { label: "Offen", tone: "yellow", hollow: true },
  processing: { label: "In Bearbeitung", tone: "yellow" },
  shipped: { label: "Versendet", tone: "blue" },
  delivered: { label: "Zugestellt", tone: "green" },
  returned: { label: "Retoure", tone: "gray" },
  cancelled: { label: "Storniert", tone: "red" },
  unfulfilled: { label: "Offen", tone: "yellow", hollow: true },
  partial: { label: "Teilweise versendet", tone: "blue" },
  fulfilled: { label: "Versendet", tone: "blue" },
};

/** Produkte, Kollektionen, Seiten, Kampagnen, Leads, Abos, Staff */
export const RECORD_STATUS_BADGES: Record<string, StatusDef> = {
  active: { label: "Aktiv", tone: "green" },
  draft: { label: "Entwurf", tone: "gray" },
  archived: { label: "Archiviert", tone: "gray", hollow: true },
  published: { label: "Veröffentlicht", tone: "green" },
  scheduled: { label: "Geplant", tone: "blue" },
  sending: { label: "Wird gesendet", tone: "blue" },
  sent: { label: "Gesendet", tone: "green" },
  failed: { label: "Fehlgeschlagen", tone: "red" },
  paused: { label: "Pausiert", tone: "yellow" },
  past_due: { label: "Zahlung offen", tone: "red" },
  inactive: { label: "Deaktiviert", tone: "gray", hollow: true },
  new: { label: "Neu", tone: "blue" },
  contacted: { label: "Kontaktiert", tone: "yellow" },
  qualified: { label: "Qualifiziert", tone: "accent" },
  won: { label: "Gewonnen", tone: "green" },
  lost: { label: "Verloren", tone: "gray" },
};

const MAPS = {
  order: ORDER_STATUS_BADGES,
  payment: PAYMENT_STATUS_BADGES,
  fulfilment: FULFILMENT_STATUS_BADGES,
  record: RECORD_STATUS_BADGES,
} as const;

export type StatusKind = keyof typeof MAPS;

/** Badge aus Statuswert: <StatusBadge kind="order" value="paid" /> */
export function StatusBadge({
  kind,
  value,
  className,
}: {
  kind: StatusKind;
  value: string;
  className?: string;
}) {
  const def = MAPS[kind][value] ?? { label: value, tone: "gray" as const };
  return (
    <Badge tone={def.tone} hollow={def.hollow} className={className}>
      {def.label}
    </Badge>
  );
}
