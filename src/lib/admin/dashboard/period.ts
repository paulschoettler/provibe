/**
 * Zeiträume des Dashboards. Gerechnet wird in UTC, die Tagesgrenzen liegen aber in Europe/Berlin
 * (ein "Tag" im Backoffice ist der Berliner Kalendertag, auch über die Zeitumstellung).
 * Vergleichszeitraum: gleich lang, direkt davor.
 */
export const DASHBOARD_TZ = "Europe/Berlin";

export type PeriodKey = "heute" | "7" | "30" | "90" | "custom";

export interface Period {
  key: PeriodKey;
  /** inklusive, UTC */
  from: Date;
  /** exklusive, UTC */
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "hour" | "day";
  /** Berliner Kalendertage im Zeitraum (YYYY-MM-DD), für die Achse */
  days: string[];
  /** Anzeige "18.10. bis 24.10.2026" */
  label: string;
  prevLabel: string;
  /** Eingaben für das Formular (YYYY-MM-DD) */
  fromDay: string;
  toDay: string;
}

export const PERIOD_OPTIONS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "heute", label: "Heute" },
  { key: "7", label: "7 Tage" },
  { key: "30", label: "30 Tage" },
  { key: "90", label: "90 Tage" },
];

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DASHBOARD_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date) {
  const parts = partsFmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Versatz von Europe/Berlin zu UTC in Minuten zum Zeitpunkt date (60 oder 120). */
export function berlinOffsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Mitternacht eines Berliner Kalendertags als UTC-Zeitpunkt. */
export function berlinMidnight(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const off1 = berlinOffsetMinutes(new Date(guess));
  let t = guess - off1 * 60000;
  const off2 = berlinOffsetMinutes(new Date(t));
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

/** Berliner Kalendertag (YYYY-MM-DD) eines Zeitpunkts. */
export function berlinDay(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Berliner Stunde (0 bis 23) eines Zeitpunkts. */
export function berlinHour(date: Date): number {
  return zonedParts(date).hour;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDayExclusive: string): string[] {
  const out: string[] = [];
  for (let d = fromDay; d < toDayExclusive && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

function fmtDay(day: string, withYear: boolean): string {
  const [y, m, d] = day.split("-");
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}.`;
}

function rangeLabel(fromDay: string, lastDay: string): string {
  if (fromDay === lastDay) return fmtDay(fromDay, true);
  return `${fmtDay(fromDay, fromDay.slice(0, 4) !== lastDay.slice(0, 4))} bis ${fmtDay(lastDay, true)}`;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDay(value: string | undefined): string | null {
  if (!value || !DAY_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
    ? value
    : null;
}

/**
 * Zeitraum aus Suchparametern: ?zeitraum=heute|7|30|90 oder ?von=YYYY-MM-DD&bis=YYYY-MM-DD
 * (bis inklusive, höchstens 366 Tage, nicht in der Zukunft). Standard: 7 Tage.
 */
export function parsePeriod(
  params: { zeitraum?: string; von?: string; bis?: string },
  now: Date = new Date(),
): Period {
  const today = berlinDay(now);
  let key: PeriodKey = "7";
  let fromDay: string;
  let toDayExclusive: string;

  const von = validDay(params.von);
  const bis = validDay(params.bis);
  if (
    von &&
    bis &&
    params.zeitraum !== "heute" &&
    params.zeitraum !== "7" &&
    params.zeitraum !== "30" &&
    params.zeitraum !== "90"
  ) {
    key = "custom";
    let a = von <= bis ? von : bis;
    let b = von <= bis ? bis : von;
    if (b > today) b = today;
    if (a > b) a = b;
    if (daysBetween(a, addDays(b, 1)).length > 366) a = addDays(b, -365);
    fromDay = a;
    toDayExclusive = addDays(b, 1);
  } else {
    key =
      params.zeitraum === "heute" || params.zeitraum === "30" || params.zeitraum === "90"
        ? params.zeitraum
        : "7";
    const length = key === "heute" ? 1 : Number(key);
    fromDay = addDays(today, -(length - 1));
    toDayExclusive = addDays(today, 1);
  }

  const days = daysBetween(fromDay, toDayExclusive);
  const prevFromDay = addDays(fromDay, -days.length);
  return {
    key,
    from: berlinMidnight(fromDay),
    to: berlinMidnight(toDayExclusive),
    prevFrom: berlinMidnight(prevFromDay),
    prevTo: berlinMidnight(fromDay),
    bucket: days.length === 1 ? "hour" : "day",
    days,
    label: rangeLabel(fromDay, days[days.length - 1]),
    prevLabel: rangeLabel(prevFromDay, addDays(fromDay, -1)),
    fromDay,
    toDay: days[days.length - 1],
  };
}
