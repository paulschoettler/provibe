import {
  NEWSLETTER_SEGMENT_STATUSES,
  SEGMENT_FIELDS,
  segmentConditionSchema,
  type SegmentCondition,
  type SegmentField,
  type SegmentRules,
} from "./rules";

/**
 * Zustand des Segment-Editors in der URL (GET-Formular, ohne JavaScript nutzbar):
 *   name, beschreibung, match=all|any, f<i>/o<i>/v<i> je Bedingung, add=1 hängt eine Zeile an,
 *   del=<i> entfernt eine. Werte sind Texte wie eingegeben (Umsatz in Euro), die Übersetzung in
 *   die Regel-DSL (Cent, Tage, Datum) passiert hier. Rein, getestet in editor-state.test.ts.
 */

export const MAX_ROWS = 20;
export const FIELD_KEYS = Object.keys(SEGMENT_FIELDS) as SegmentField[];

export interface EditorRow {
  field: SegmentField;
  op: string;
  value: string;
}

export interface EditorState {
  name: string;
  description: string;
  match: "all" | "any";
  rows: EditorRow[];
}

export type ValueKind =
  | "number"
  | "euro"
  | "days"
  | "date"
  | "none"
  | "product"
  | "newsletter"
  | "customer_type"
  | "text"
  | "postal";

export function opsFor(field: SegmentField): { value: string; label: string }[] {
  return Object.entries(SEGMENT_FIELDS[field].ops).map(([value, label]) => ({
    value,
    label: label ?? value,
  }));
}

export function valueKind(field: SegmentField, op: string): ValueKind {
  switch (field) {
    case "orders_count":
      return "number";
    case "total_spent_cents":
      return "euro";
    case "last_order":
    case "first_order":
      if (op === "older_than_days" || op === "within_days") return "days";
      if (op === "before" || op === "after") return "date";
      return "none";
    case "purchased_product":
      return "product";
    case "newsletter_status":
      return "newsletter";
    case "customer_type":
      return "customer_type";
    case "acquisition_source":
      return op === "is_empty" || op === "is_not_empty" ? "none" : "text";
    case "postal_code_prefix":
      return "postal";
    case "tag":
      return "text";
  }
}

function isField(v: string | undefined): v is SegmentField {
  return Boolean(v) && (FIELD_KEYS as string[]).includes(v as string);
}

export function emptyRow(field: SegmentField = "orders_count"): EditorRow {
  const op = opsFor(field)[0]?.value ?? "";
  const kind = valueKind(field, op);
  const value = kind === "newsletter" ? "subscribed" : kind === "customer_type" ? "b2c" : "";
  return { field, op, value };
}

type Params = Record<string, string | string[] | undefined>;

function one(sp: Params, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Editor-Zustand aus Suchparametern oder Formulardaten lesen, add/del anwenden. */
export function parseEditorParams(sp: Params): EditorState {
  const rows: EditorRow[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const field = one(sp, `f${i}`);
    if (!isField(field)) continue;
    const ops = opsFor(field).map((o) => o.value);
    const rawOp = one(sp, `o${i}`) ?? "";
    const op = ops.includes(rawOp) ? rawOp : ops[0];
    let value = (one(sp, `v${i}`) ?? "").trim().slice(0, 120);
    const kind = valueKind(field, op);
    if (kind === "none") value = "";
    if (
      kind === "newsletter" &&
      !(NEWSLETTER_SEGMENT_STATUSES as readonly string[]).includes(value)
    )
      value = "subscribed";
    if (kind === "customer_type" && value !== "b2b" && value !== "b2c") value = "b2c";
    rows.push({ field, op, value });
  }
  const del = Number(one(sp, "del"));
  if (one(sp, "del") !== undefined && Number.isInteger(del) && del >= 0 && del < rows.length)
    rows.splice(del, 1);
  if (one(sp, "add") && rows.length < MAX_ROWS) rows.push(emptyRow());
  return {
    name: (one(sp, "name") ?? "").trim().slice(0, 120),
    description: (one(sp, "beschreibung") ?? "").trim().slice(0, 500),
    match: one(sp, "match") === "any" ? "any" : "all",
    rows,
  };
}

/** "50", "50,5", "1.234,50" in Cent; null bei ungültiger Eingabe. */
export function euroToCents(value: string): number | null {
  const v = value.replace(/\s|€/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(v)) return null;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Math.round(Number(normalized) * 100);
  return Number.isFinite(n) ? n : null;
}

export function centsToEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

/** Zeilen in Regeln übersetzen. Ungültige Zeilen erscheinen in errors (Index der Zeile). */
export function rowsToRules(state: EditorState): {
  rules: SegmentRules | null;
  errors: Record<number, string>;
} {
  const errors: Record<number, string> = {};
  const conditions: SegmentCondition[] = [];
  state.rows.forEach((row, i) => {
    const kind = valueKind(row.field, row.op);
    let value: unknown = row.value;
    if (kind === "euro") {
      const cents = euroToCents(row.value);
      if (cents === null) {
        errors[i] = "Bitte gib einen Betrag in Euro ein, zum Beispiel 50 oder 49,90.";
        return;
      }
      value = cents;
    }
    if (kind === "none") value = undefined;
    if ((kind === "number" || kind === "days") && row.value === "") {
      errors[i] = "Bitte gib eine Zahl ein.";
      return;
    }
    const parsed = segmentConditionSchema.safeParse({ field: row.field, op: row.op, value });
    if (!parsed.success) {
      errors[i] = parsed.error.issues[0]?.message ?? "Ungültige Bedingung.";
      return;
    }
    conditions.push(parsed.data);
  });
  if (Object.keys(errors).length > 0) return { rules: null, errors };
  return { rules: { match: state.match, conditions }, errors };
}

/** Gespeicherte Regeln in Editor-Zeilen (Cent in Euro). */
export function rulesToRows(rules: SegmentRules): EditorRow[] {
  return rules.conditions.map((c) => ({
    field: c.field,
    op: c.op,
    value:
      c.field === "total_spent_cents"
        ? centsToEuro(c.value)
        : c.value === undefined || c.value === null
          ? ""
          : String(c.value),
  }));
}

/** Editor-Zustand als Suchparameter (für Links und Weiterleitungen). */
export function stateToParams(state: EditorState): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.name) out.name = state.name;
  if (state.description) out.beschreibung = state.description;
  if (state.match === "any") out.match = "any";
  state.rows.forEach((r, i) => {
    out[`f${i}`] = r.field;
    out[`o${i}`] = r.op;
    if (r.value) out[`v${i}`] = r.value;
  });
  return out;
}
