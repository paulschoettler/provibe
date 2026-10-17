import { z } from "zod";
import { HANDLE_MAX } from "@/lib/admin/products/rules";

/**
 * Reine Regeln für Kollektionen (Paket Admin-Katalog): Zod-Schema des Formulars,
 * Bedingungen regelbasierter Kollektionen (collections.rules, jsonb-Liste aus
 * {field, op, value}, alle Bedingungen müssen zutreffen) und die daraus berechnete Zuordnung.
 *
 * Eine eigene Tabelle collection_rules gibt es im Schema nicht; die Regeln liegen seit dem
 * Seed als jsonb an der Kollektion (zum Beispiel "all": status = active).
 */

export const RULE_FIELDS = [
  { value: "tag", label: "Tag", type: "text" },
  { value: "title", label: "Titel", type: "text" },
  { value: "product_type", label: "Produktart", type: "text" },
  { value: "vendor", label: "Marke", type: "text" },
  { value: "status", label: "Status", type: "enum", options: ["active", "draft", "archived"] },
  { value: "kind", label: "Art", type: "enum", options: ["simple", "bundle"] },
  { value: "is_food", label: "Lebensmittel", type: "boolean" },
  { value: "price", label: "Preis (günstigste aktive Variante, Cent)", type: "number" },
] as const;
export type RuleField = (typeof RULE_FIELDS)[number]["value"];

export const RULE_OPS = [
  { value: "eq", label: "ist" },
  { value: "neq", label: "ist nicht" },
  { value: "contains", label: "enthält" },
  { value: "not_contains", label: "enthält nicht" },
  { value: "starts_with", label: "beginnt mit" },
  { value: "ends_with", label: "endet mit" },
  { value: "gt", label: "größer als" },
  { value: "lt", label: "kleiner als" },
] as const;
export type RuleOp = (typeof RULE_OPS)[number]["value"];

const OPS_BY_TYPE: Record<"text" | "enum" | "boolean" | "number", RuleOp[]> = {
  text: ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with"],
  enum: ["eq", "neq"],
  boolean: ["eq"],
  number: ["eq", "neq", "gt", "lt"],
};

export function opsForField(field: RuleField): RuleOp[] {
  const def = RULE_FIELDS.find((f) => f.value === field)!;
  return OPS_BY_TYPE[def.type];
}

export const ruleSchema = z
  .object({
    field: z.enum(RULE_FIELDS.map((f) => f.value) as [RuleField, ...RuleField[]]),
    op: z.enum(RULE_OPS.map((o) => o.value) as [RuleOp, ...RuleOp[]]),
    value: z.union([z.string().trim().max(200), z.number().int(), z.boolean()]),
  })
  .superRefine((r, ctx) => {
    const def = RULE_FIELDS.find((f) => f.value === r.field)!;
    if (!OPS_BY_TYPE[def.type].includes(r.op)) {
      ctx.addIssue({
        code: "custom",
        path: ["op"],
        message: "Diese Bedingung passt nicht zum Feld.",
      });
    }
    if (def.type === "number" && typeof r.value !== "number") {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Bitte einen Betrag in Cent." });
    }
    if (def.type === "boolean" && typeof r.value !== "boolean") {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Bitte ja oder nein wählen." });
    }
    if (def.type === "text" && (typeof r.value !== "string" || !r.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Bitte einen Wert eingeben." });
    }
    if (def.type === "enum" && !(def.options as readonly string[]).includes(String(r.value))) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Bitte einen gültigen Wert wählen.",
      });
    }
  });
export type CollectionRule = z.infer<typeof ruleSchema>;

export const SORT_KEYS = [
  { value: "manual", label: "Manuell" },
  { value: "title-asc", label: "Titel A bis Z" },
  { value: "title-desc", label: "Titel Z bis A" },
  { value: "price-asc", label: "Preis aufsteigend" },
  { value: "price-desc", label: "Preis absteigend" },
  { value: "created-desc", label: "Neueste zuerst" },
  { value: "created-asc", label: "Älteste zuerst" },
] as const;
export type SortKey = (typeof SORT_KEYS)[number]["value"];

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${max} Zeichen.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const collectionInputSchema = z
  .object({
    id: z.guid().optional(),
    locale: z
      .string()
      .regex(/^[a-z]{2}$/)
      .default("de"),
    title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(200),
    handle: z.string().trim().toLowerCase().max(HANDLE_MAX).optional(),
    descriptionHtml: z.string().max(20000).nullish(),
    seoTitle: optText(120),
    seoDescription: optText(320),
    kind: z.enum(["manual", "automatic"]).default("manual"),
    rules: z.array(ruleSchema).max(20).default([]),
    sortKey: z.enum(SORT_KEYS.map((s) => s.value) as [SortKey, ...SortKey[]]).default("manual"),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    imagePath: optText(500),
    position: z.number().int().min(0).max(10000).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.kind === "automatic" && c.rules.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Eine regelbasierte Kollektion braucht mindestens eine Bedingung.",
      });
    }
    if (c.kind === "automatic" && c.sortKey === "manual") {
      ctx.addIssue({
        code: "custom",
        path: ["sortKey"],
        message: "Regelbasierte Kollektionen brauchen eine automatische Sortierung.",
      });
    }
  });
export type CollectionInput = z.input<typeof collectionInputSchema>;
export type ParsedCollectionInput = z.output<typeof collectionInputSchema>;

/** Gespeicherte Regeln lesen; ungültige Einträge fallen weg statt die Seite zu brechen. */
export function parseStoredRules(raw: unknown): CollectionRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const parsed = ruleSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Auswertung                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export interface ProductFacts {
  id: string;
  handle: string;
  title: string;
  tags: string[];
  productType: string | null;
  vendor: string;
  status: "active" | "draft" | "archived";
  kind: "simple" | "bundle";
  isFood: boolean;
  /** günstigste aktive Variante, null ohne aktive Variante */
  priceCents: number | null;
  createdAt: string;
  position: number;
}

const norm = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("de-DE").trim();

function textMatches(value: string, op: RuleOp, target: string): boolean {
  const v = norm(value);
  const t = norm(target);
  switch (op) {
    case "eq":
      return v === t;
    case "neq":
      return v !== t;
    case "contains":
      return v.includes(t);
    case "not_contains":
      return !v.includes(t);
    case "starts_with":
      return v.startsWith(t);
    case "ends_with":
      return v.endsWith(t);
    default:
      return false;
  }
}

export function matchesRule(p: ProductFacts, r: CollectionRule): boolean {
  switch (r.field) {
    case "tag": {
      const target = String(r.value);
      if (r.op === "eq") return p.tags.some((t) => norm(t) === norm(target));
      if (r.op === "neq") return !p.tags.some((t) => norm(t) === norm(target));
      if (r.op === "not_contains") return !p.tags.some((t) => textMatches(t, "contains", target));
      return p.tags.some((t) => textMatches(t, r.op, target));
    }
    case "title":
      return textMatches(p.title, r.op, String(r.value));
    case "product_type":
      return textMatches(p.productType ?? "", r.op, String(r.value));
    case "vendor":
      return textMatches(p.vendor, r.op, String(r.value));
    case "status":
      return r.op === "eq" ? p.status === r.value : p.status !== r.value;
    case "kind":
      return r.op === "eq" ? p.kind === r.value : p.kind !== r.value;
    case "is_food":
      return p.isFood === r.value;
    case "price": {
      if (p.priceCents == null) return false;
      const n = Number(r.value);
      if (r.op === "eq") return p.priceCents === n;
      if (r.op === "neq") return p.priceCents !== n;
      if (r.op === "gt") return p.priceCents > n;
      if (r.op === "lt") return p.priceCents < n;
      return false;
    }
  }
}

export function sortFacts(products: ProductFacts[], sortKey: SortKey): ProductFacts[] {
  const collator = new Intl.Collator("de");
  const price = (p: ProductFacts, dir: 1 | -1) =>
    p.priceCents == null ? Number.POSITIVE_INFINITY : dir * p.priceCents;
  const list = [...products];
  list.sort((a, b) => {
    switch (sortKey) {
      case "title-asc":
        return collator.compare(a.title, b.title);
      case "title-desc":
        return collator.compare(b.title, a.title);
      case "price-asc":
        return price(a, 1) - price(b, 1) || collator.compare(a.title, b.title);
      case "price-desc":
        return price(a, -1) - price(b, -1) || collator.compare(a.title, b.title);
      case "created-desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "created-asc":
        return a.createdAt.localeCompare(b.createdAt);
      default:
        return a.position - b.position || collator.compare(a.title, b.title);
    }
  });
  return list;
}

/** Zuordnung einer regelbasierten Kollektion: alle Bedingungen erfüllt, sortiert. */
export function computeMembership(
  products: ProductFacts[],
  rules: CollectionRule[],
  sortKey: SortKey,
): string[] {
  if (rules.length === 0) return [];
  const matching = products.filter((p) => rules.every((r) => matchesRule(p, r)));
  return sortFacts(matching, sortKey).map((p) => p.id);
}

export function diffMembership(
  current: string[],
  next: string[],
): { added: string[]; removed: string[]; reordered: boolean } {
  const cur = new Set(current);
  const nxt = new Set(next);
  const added = next.filter((id) => !cur.has(id));
  const removed = current.filter((id) => !nxt.has(id));
  const kept = current.filter((id) => nxt.has(id));
  const keptNext = next.filter((id) => cur.has(id));
  const reordered = kept.some((id, i) => keptNext[i] !== id);
  return { added, removed, reordered };
}

export const collectionProductsSchema = z.array(z.guid()).max(500);
