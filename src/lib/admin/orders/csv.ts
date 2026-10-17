/**
 * CSV für Excel in deutscher Einstellung: UTF-8 mit BOM, Semikolon als Trenner, CRLF,
 * Dezimalkomma ohne Tausenderpunkt, Datum TT.MM.JJJJ HH:MM in Europe/Berlin.
 * Textzellen, die mit =, +, -, @ beginnen, bekommen ein Hochkomma vorangestellt (CSV-Injection).
 */

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

export type CsvCell = string | number | boolean | null | undefined | { cents: number };

/** 6190 → "61,90"; −250 → "-2,50" */
export function formatCentsDe(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const berlin = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO-Zeitstempel (UTC) → "17.10.2026 14:31" (Europe/Berlin) */
export function formatDateTimeDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return berlin.format(d).replace(",", "");
}

function cellText(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") return formatCentsDe(cell.cents);
  if (typeof cell === "boolean") return cell ? "ja" : "nein";
  if (typeof cell === "number") return String(cell).replace(".", ",");
  if (/^[=+\-@\t\r]/.test(cell)) return `'${cell}`;
  return cell;
}

export function escapeCsvCell(cell: CsvCell): string {
  const text = cellText(cell);
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCsvCell).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/** Eine Zeile des Bestellexports (vorbereitet in export.ts). */
export interface OrderCsvRow {
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentBadge: string;
  fulfilmentBadge: string;
  customerName: string;
  email: string;
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  depositCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  paymentMethod: string;
  invoiceNumber: string | null;
  trackingNumbers: string;
  postalCode: string;
  city: string;
  country: string;
  source: string;
  isTest: boolean;
}

export const ORDER_CSV_HEADER = [
  "Bestellnummer",
  "Datum",
  "Status",
  "Zahlstatus",
  "Versandstatus",
  "Kunde",
  "E-Mail",
  "Positionen",
  "Zwischensumme (EUR, ohne Pfand)",
  "Rabatt (EUR)",
  "Rabattcode",
  "Pfand (EUR)",
  "Versand (EUR)",
  "enthaltene MwSt. (EUR)",
  "Gesamt (EUR)",
  "Erstattet (EUR)",
  "Zahlart",
  "Rechnungsnummer",
  "Trackingnummer",
  "PLZ",
  "Ort",
  "Land",
  "Quelle",
  "Testbestellung",
];

export function buildOrdersCsv(rows: OrderCsvRow[]): string {
  return toCsv(
    ORDER_CSV_HEADER,
    rows.map((r) => [
      r.orderNumber,
      formatDateTimeDe(r.placedAt),
      r.status,
      r.paymentBadge,
      r.fulfilmentBadge,
      r.customerName,
      r.email,
      r.itemCount,
      { cents: r.subtotalCents },
      { cents: r.discountCents },
      r.discountCode,
      { cents: r.depositCents },
      { cents: r.shippingCents },
      { cents: r.taxCents },
      { cents: r.totalCents },
      { cents: r.refundedCents },
      r.paymentMethod,
      r.invoiceNumber,
      r.trackingNumbers,
      r.postalCode,
      r.city,
      r.country,
      r.source,
      r.isTest,
    ]),
  );
}
