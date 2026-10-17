import { parseEuroToCents } from "@/lib/admin/discounts/rules";
import { list, str, type FormObject } from "@/lib/admin/products/form";
import type { FieldErrors } from "@/lib/admin/products/result";
import { RULE_FIELDS, type CollectionInput, type RuleField, type RuleOp } from "./rules";

/**
 * Formular des Kollektions-Editors (rein, ohne Server). Feldnamen:
 * title, handle, descriptionHtml, seoTitle, seoDescription, kind, status, sortKey, imagePath,
 * rules.<i>.field|op|value (Preis in Euro), products.<i>.id|position|remove, addProductIds.
 */

export interface ParsedCollectionForm {
  collection: CollectionInput;
  /** manuelle Reihenfolge, nur bei kind = manual */
  productIds: string[] | null;
  errors: FieldErrors;
}

/** Regelwert als Eingabetext (Preis in Euro). */
export function ruleValueToInput(field: string, value: unknown): string {
  if (field === "price" && typeof value === "number")
    return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
  return value == null ? "" : String(value);
}

export function parseRuleRows(
  obj: FormObject,
  errors: FieldErrors,
): { field: RuleField; op: RuleOp; value: string | number | boolean }[] {
  const indices = Object.keys(obj)
    .map((k) => /^rules\.(\d+)\.field$/.exec(k)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const out: { field: RuleField; op: RuleOp; value: string | number | boolean }[] = [];
  for (const i of indices) {
    const p = `rules.${i}`;
    if (`${p}.remove` in obj) continue;
    const field = str(obj, `${p}.field`);
    const op = str(obj, `${p}.op`);
    const raw = str(obj, `${p}.value`);
    if (!field) continue;
    const def = RULE_FIELDS.find((f) => f.value === field);
    if (!def) {
      errors[`${p}.field`] = "Unbekanntes Feld.";
      continue;
    }
    // leere Textzeile (zum Beispiel die vorbereitete neue Zeile) ignorieren
    if (!raw && def.type !== "boolean") {
      if (str(obj, `${p}.isNew`) === "1") continue;
      errors[`${p}.value`] = "Bitte einen Wert eingeben.";
      continue;
    }
    let value: string | number | boolean = raw;
    if (def.type === "number") {
      const cents = parseEuroToCents(raw);
      if (cents == null) {
        errors[`${p}.value`] = "Bitte einen Betrag wie 26,10 eingeben.";
        continue;
      }
      value = cents;
    } else if (def.type === "boolean") {
      value = raw !== "false";
    }
    out.push({ field: def.value, op: (op || "eq") as RuleOp, value });
  }
  return out;
}

export function parseCollectionForm(obj: FormObject): ParsedCollectionForm {
  const errors: FieldErrors = {};
  const kind = str(obj, "kind") === "automatic" ? "automatic" : "manual";
  const rules = kind === "automatic" ? parseRuleRows(obj, errors) : [];
  const position = str(obj, "position");

  let productIds: string[] | null = null;
  if (kind === "manual" && "products.present" in obj) {
    const rows = Object.keys(obj)
      .map((k) => /^products\.(\d+)\.id$/.exec(k)?.[1])
      .filter((x): x is string => x !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
    const ordered: { id: string; pos: number; i: number }[] = [];
    for (const i of rows) {
      const p = `products.${i}`;
      if (`${p}.remove` in obj) continue;
      const posRaw = str(obj, `${p}.position`);
      const pos = /^\d+$/.test(posRaw) ? Number(posRaw) : i + 1;
      ordered.push({ id: str(obj, `${p}.id`), pos, i });
    }
    ordered.sort((a, b) => a.pos - b.pos || a.i - b.i);
    productIds = ordered.map((o) => o.id);
    for (const id of list(obj, "addProductIds")) if (!productIds.includes(id)) productIds.push(id);
  }

  return {
    collection: {
      id: str(obj, "id") || undefined,
      locale: str(obj, "locale") || "de",
      title: str(obj, "title"),
      handle: str(obj, "handle").toLowerCase() || undefined,
      descriptionHtml: str(obj, "descriptionHtml") || null,
      seoTitle: str(obj, "seoTitle") || null,
      seoDescription: str(obj, "seoDescription") || null,
      kind,
      rules,
      sortKey: (str(obj, "sortKey") || (kind === "automatic" ? "title-asc" : "manual")) as never,
      status: (["draft", "published", "archived"].includes(str(obj, "status"))
        ? str(obj, "status")
        : "draft") as CollectionInput["status"],
      imagePath: str(obj, "imagePath") || null,
      position: /^\d+$/.test(position) ? Number(position) : undefined,
    },
    productIds,
    errors,
  };
}
