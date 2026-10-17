import { berlinDay, berlinHour, type Period } from "./period";

/**
 * Kennzahlen des Dashboards als reine Funktionen (getestet in dashboard.test.ts).
 * Zählende Bestellungen: bezahlt oder teilweise erstattet, nicht storniert, keine Testbestellung
 * (dieselbe Regel wie refresh_customer_stats). Umsatz = Summe total_cents (brutto inkl. Versand
 * und Pfand, vor Teilerstattungen).
 */
export interface MetricOrder {
  id: string;
  placed_at: string;
  total_cents: number;
  email: string;
}

export interface Summary {
  revenueCents: number;
  orders: number;
  aovCents: number;
}

export function summarize(orders: MetricOrder[]): Summary {
  const revenueCents = orders.reduce((s, o) => s + o.total_cents, 0);
  return {
    revenueCents,
    orders: orders.length,
    aovCents: orders.length ? Math.round(revenueCents / orders.length) : 0,
  };
}

export interface Delta {
  text: string;
  direction: "up" | "down" | "flat";
}

const pct = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Veränderung in Prozent. Ohne Vergleichswert (0) gibt es keine sinnvolle Prozentangabe: null. */
export function percentDelta(current: number, previous: number): Delta | null {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return { text: "±0,0 %", direction: "flat" };
  return {
    text: `${rounded > 0 ? "+" : "−"}${pct.format(Math.abs(rounded))} %`,
    direction: rounded > 0 ? "up" : "down",
  };
}

export function splitByPeriod<T extends { placed_at: string }>(rows: T[], period: Period) {
  const from = period.from.getTime();
  const to = period.to.getTime();
  const prevFrom = period.prevFrom.getTime();
  const current: T[] = [];
  const previous: T[] = [];
  for (const r of rows) {
    const t = new Date(r.placed_at).getTime();
    if (t >= from && t < to) current.push(r);
    else if (t >= prevFrom && t < from) previous.push(r);
  }
  return { current, previous };
}

export interface SeriesPoint {
  key: string;
  label: string;
  current: number;
  previous: number;
}

const WEEKDAY = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Umsatz je Tag (bzw. je Stunde bei einem Tag), Vorzeitraum auf dieselben Positionen gelegt. */
export function revenueSeries(
  current: MetricOrder[],
  previous: MetricOrder[],
  period: Period,
): SeriesPoint[] {
  if (period.bucket === "hour") {
    const points: SeriesPoint[] = Array.from({ length: 24 }, (_, h) => ({
      key: String(h),
      label: `${String(h).padStart(2, "0")}:00`,
      current: 0,
      previous: 0,
    }));
    for (const o of current) points[berlinHour(new Date(o.placed_at))].current += o.total_cents;
    for (const o of previous) points[berlinHour(new Date(o.placed_at))].previous += o.total_cents;
    return points;
  }
  const index = new Map(period.days.map((d, i) => [d, i]));
  const prevStartDay = berlinDay(period.prevFrom);
  const prevIndex = (day: string) => {
    const a = Date.UTC(
      +prevStartDay.slice(0, 4),
      +prevStartDay.slice(5, 7) - 1,
      +prevStartDay.slice(8, 10),
    );
    const b = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
    return Math.round((b - a) / 86_400_000);
  };
  const points: SeriesPoint[] = period.days.map((d) => {
    const date = new Date(`${d}T12:00:00Z`);
    const label =
      period.days.length <= 7
        ? `${WEEKDAY[date.getUTCDay()]} ${Number(d.slice(8, 10))}.`
        : `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
    return { key: d, label, current: 0, previous: 0 };
  });
  for (const o of current) {
    const i = index.get(berlinDay(new Date(o.placed_at)));
    if (i !== undefined) points[i].current += o.total_cents;
  }
  for (const o of previous) {
    const i = prevIndex(berlinDay(new Date(o.placed_at)));
    if (i >= 0 && i < points.length) points[i].previous += o.total_cents;
  }
  return points;
}

export interface CustomerSplit {
  total: number;
  newCustomers: { orders: number; revenueCents: number };
  returning: { orders: number; revenueCents: number };
}

/**
 * Neu- gegen Bestandskunden nach Bestellungen im Zeitraum. Eine Bestellung ist "neu", wenn es die
 * erste zählende Bestellung dieser E-Mail-Adresse überhaupt ist. priorEmails: Adressen mit einer
 * zählenden Bestellung vor dem Zeitraum (kleingeschrieben).
 */
export function splitNewReturning(orders: MetricOrder[], priorEmails: Set<string>): CustomerSplit {
  const seen = new Set(priorEmails);
  const sorted = [...orders].sort((a, b) => a.placed_at.localeCompare(b.placed_at));
  const out: CustomerSplit = {
    total: orders.length,
    newCustomers: { orders: 0, revenueCents: 0 },
    returning: { orders: 0, revenueCents: 0 },
  };
  for (const o of sorted) {
    const email = o.email.toLowerCase();
    const bucket = seen.has(email) ? out.returning : out.newCustomers;
    bucket.orders += 1;
    bucket.revenueCents += o.total_cents;
    seen.add(email);
  }
  return out;
}

export interface MetricItem {
  product_id: string | null;
  product_title: string;
  quantity: number;
  line_total_cents: number;
}

export interface TopProduct {
  productId: string | null;
  title: string;
  quantity: number;
  revenueCents: number;
}

/** Top-Produkte nach Umsatz (Positionen zusammengefasst je Produkt, Rabatte sind enthalten). */
export function topProducts(items: MetricItem[], limit = 5): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const it of items) {
    const key = it.product_id ?? `titel:${it.product_title}`;
    const entry = map.get(key) ?? {
      productId: it.product_id,
      title: it.product_title,
      quantity: 0,
      revenueCents: 0,
    };
    entry.quantity += it.quantity;
    entry.revenueCents += it.line_total_cents;
    map.set(key, entry);
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        b.quantity - a.quantity ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

export interface StockLevel {
  variantId: string;
  title: string;
  onHand: number;
  reserved: number;
  threshold: number;
}

export interface LowStockItem extends StockLevel {
  available: number;
  soldOut: boolean;
}

/** Varianten mit verfügbarem Bestand bis zur Warnschwelle, ausverkaufte zuerst, dann knappste. */
export function lowStock(levels: StockLevel[], limit = 6): LowStockItem[] {
  return levels
    .map((l) => {
      const available = l.onHand - l.reserved;
      return { ...l, available, soldOut: available <= 0 };
    })
    .filter((l) => l.available <= l.threshold)
    .sort(
      (a, b) =>
        Number(b.soldOut) - Number(a.soldOut) ||
        a.available - b.available ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/** Achsenmaximum: nächste "runde" Zahl über dem Höchstwert (für 4 Hilfslinien). */
export function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 4, 5, 10]) {
    const candidate = step * exp;
    if (candidate >= value) return candidate;
  }
  return 10 * exp;
}
