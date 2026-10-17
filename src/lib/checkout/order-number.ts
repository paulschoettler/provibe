/**
 * Nummernkreis der Bestellungen: PV-10001, PV-10002, ... Vergeben wird die Nummer in der
 * Datenbank (public.next_order_number(), Default von orders.order_number, Migration
 * 20261017104000). Diese Datei spiegelt das Format für Tests, Anzeige und Prüfungen.
 */
export const ORDER_NUMBER_PREFIX = "PV-";
export const ORDER_NUMBER_START = 10001;

const ORDER_NUMBER_PATTERN = /^PV-(\d{5,})$/;

/** Gleiches Format wie die SQL-Funktion: Präfix plus mindestens fünf Ziffern. */
export function formatOrderNumber(sequenceValue: number): string {
  if (!Number.isInteger(sequenceValue) || sequenceValue < 1) {
    throw new RangeError(`Ungültiger Wert für den Nummernkreis: ${sequenceValue}`);
  }
  return `${ORDER_NUMBER_PREFIX}${String(sequenceValue).padStart(5, "0")}`;
}

export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(value);
}

/** Laufende Nummer aus einer Bestellnummer, null bei fremdem Format (z.B. Shopify-Import "#1001"). */
export function parseOrderNumber(value: string): number | null {
  const match = ORDER_NUMBER_PATTERN.exec(value);
  return match ? Number(match[1]) : null;
}
