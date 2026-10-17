import { z } from "zod";
import { formatEur } from "@/lib/money";

/**
 * Regel-DSL für Kundensegmente und ihre sichere Übersetzung nach SQL.
 *
 * Eine Regel ist JSON: { match: "all" | "any", conditions: [{ field, op, value }] }.
 * Sicherheit (ADR-Vorschlag im Bericht):
 *   - Felder und Operatoren stammen aus einer festen Whitelist (Zod), alles andere wird abgelehnt.
 *   - Der SQL-Text entsteht nur aus festen Bausteinen dieser Datei. Werte landen nie im SQL-Text,
 *     sondern in einem jsonb-Array, das die Datenbankfunktion als $1 bindet ($1->>n).
 *   - Die Datenbankfunktionen (Migration 20261017204000) prüfen den Text zusätzlich und laufen
 *     als STABLE, also nur lesend.
 * Reine Funktionen ohne Datenbank, getestet in rules.test.ts.
 */

export const NUMBER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export const DATE_OPS = [
  "older_than_days",
  "within_days",
  "before",
  "after",
  "is_empty",
  "is_not_empty",
] as const;
export const NEWSLETTER_SEGMENT_STATUSES = [
  "subscribed",
  "pending",
  "unsubscribed",
  "bounced",
  "complained",
  "none",
] as const;

export type NumberOp = (typeof NUMBER_OPS)[number];
export type DateOp = (typeof DATE_OPS)[number];
export type NewsletterSegmentStatus = (typeof NEWSLETTER_SEGMENT_STATUSES)[number];

const MSG_NUMBER = "Bitte gib eine ganze Zahl ab 0 ein.";
const intValue = z.coerce.number({ error: MSG_NUMBER }).int(MSG_NUMBER).min(0, MSG_NUMBER);
const days = intValue.max(36500, "Höchstens 36500 Tage.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Ungültiges Datum.");
const shortText = (max: number) =>
  z.string().trim().min(1, "Bitte gib einen Wert ein.").max(max, `Höchstens ${max} Zeichen.`);

const numberCondition = <F extends string>(field: F, max: number) =>
  z.object({
    field: z.literal(field),
    op: z.enum(NUMBER_OPS),
    value: intValue.max(max, `Höchstens ${max}.`),
  });

const dateCondition = <F extends string>(field: F) =>
  z.union([
    z.object({
      field: z.literal(field),
      op: z.enum(["older_than_days", "within_days"]),
      value: days,
    }),
    z.object({ field: z.literal(field), op: z.enum(["before", "after"]), value: isoDate }),
    z.object({
      field: z.literal(field),
      op: z.enum(["is_empty", "is_not_empty"]),
      value: z
        .unknown()
        .optional()
        .transform(() => undefined),
    }),
  ]);

export const segmentConditionSchema = z.union([
  numberCondition("orders_count", 1_000_000),
  numberCondition("total_spent_cents", 1_000_000_000),
  dateCondition("last_order"),
  dateCondition("first_order"),
  z.object({
    field: z.literal("purchased_product"),
    op: z.enum(["is", "is_not"]),
    value: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Bitte wähle ein Produkt.")
      .max(120),
  }),
  z.object({
    field: z.literal("newsletter_status"),
    op: z.enum(["is", "is_not"]),
    value: z.enum(NEWSLETTER_SEGMENT_STATUSES),
  }),
  z.object({
    field: z.literal("tag"),
    op: z.enum(["has", "has_not"]),
    value: shortText(50),
  }),
  z.union([
    z.object({
      field: z.literal("acquisition_source"),
      op: z.enum(["is", "is_not", "contains"]),
      value: shortText(100),
    }),
    z.object({
      field: z.literal("acquisition_source"),
      op: z.enum(["is_empty", "is_not_empty"]),
      value: z
        .unknown()
        .optional()
        .transform(() => undefined),
    }),
  ]),
  z.object({
    field: z.literal("postal_code_prefix"),
    op: z.enum(["starts_with", "not_starts_with"]),
    value: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z]{1,5}$/, "PLZ-Anfang mit 1 bis 5 Zeichen."),
  }),
  z.object({
    field: z.literal("customer_type"),
    op: z.literal("is"),
    value: z.enum(["b2c", "b2b"]),
  }),
]);

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;
export type SegmentField = SegmentCondition["field"];

export const segmentRulesSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(segmentConditionSchema).max(20, "Höchstens 20 Bedingungen."),
});

export type SegmentRules = z.infer<typeof segmentRulesSchema>;

/** Interne Bedingungen der Kundenliste (nicht speicherbar): Freitextsuche, Sperrstatus. */
export type InternalCondition =
  | { field: "search"; op: "matches"; value: string }
  | { field: "blocked"; op: "is"; value: boolean };

export interface SegmentSql {
  /** WHERE-Bedingung über Alias c (public.customers), Werte nur als ($1->>n) */
  where: string;
  /** Werte in der Reihenfolge der Platzhalter, als jsonb-Array an die Datenbank */
  params: (string | number)[];
}

/** Für Anzeige und Editor: Felder mit Beschriftung, Operatoren und Werttyp. */
export const SEGMENT_FIELDS: Record<
  SegmentField,
  {
    label: string;
    ops: Partial<Record<string, string>>;
    valueType: "number" | "cents" | "days_or_date" | "product" | "enum" | "text" | "none";
  }
> = {
  orders_count: {
    label: "Bestellungen",
    ops: { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" },
    valueType: "number",
  },
  total_spent_cents: {
    label: "Umsatz",
    ops: { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" },
    valueType: "cents",
  },
  last_order: {
    label: "Letzte Bestellung",
    ops: {
      older_than_days: "vor mehr als",
      within_days: "innerhalb der letzten",
      before: "vor dem",
      after: "nach dem",
      is_empty: "noch nie",
      is_not_empty: "vorhanden",
    },
    valueType: "days_or_date",
  },
  first_order: {
    label: "Erste Bestellung",
    ops: {
      older_than_days: "vor mehr als",
      within_days: "innerhalb der letzten",
      before: "vor dem",
      after: "nach dem",
      is_empty: "noch nie",
      is_not_empty: "vorhanden",
    },
    valueType: "days_or_date",
  },
  purchased_product: {
    label: "Hat Produkt gekauft",
    ops: { is: "ist", is_not: "ist nicht" },
    valueType: "product",
  },
  newsletter_status: {
    label: "Newsletter-Status",
    ops: { is: "ist", is_not: "ist nicht" },
    valueType: "enum",
  },
  tag: { label: "Tag", ops: { has: "hat", has_not: "hat nicht" }, valueType: "text" },
  acquisition_source: {
    label: "Akquisequelle",
    ops: {
      is: "ist",
      is_not: "ist nicht",
      contains: "enthält",
      is_empty: "unbekannt",
      is_not_empty: "bekannt",
    },
    valueType: "text",
  },
  postal_code_prefix: {
    label: "PLZ beginnt mit",
    ops: { starts_with: "beginnt mit", not_starts_with: "beginnt nicht mit" },
    valueType: "text",
  },
  customer_type: { label: "Kundentyp", ops: { is: "ist" }, valueType: "enum" },
};

export const NEWSLETTER_STATUS_LABELS: Record<NewsletterSegmentStatus, string> = {
  subscribed: "abonniert",
  pending: "unbestätigt",
  unsubscribed: "abgemeldet",
  bounced: "unzustellbar",
  complained: "beschwert",
  none: "kein Kontakt",
};

const SQL_NUMBER_OPS: Record<NumberOp, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

/** Bezahlte, nicht stornierte Echtbestellungen (wie refresh_customer_stats). */
const PAID_ORDER = `o.payment_status in ('paid', 'partially_refunded') and o.status <> 'cancelled' and not o.is_test`;

const NEWSLETTER_STATUS_SQL = `coalesce((select n.status::text from public.newsletter_contacts n where n.customer_id = c.id or n.email = c.email order by (n.customer_id = c.id) desc limit 1), 'none')`;

class ParamBuilder {
  readonly params: (string | number)[] = [];
  /** Wert anhängen und Platzhalter zurückgeben, optional mit festem Cast aus der Whitelist. */
  add(value: string | number, cast?: "integer" | "bigint" | "date"): string {
    this.params.push(value);
    const ref = `($1->>${this.params.length - 1})`;
    return cast ? `${ref}::${cast}` : ref;
  }
}

function dateSql(
  column: "c.last_order_at" | "c.first_order_at",
  cond: { op: DateOp; value?: unknown },
  b: ParamBuilder,
): string {
  switch (cond.op) {
    case "older_than_days":
      return `${column} < now() - make_interval(days => ${b.add(Number(cond.value), "integer")})`;
    case "within_days":
      return `${column} >= now() - make_interval(days => ${b.add(Number(cond.value), "integer")})`;
    case "before":
      return `${column} < (${b.add(String(cond.value), "date")})::timestamp at time zone 'Europe/Berlin'`;
    case "after":
      return `${column} >= (${b.add(String(cond.value), "date")} + 1)::timestamp at time zone 'Europe/Berlin'`;
    case "is_empty":
      return `${column} is null`;
    case "is_not_empty":
      return `${column} is not null`;
  }
}

function conditionSql(cond: SegmentCondition | InternalCondition, b: ParamBuilder): string {
  switch (cond.field) {
    case "orders_count":
      return `c.orders_count ${SQL_NUMBER_OPS[cond.op]} ${b.add(cond.value, "integer")}`;
    case "total_spent_cents":
      return `c.total_spent_cents ${SQL_NUMBER_OPS[cond.op]} ${b.add(cond.value, "bigint")}`;
    case "last_order":
      return dateSql("c.last_order_at", cond, b);
    case "first_order":
      return dateSql("c.first_order_at", cond, b);
    case "purchased_product": {
      const h = b.add(cond.value);
      const sql =
        `exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id ` +
        `where o.customer_id = c.id and ${PAID_ORDER} and (oi.product_handle = ${h} or exists (` +
        `select 1 from jsonb_array_elements(case when jsonb_typeof(oi.components) = 'array' then oi.components else '[]'::jsonb end) e ` +
        `join public.product_variants pv on pv.id::text = e->>'variant_id' ` +
        `join public.products p on p.id = pv.product_id where p.handle = ${h})))`;
      return cond.op === "is" ? sql : `not ${sql}`;
    }
    case "newsletter_status":
      return `${NEWSLETTER_STATUS_SQL} ${cond.op === "is" ? "=" : "<>"} ${b.add(cond.value)}`;
    case "tag": {
      const sql = `${b.add(cond.value)} = any (c.tags)`;
      return cond.op === "has" ? sql : `not (${sql})`;
    }
    case "acquisition_source": {
      const col = `lower(coalesce(c.acquisition_source, ''))`;
      if (cond.op === "is_empty") return `coalesce(c.acquisition_source, '') = ''`;
      if (cond.op === "is_not_empty") return `coalesce(c.acquisition_source, '') <> ''`;
      const v = `lower(${b.add(String(cond.value))})`;
      if (cond.op === "contains") return `strpos(${col}, ${v}) > 0`;
      return `${col} ${cond.op === "is" ? "=" : "<>"} ${v}`;
    }
    case "postal_code_prefix": {
      const v = b.add(cond.value.toUpperCase());
      const sql =
        `(exists (select 1 from public.customer_addresses a where a.customer_id = c.id and upper(left(a.postal_code, length(${v}))) = ${v}) ` +
        `or exists (select 1 from public.orders o where o.customer_id = c.id and upper(left(coalesce(o.shipping_address->>'postal_code', ''), length(${v}))) = ${v}))`;
      return cond.op === "starts_with" ? sql : `not ${sql}`;
    }
    case "customer_type":
      return `c.customer_type::text = ${b.add(cond.value)}`;
    case "blocked":
      return cond.value ? `c.blocked_at is not null` : `c.blocked_at is null`;
    case "search": {
      const v = `lower(${b.add(cond.value)})`;
      return (
        `(strpos(lower(c.email::text), ${v}) > 0 ` +
        `or strpos(lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ${v}) > 0 ` +
        `or strpos(lower(coalesce(c.company_name, '')), ${v}) > 0)`
      );
    }
  }
}

/**
 * Regeln in eine WHERE-Bedingung mit Parametern übersetzen. Unbekannte Felder oder Operatoren
 * werfen (Zod). extra wird immer mit UND verknüpft (Filter der Kundenliste).
 */
export function translateSegment(
  rules: unknown,
  extra: (SegmentCondition | InternalCondition)[] = [],
): SegmentSql {
  const parsed = segmentRulesSchema.parse(rules);
  const b = new ParamBuilder();
  const parts = parsed.conditions.map((c) => `(${conditionSql(c, b)})`);
  const joiner = parsed.match === "any" ? " or " : " and ";
  const ruleSql = parts.length > 0 ? parts.join(joiner) : "true";
  const extraParts = extra.map((c) => {
    if (c.field === "search") {
      const value = c.value.trim().slice(0, 100);
      return `(${conditionSql({ ...c, value }, b)})`;
    }
    if (c.field === "blocked") return `(${conditionSql({ ...c, value: c.value === true }, b)})`;
    return `(${conditionSql(segmentConditionSchema.parse(c), b)})`;
  });
  const where = extraParts.length > 0 ? [`(${ruleSql})`, ...extraParts].join(" and ") : ruleSql;
  return { where, params: b.params };
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Lesbare Kurzfassung einer Bedingung, z.B. "Bestellungen ≥ 2", "Letzte Bestellung vor mehr als 60 Tagen". */
export function describeCondition(
  cond: SegmentCondition,
  labels: { products?: Record<string, string> } = {},
): string {
  const meta = SEGMENT_FIELDS[cond.field];
  const op = meta.ops[cond.op] ?? cond.op;
  switch (cond.field) {
    case "orders_count":
      return `${meta.label} ${op} ${cond.value}`;
    case "total_spent_cents":
      return `${meta.label} ${op} ${formatEur(cond.value)}`;
    case "last_order":
    case "first_order":
      if (cond.op === "older_than_days" || cond.op === "within_days")
        return `${meta.label} ${op} ${cond.value} Tagen`;
      if (cond.op === "before" || cond.op === "after")
        return `${meta.label} ${op} ${formatIsoDate(String(cond.value))}`;
      return `${meta.label}: ${op}`;
    case "purchased_product": {
      const name = labels.products?.[cond.value] ?? cond.value;
      return cond.op === "is" ? `${meta.label}: ${name}` : `Hat ${name} nicht gekauft`;
    }
    case "newsletter_status":
      return `${meta.label} ${op} ${NEWSLETTER_STATUS_LABELS[cond.value]}`;
    case "tag":
      return `${op === "hat" ? "Hat" : "Hat nicht"} Tag „${cond.value}“`;
    case "acquisition_source":
      if (cond.op === "is_empty" || cond.op === "is_not_empty") return `${meta.label} ${op}`;
      return `${meta.label} ${op} ${String(cond.value)}`;
    case "postal_code_prefix":
      return `PLZ ${op} ${cond.value}`;
    case "customer_type":
      return `${meta.label} ${cond.value === "b2b" ? "B2B" : "B2C"}`;
  }
}

/** Kurzfassung aller Regeln für Listen ("Bestellungen ≥ 2 und Hat Produkt gekauft: Peach"). */
export function describeRules(
  rules: SegmentRules,
  labels: { products?: Record<string, string> } = {},
): string {
  if (rules.conditions.length === 0) return "Alle Kunden";
  const joiner = rules.match === "any" ? " oder " : " und ";
  return rules.conditions.map((c) => describeCondition(c, labels)).join(joiner);
}

/** Gespeicherte Definition lesen; ungültige Altdaten ergeben null statt einer Exception. */
export function parseStoredRules(value: unknown): SegmentRules | null {
  const parsed = segmentRulesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
