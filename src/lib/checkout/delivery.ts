/**
 * Zustellfenster: Bestelldatum plus 3 bis 5 Werktage (Montag bis Freitag), gerechnet im
 * Kalender von Europe/Berlin. Feiertage sind bewusst nicht berücksichtigt (bundeslandabhängig,
 * DHL stellt teils trotzdem zu); das Fenster ist als "voraussichtlich" gekennzeichnet.
 */
export const DELIVERY_MIN_BUSINESS_DAYS = 3;
export const DELIVERY_MAX_BUSINESS_DAYS = 5;
export const DELIVERY_TIME_TEXT = "3 bis 5 Werktage";

const TIME_ZONE = "Europe/Berlin";

/** Kalenderdatum (Jahr, Monat, Tag) eines Zeitpunkts in Berlin, als UTC-Mitternacht. */
export function berlinCalendarDate(instant: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** Werktage (Mo bis Fr) zu einem Kalenderdatum addieren. Start zählt nicht mit. */
export function addBusinessDays(calendarDate: Date, days: number): Date {
  const result = new Date(calendarDate.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}

export interface DeliveryWindow {
  /** Bestelldatum in Berlin (UTC-Mitternacht des Kalendertags) */
  orderDate: Date;
  earliest: Date;
  latest: Date;
}

export function deliveryWindow(
  placedAt: Date,
  minDays = DELIVERY_MIN_BUSINESS_DAYS,
  maxDays = DELIVERY_MAX_BUSINESS_DAYS,
): DeliveryWindow {
  const orderDate = berlinCalendarDate(placedAt);
  return {
    orderDate,
    earliest: addBusinessDays(orderDate, minDays),
    latest: addBusinessDays(orderDate, maxDays),
  };
}

const WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
const pad = (n: number) => String(n).padStart(2, "0");

/** "Sa., 17.10.2026" */
export function formatGermanDate(calendarDate: Date): string {
  return `${WEEKDAYS[calendarDate.getUTCDay()]}, ${pad(calendarDate.getUTCDate())}.${pad(
    calendarDate.getUTCMonth() + 1,
  )}.${calendarDate.getUTCFullYear()}`;
}

/** "Mi., 21.10. bis Fr., 23.10.2026"; über den Jahreswechsel mit beiden Jahreszahlen. */
export function formatDeliveryWindow(window: DeliveryWindow): string {
  const { earliest, latest } = window;
  const sameYear = earliest.getUTCFullYear() === latest.getUTCFullYear();
  const start = `${WEEKDAYS[earliest.getUTCDay()]}, ${pad(earliest.getUTCDate())}.${pad(
    earliest.getUTCMonth() + 1,
  )}.${sameYear ? "" : earliest.getUTCFullYear()}`;
  return `${start} bis ${formatGermanDate(latest)}`;
}
