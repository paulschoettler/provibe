import { addDays, berlinDay, berlinMidnight } from "@/lib/admin/dashboard/period";
import type { OrderFilterInput, OrderSort } from "./filters";
import type { OrderStatus } from "./status";

/**
 * Suchparameter der Bestellliste (/admin/bestellungen) in einen OrderFilter übersetzen. Eine Stelle
 * für Seite, CSV-Export und Lieferschein-Sammeldruck, damit "CSV des Filters" exakt die Liste ist.
 * Reine Funktionen (getestet in url.test.ts). Zeiträume gelten in Europe/Berlin.
 *
 * Parameter: tab (offen, bezahlt, in-bearbeitung, versendet, zugestellt, erstattet, storniert, test),
 * q, zeitraum (heute, 7, 30, 90, monat, vormonat, eigener), von, bis (JJJJ-MM-TT), zahlart, sort, dir,
 * seite, ids (Auswahl, mehrfach oder kommagetrennt).
 */

export type ListParams = Record<string, string | string[] | undefined>;

export const ORDER_TABS = [
  { key: "alle", label: "Alle", status: null },
  { key: "offen", label: "Offen", status: "pending" },
  { key: "bezahlt", label: "Bezahlt", status: "paid" },
  { key: "in-bearbeitung", label: "In Bearbeitung", status: "processing" },
  { key: "versendet", label: "Versendet", status: "shipped" },
  { key: "zugestellt", label: "Zugestellt", status: "delivered" },
  { key: "erstattet", label: "Erstattet", status: "refunded" },
  { key: "storniert", label: "Storniert", status: "cancelled" },
  { key: "test", label: "Test", status: null },
] as const satisfies readonly { key: string; label: string; status: OrderStatus | null }[];

export type OrderTabKey = (typeof ORDER_TABS)[number]["key"];

export const PERIODS = [
  { value: "heute", label: "Heute" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
  { value: "monat", label: "Dieser Monat" },
  { value: "vormonat", label: "Letzter Monat" },
  { value: "eigener", label: "Eigener Zeitraum" },
] as const;

/** Spaltenschlüssel der Tabelle → Sortierung des Filters */
const SORT_KEYS = { datum: "placed", nummer: "number", gesamt: "total" } as const;
export type SortKey = keyof typeof SORT_KEYS;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function tabFrom(params: ListParams): OrderTabKey {
  const raw = first(params.tab);
  return (ORDER_TABS.find((t) => t.key === raw)?.key ?? "alle") as OrderTabKey;
}

/** Zeitraum als [von, bis) in UTC-ISO; null ohne Einschränkung. */
export function periodRange(
  params: ListParams,
  now: Date = new Date(),
): { from: string; to: string } | null {
  const period = first(params.zeitraum);
  const today = berlinDay(now);
  let fromDay: string | null = null;
  let toDayExclusive: string | null = null;
  switch (period) {
    case "heute":
      fromDay = today;
      toDayExclusive = addDays(today, 1);
      break;
    case "7":
    case "30":
    case "90":
      fromDay = addDays(today, -(Number(period) - 1));
      toDayExclusive = addDays(today, 1);
      break;
    case "monat":
      fromDay = `${today.slice(0, 7)}-01`;
      toDayExclusive = addDays(today, 1);
      break;
    case "vormonat": {
      const monthStart = `${today.slice(0, 7)}-01`;
      const prev = addDays(monthStart, -1);
      fromDay = `${prev.slice(0, 7)}-01`;
      toDayExclusive = monthStart;
      break;
    }
    default: {
      const von = first(params.von);
      const bis = first(params.bis);
      if (von && DAY.test(von)) fromDay = von;
      if (bis && DAY.test(bis)) toDayExclusive = addDays(bis, 1);
      if (!fromDay && !toDayExclusive) return null;
      fromDay = fromDay ?? "2000-01-01";
      toDayExclusive = toDayExclusive ?? addDays(today, 1);
    }
  }
  const from = berlinMidnight(fromDay).toISOString();
  // Filter "to" ist inklusive: eine Millisekunde vor Mitternacht des Folgetags
  const to = new Date(berlinMidnight(toDayExclusive).getTime() - 1).toISOString();
  return { from, to };
}

export function sortFrom(params: ListParams): { key: SortKey; dir: "asc" | "desc" } {
  const key = first(params.sort);
  const dir = first(params.dir) === "asc" ? "asc" : "desc";
  return { key: key && key in SORT_KEYS ? (key as SortKey) : "datum", dir };
}

/** Ausgewählte Bestellungen aus ids (mehrfach oder kommagetrennt), nur gültige UUIDs. */
export function idsFrom(params: ListParams): string[] {
  const raw = params.ids;
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(","));
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => UUID.test(v)))].slice(
    0,
    500,
  );
}

/**
 * Filter für listOrders und exportOrdersCsv. Testbestellungen sind ausgeblendet, außer im Tab
 * "Test" (nur Testbestellungen) oder bei einer expliziten Auswahl.
 */
export function filterFromParams(
  params: ListParams,
  options: { pageSize?: number; now?: Date; ignoreSelection?: boolean } = {},
): OrderFilterInput & { ids?: string } {
  const tab = ORDER_TABS.find((t) => t.key === tabFrom(params))!;
  const { key, dir } = sortFrom(params);
  const range = periodRange(params, options.now);
  const page = Number(first(params.seite));
  const ids = options.ignoreSelection ? [] : idsFrom(params);
  const zahlart = first(params.zahlart);
  return {
    status: tab.status ?? undefined,
    test: ids.length > 0 ? "include" : tab.key === "test" ? "only" : "exclude",
    search: first(params.q)?.trim() || undefined,
    paymentMethod: zahlart || undefined,
    from: range?.from,
    to: range?.to,
    sort: `${SORT_KEYS[key]}_${dir}` as OrderSort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: options.pageSize ?? 25,
    ...(ids.length > 0 ? { ids: ids.join(",") } : {}),
  } as OrderFilterInput & { ids?: string };
}
