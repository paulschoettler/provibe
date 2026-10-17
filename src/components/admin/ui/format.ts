/**
 * Anzeigeformate im Backoffice. Gespeichert wird in UTC, angezeigt in Europe/Berlin.
 * Geld kommt immer als Cent-Integer und wird nur hier (über formatEur) formatiert.
 */
import { formatEur } from "@/lib/money";

export const ADMIN_TIME_ZONE = "Europe/Berlin";

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: ADMIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});
const numberFmt = new Intl.NumberFormat("de-DE");
const percentFmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 17.10.2026 */
export function formatDate(value: DateInput, fallback = "–"): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

/** 17.10.2026, 09:12 */
export function formatDateTime(value: DateInput, fallback = "–"): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
}

/** 17.10. */
export function formatShortDate(value: DateInput, fallback = "–"): string {
  const d = toDate(value);
  return d ? `${shortDateFmt.format(d)}` : fallback;
}

/** 1.234 */
export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

/** 12,4 % (Wert in Prozent, nicht als Anteil) */
export function formatPercent(value: number): string {
  return `${percentFmt.format(value)} %`;
}

/** Geldbetrag aus Cent */
export function formatMoney(cents: number): string {
  return formatEur(cents);
}

/** Zeitpunkt für <time dateTime> */
export function isoOrUndefined(value: DateInput): string | undefined {
  return toDate(value)?.toISOString();
}
