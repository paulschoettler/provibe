import { REVIEW_TOKEN_TTL_DAYS } from "./limits";

/**
 * Reine Logik des Bewertungsmoduls (ohne Datenbank, ohne Next), damit sie mit Vitest prüfbar ist:
 * Token-Prüfung gegen Lauf und Bestellung, bewertbare Positionen, Namenskürzung, Aggregation.
 */

/* ------------------------------------------------------------------------------------------ */
/* Token gegen automation_run und Bestellung prüfen                                            */
/* ------------------------------------------------------------------------------------------ */

export interface TokenRun {
  automation_key: string;
  target_type: string;
  target_id: string;
  status: string;
  email: string;
  sent_at: string | null;
  created_at: string;
}

export interface TokenOrder {
  id: string;
  email: string;
  status: string;
  delivered_at: string | null;
}

export type TokenCheck =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "unknown" | "mismatch" | "expired" | "not_delivered" | "cancelled" };

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = new Set(["cancelled", "refunded"]);

/**
 * Ein Bewertungslink ist gültig, wenn
 * 1. der Lauf zur Automation review_request gehört, verschickt wurde und auf eine Bestellung zeigt,
 * 2. die Bestellung genau diese ist und an dieselbe E-Mail-Adresse ging,
 * 3. der Versand höchstens 60 Tage her ist,
 * 4. die Bestellung zugestellt und weder storniert noch voll erstattet ist.
 */
export function checkReviewToken(input: {
  run: TokenRun | null;
  order: TokenOrder | null;
  now: Date;
  ttlDays?: number;
}): TokenCheck {
  const { run, order, now } = input;
  if (!run || run.status !== "sent") return { ok: false, reason: "unknown" };
  if (run.automation_key !== "review_request" || run.target_type !== "order") {
    return { ok: false, reason: "mismatch" };
  }
  if (!order || order.id !== run.target_id) return { ok: false, reason: "mismatch" };
  if (order.email.trim().toLowerCase() !== run.email.trim().toLowerCase()) {
    return { ok: false, reason: "mismatch" };
  }
  const issued = new Date(run.sent_at ?? run.created_at);
  if (Number.isNaN(issued.getTime())) return { ok: false, reason: "unknown" };
  const expiresAt = new Date(issued.getTime() + (input.ttlDays ?? REVIEW_TOKEN_TTL_DAYS) * DAY_MS);
  if (now.getTime() > expiresAt.getTime()) return { ok: false, reason: "expired" };
  if (CLOSED_STATUSES.has(order.status)) return { ok: false, reason: "cancelled" };
  if (!order.delivered_at && order.status !== "delivered") {
    return { ok: false, reason: "not_delivered" };
  }
  return { ok: true, expiresAt };
}

/* ------------------------------------------------------------------------------------------ */
/* Bewertbare Positionen                                                                       */
/* ------------------------------------------------------------------------------------------ */

export interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_handle: string | null;
  product_title: string;
  variant_title: string | null;
  image_path: string | null;
  quantity: number;
  position: number;
}

export interface ReviewableItem {
  productId: string;
  /** Erste Position dieses Produkts (reviews.order_item_id) */
  orderItemId: string;
  handle: string | null;
  title: string;
  variantTitles: string[];
  imagePath: string | null;
}

/** Zeilen, die kein Produkt sind (Pfand, Versand), falls ein Import sie als Position anlegt. */
const NON_PRODUCT = /\b(pfand|versand|shipping|deposit|porto)\b/i;

/**
 * Je Produkt eine Bewertung: Positionen ohne Produkt (gelöscht), Pfand- und Versandzeilen fallen
 * weg, mehrere Varianten desselben Produkts werden zusammengefasst. Bundles stehen in order_items
 * mit der Produkt-ID des Bundles und werden deshalb als Bundle bewertet, nicht je Komponente.
 */
export function reviewableItems(items: OrderItemRow[]): ReviewableItem[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const byProduct = new Map<string, ReviewableItem>();
  for (const item of sorted) {
    if (!item.product_id || item.quantity <= 0) continue;
    if (NON_PRODUCT.test(item.product_title) || NON_PRODUCT.test(item.product_handle ?? "")) {
      continue;
    }
    const existing = byProduct.get(item.product_id);
    if (existing) {
      if (item.variant_title && !existing.variantTitles.includes(item.variant_title)) {
        existing.variantTitles.push(item.variant_title);
      }
      continue;
    }
    byProduct.set(item.product_id, {
      productId: item.product_id,
      orderItemId: item.id,
      handle: item.product_handle,
      title: item.product_title,
      variantTitles: item.variant_title ? [item.variant_title] : [],
      imagePath: item.image_path,
    });
  }
  return [...byProduct.values()];
}

/* ------------------------------------------------------------------------------------------ */
/* Anzeigename                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export const ANONYMOUS_AUTHOR = "Kundin oder Kunde";

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function capitalize(word: string): string {
  return word ? word.charAt(0).toLocaleUpperCase("de-DE") + word.slice(1) : word;
}

/**
 * Vorname plus Initial des Nachnamens ("Lena M."). Bei Namenszusätzen ("von Müller", "de la Cruz")
 * zählt das letzte großgeschriebene Wort, damit die Initiale den eigentlichen Familiennamen trifft.
 */
export function shortAuthorName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = capitalize(clean(firstName)).slice(0, 40);
  const lastWords = clean(lastName).split(" ").filter(Boolean);
  const main =
    [...lastWords].reverse().find((w) => /^\p{Lu}/u.test(w)) ?? lastWords[lastWords.length - 1];
  const initialChar = main ? (main.match(/\p{L}/u)?.[0] ?? "") : "";
  const initial = initialChar ? `${initialChar.toLocaleUpperCase("de-DE")}.` : "";
  const name = [first, initial].filter(Boolean).join(" ");
  return name || ANONYMOUS_AUTHOR;
}

/* ------------------------------------------------------------------------------------------ */
/* Aggregation                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface RatingSummary {
  count: number;
  /** Exakter Durchschnitt, null ohne Bewertung */
  average: number | null;
  /** Auf eine Nachkommastelle gerundet, für Anzeige und JSON-LD */
  averageRounded: number | null;
  /** Anzahl je Sternzahl */
  distribution: Record<RatingValue, number>;
}

export function aggregateRatings(ratings: number[]): RatingSummary {
  const distribution: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const r of ratings) {
    if (!Number.isInteger(r) || r < 1 || r > 5) continue;
    distribution[r as RatingValue] += 1;
    sum += r;
    count += 1;
  }
  const average = count ? sum / count : null;
  return {
    count,
    average,
    averageRounded: average === null ? null : Math.round(average * 10) / 10,
    distribution,
  };
}

/** Durchschnitt in deutscher Schreibweise ("4,7"). */
export function formatAverage(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Kurztext zur gewählten Sternzahl (Formular). */
export const RATING_LABELS: Record<RatingValue, string> = {
  1: "Nicht mein Ding",
  2: "Geht so",
  3: "Okay",
  4: "Richtig gut",
  5: "Mein Vibe",
};

export function starsLabel(n: number): string {
  return `${n} von 5 Sternen`;
}

/** Datum für die Anzeige (Zeitzone Berlin), zum Beispiel "14.10.2026". */
export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

/** Datum für JSON-LD (YYYY-MM-DD, Zeitzone Berlin). */
export function isoDateBerlin(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}
