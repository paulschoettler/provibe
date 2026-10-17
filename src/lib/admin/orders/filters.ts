import { z } from "zod";
import { ORDER_STATUSES } from "./status";

/**
 * Filter der Bestellliste und des CSV-Exports. Wird in Server Actions und Seiten mit
 * parseOrderFilter aus searchParams gelesen; ungültige Werte fallen auf den Standard zurück.
 */

export const ORDER_SORTS = [
  "placed_desc",
  "placed_asc",
  "total_desc",
  "total_asc",
  "number_desc",
  "number_asc",
] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

/** Zahlarten für den Filter "Zahlart" (orders.payment_method_type). */
export const PAYMENT_METHOD_FILTERS = {
  card: "Karte",
  paypal: "PayPal",
  klarna: "Klarna",
  sepa_debit: "SEPA-Lastschrift",
  invoice: "Rechnung (manuell)",
} as const;
export type PaymentMethodFilter = keyof typeof PAYMENT_METHOD_FILTERS;

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, "Datum im Format JJJJ-MM-TT");

export const orderFilterSchema = z.object({
  status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
  paymentStatus: z
    .enum(["unpaid", "authorized", "paid", "partially_refunded", "refunded", "failed"])
    .optional(),
  fulfilmentStatus: z.enum(["unfulfilled", "partial", "fulfilled"]).optional(),
  paymentMethod: z.enum(Object.keys(PAYMENT_METHOD_FILTERS) as [string, ...string[]]).optional(),
  search: z.string().trim().max(120).optional(),
  /** inklusive, Datum oder Zeitstempel (UTC) */
  from: isoDate.optional(),
  /** inklusive; ein reines Datum gilt bis Tagesende (Europe/Berlin wird vom Aufrufer gewählt) */
  to: isoDate.optional(),
  /** Testbestellungen: include (Standard, markiert), only, exclude */
  test: z.enum(["include", "only", "exclude"]).default("include"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(ORDER_SORTS).default("placed_desc"),
  /** Auswahl aus der Liste (Sammelaktionen, CSV der Auswahl): kommagetrennte UUIDs, höchstens 500 */
  ids: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){0,499}$/i,
      "Ungültige Auswahl",
    )
    .optional(),
});

export type OrderFilterInput = z.input<typeof orderFilterSchema>;
export type OrderFilter = z.output<typeof orderFilterSchema> & {
  status?: (typeof ORDER_STATUSES)[number];
  paymentMethod?: PaymentMethodFilter;
};

/** Ausgewählte IDs aus dem Filter (leer ohne Auswahl). */
export function selectedIds(filter: Pick<OrderFilter, "ids">): string[] {
  return filter.ids ? [...new Set(filter.ids.split(",").map((v) => v.toLowerCase()))] : [];
}

/** Tolerant parsen: ungültige Einzelwerte werden verworfen statt die ganze Liste zu verweigern. */
export function parseOrderFilter(input: Record<string, unknown>): OrderFilter {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v === undefined || v === null || v === "" || v === "all") continue;
    cleaned[key] = v;
  }
  const shape = orderFilterSchema.shape;
  const accepted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleaned)) {
    const field = shape[key as keyof typeof shape];
    if (!field) continue;
    const parsed = field.safeParse(value);
    if (parsed.success) accepted[key] = parsed.data;
  }
  return orderFilterSchema.parse(accepted) as OrderFilter;
}

/**
 * Suchbegriff für PostgREST-Filter entschärfen: Zeichen mit Sonderbedeutung in or()/ilike
 * (Komma, Klammern, Stern, Prozent, Backslash, Doppelpunkt, Anführungszeichen) werden entfernt.
 */
export function sanitizeSearch(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .replace(/[,()*%\\:"'`;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export type SearchKind =
  { kind: "none" } | { kind: "order_number"; value: string } | { kind: "text"; value: string };

/** "10001", "PV-10001", "pv 10001" suchen nach der Nummer, alles andere als Text. */
export function classifySearch(raw: string | undefined | null): SearchKind {
  const value = sanitizeSearch(raw);
  if (!value) return { kind: "none" };
  const m = /^(?:#|pv[\s-]?)?(\d{3,})$/i.exec(value);
  if (m) return { kind: "order_number", value: m[1] };
  return { kind: "text", value };
}

/** Ende eines Zeitraums: reines Datum gilt bis 23:59:59.999 UTC dieses Tages. */
export function rangeEnd(to: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
}

export function rangeStart(from: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00.000Z` : from;
}

export function sortColumn(sort: OrderSort): { column: string; ascending: boolean } {
  switch (sort) {
    case "placed_asc":
      return { column: "placed_at", ascending: true };
    case "total_desc":
      return { column: "total_cents", ascending: false };
    case "total_asc":
      return { column: "total_cents", ascending: true };
    case "number_desc":
      return { column: "order_number", ascending: false };
    case "number_asc":
      return { column: "order_number", ascending: true };
    case "placed_desc":
    default:
      return { column: "placed_at", ascending: false };
  }
}
