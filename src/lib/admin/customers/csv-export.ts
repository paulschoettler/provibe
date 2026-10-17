/**
 * CSV-Export der Kundenliste (Excel-tauglich: Semikolon, UTF-8 mit BOM, Beträge mit Komma).
 * Schutz vor Formel-Injection: Zellen, die mit = + - @ beginnen, bekommen ein Apostroph davor.
 * Rein, getestet in csv-export.test.ts.
 */

export interface CustomerCsvRow {
  id: string;
  name: string;
  email: string;
  customerType: string;
  companyName: string | null;
  ordersCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  createdAt: string;
  newsletterStatus: string;
  tags: string[];
  accountStatus: string;
  acquisitionSource: string | null;
}

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function euro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export const CUSTOMER_CSV_HEADER = [
  "ID",
  "Name",
  "E-Mail",
  "Kundentyp",
  "Firma",
  "Bestellungen",
  "Umsatz (EUR)",
  "Letzte Bestellung",
  "Kunde seit",
  "Newsletter",
  "Tags",
  "Konto",
  "Akquisequelle",
];

export function customersToCsv(rows: CustomerCsvRow[]): string {
  const lines = [CUSTOMER_CSV_HEADER.map(csvCell).join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.name,
        r.email,
        r.customerType.toUpperCase(),
        r.companyName,
        r.ordersCount,
        euro(r.totalSpentCents),
        day(r.lastOrderAt),
        day(r.createdAt),
        r.newsletterStatus,
        r.tags.join(", "),
        r.accountStatus,
        r.acquisitionSource,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
