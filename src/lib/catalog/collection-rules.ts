/**
 * Regelbasierte Kollektionen in der Storefront (Paket Katalog, reine Logik ohne Datenbank).
 *
 * Format von collections.rules (jsonb): Liste aus {field, op, value}, alle Bedingungen müssen
 * zutreffen. Maßgeblich ist das Format, das das Backoffice schreibt (src/lib/admin/collections/
 * rules.ts, ruleSchema); die Migration 20260921120200_catalog.sql nennt nur das Beispiel
 * [{"field":"tag","op":"eq","value":"eistee"}].
 *
 * Backoffice-Felder: tag, title, product_type, vendor, status, kind ("simple" | "bundle"),
 * is_food, price (günstigste aktive Variante in Cent, inklusive Pfand wie in price_cents).
 * Backoffice-Operatoren: eq, neq, contains, not_contains, starts_with, ends_with, gt, lt.
 * Zusätzlich versteht die Storefront das Feld handle und den Operator in (value ist eine Liste),
 * damit ältere oder von Hand gepflegte Regeln nicht still ins Leere laufen.
 *
 * Textvergleiche ohne Groß/Kleinschreibung (de-DE) und ohne Leerraum am Rand, wie im Backoffice.
 * Unbekannte Felder, Operatoren oder unpassende Werte ergeben false; dazu genau ein
 * console.warn je Kollektion (nicht je Produkt), damit die Logs lesbar bleiben.
 *
 * Hinweis: Das Backoffice schreibt die Zuordnung zusätzlich nach collection_products
 * (computeMembership). Die Storefront wertet die Regeln selbst aus und ist damit auch dann
 * aktuell, wenn ein Produkt ohne erneutes Anwenden der Regeln geändert wurde.
 */

export interface RuleProduct {
  handle: string;
  /** Titel in der angezeigten Sprache, ohne Übersetzung der Handle */
  title: string;
  tags: string[];
  product_type: string | null;
  vendor: string | null;
  status: string;
  kind: string;
  is_food: boolean;
}

export interface RuleVariant {
  price_cents: number;
  /** fehlt bei Varianten, die RLS ohnehin nur aktiv liefert */
  is_active?: boolean;
}

export interface RuleOptions {
  /** Kennung für den Warnhinweis, zum Beispiel die Handle der Kollektion */
  collectionKey?: string;
  /** Ersatz für console.warn (Tests) */
  warn?: (message: string) => void;
}

type FieldType = "text" | "tags" | "enum" | "boolean" | "number";

const FIELD_TYPES: Record<string, FieldType> = {
  tag: "tags",
  title: "text",
  handle: "text",
  product_type: "text",
  vendor: "text",
  status: "enum",
  kind: "enum",
  is_food: "boolean",
  price: "number",
};

const OPS_BY_TYPE: Record<FieldType, readonly string[]> = {
  text: ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "in"],
  tags: ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "in"],
  enum: ["eq", "neq", "in"],
  boolean: ["eq", "neq", "in"],
  number: ["eq", "neq", "gt", "lt", "in"],
};

export const COLLECTION_RULE_FIELDS = Object.keys(FIELD_TYPES);
export const COLLECTION_RULE_OPS = [...new Set(Object.values(OPS_BY_TYPE).flat())];

/** Ungültige Regel: Grund für den Warnhinweis. */
class RuleProblem {
  constructor(readonly reason: string) {}
}

const warnedCollections = new Set<string>();

/** Nur für Tests: Warnhinweise wieder zulassen. */
export function resetCollectionRuleWarnings(): void {
  warnedCollections.clear();
}

function warnOnce(options: RuleOptions | undefined, reason: string): void {
  const key = options?.collectionKey ?? "(ohne Kennung)";
  if (warnedCollections.has(key)) return;
  warnedCollections.add(key);
  const warn = options?.warn ?? ((m: string) => console.warn(m));
  warn(`[catalog] Kollektion ${key}: Regel nicht auswertbar (${reason}), Produkte passen nicht.`);
}

const norm = (s: unknown) =>
  String(s ?? "")
    .toLocaleLowerCase("de-DE")
    .trim();

function textOp(value: string, op: string, target: unknown): boolean {
  const v = norm(value);
  if (op === "in") return asList(target).some((t) => norm(t) === v);
  if (typeof target !== "string" && typeof target !== "number") {
    throw new RuleProblem(`Wert für ${op} fehlt`);
  }
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
      throw new RuleProblem(`Operator ${op}`);
  }
}

function asList(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new RuleProblem("in braucht eine Liste");
  return value;
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (typeof value === "string" && value.trim() === "") throw new RuleProblem("Zahl fehlt");
  if (!Number.isFinite(n)) throw new RuleProblem(`kein Betrag: ${JSON.stringify(value)}`);
  return n;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new RuleProblem(`kein Ja/Nein-Wert: ${JSON.stringify(value)}`);
}

/** Günstigste aktive Variante in Cent, null ohne aktive Variante (wie im Backoffice). */
export function cheapestActivePrice(variants: RuleVariant[]): number | null {
  const prices = variants.filter((v) => v.is_active !== false).map((v) => v.price_cents);
  return prices.length ? Math.min(...prices) : null;
}

function evaluate(product: RuleProduct, rule: unknown, price: () => number | null): boolean {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw new RuleProblem("Eintrag ist kein Objekt");
  }
  const { field, op, value } = rule as Record<string, unknown>;
  const type = typeof field === "string" ? FIELD_TYPES[field] : undefined;
  if (!type) throw new RuleProblem(`unbekanntes Feld ${JSON.stringify(field)}`);
  if (typeof op !== "string" || !OPS_BY_TYPE[type].includes(op)) {
    throw new RuleProblem(`Operator ${JSON.stringify(op)} passt nicht zu ${field}`);
  }

  switch (type) {
    case "tags": {
      const tags = product.tags ?? [];
      if (op === "neq") return !tags.some((t) => textOp(t, "eq", value));
      if (op === "not_contains") return !tags.some((t) => textOp(t, "contains", value));
      // Wert vorab prüfen, damit auch ein Produkt ohne Tags eine kaputte Regel meldet
      if (op === "in") asList(value);
      else textOp("", "eq", value);
      return tags.some((t) => textOp(t, op, value));
    }
    case "text": {
      const source =
        field === "title"
          ? product.title
          : field === "handle"
            ? product.handle
            : field === "vendor"
              ? product.vendor
              : product.product_type;
      return textOp(source ?? "", op, value);
    }
    case "enum": {
      const current = field === "status" ? product.status : product.kind;
      if (op === "in") return asList(value).some((v) => norm(v) === norm(current));
      if (typeof value !== "string") throw new RuleProblem(`Wert für ${field} fehlt`);
      return op === "eq" ? norm(current) === norm(value) : norm(current) !== norm(value);
    }
    case "boolean": {
      const current = product.is_food;
      if (op === "in") return asList(value).map(toBoolean).includes(current);
      const b = toBoolean(value);
      return op === "eq" ? current === b : current !== b;
    }
    case "number": {
      const target = op === "in" ? asList(value).map(toNumber) : [toNumber(value)];
      const current = price();
      if (current == null) return false;
      if (op === "in") return target.includes(current);
      const n = target[0];
      if (op === "eq") return current === n;
      if (op === "neq") return current !== n;
      if (op === "gt") return current > n;
      return current < n;
    }
  }
}

/**
 * Passt das Produkt zu den Regeln einer automatischen Kollektion? Alle Regeln müssen zutreffen.
 * Keine Regeln oder kein Array: false (wie computeMembership im Backoffice).
 */
export function matchesCollectionRules(
  product: RuleProduct,
  rules: unknown,
  variants: RuleVariant[],
  options?: RuleOptions,
): boolean {
  if (!Array.isArray(rules)) {
    warnOnce(options, "rules ist keine Liste");
    return false;
  }
  if (rules.length === 0) return false;
  let cached: number | null | undefined;
  const price = () => (cached === undefined ? (cached = cheapestActivePrice(variants)) : cached);
  try {
    return rules.every((rule) => evaluate(product, rule, price));
  } catch (error) {
    if (error instanceof RuleProblem) {
      warnOnce(options, error.reason);
      return false;
    }
    throw error;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Reihenfolge                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export interface RuleSortItem {
  handle: string;
  title: string;
  priceCents: number | null;
  createdAt: string;
}

/**
 * Reihenfolge einer automatischen Kollektion aus collections.sort_key (Backoffice-Werte
 * title-asc, title-desc, price-asc, price-desc, created-desc, created-asc). Eine Spalte
 * sort_order gibt es im Schema nicht. Ergebnis: Position je Handle für sortProducts.
 *
 * "manual" oder ein unbekannter Wert ergibt undefined: Dann gilt der Sortierrang der Storefront
 * ("Beliebt": Sorten, Mix, Bundles, Merch), wie bisher für /collections/all. products.position
 * wäre die Shopify-Reihenfolge mit den Bundles zuerst und würde die Seite sichtbar umsortieren.
 */
export function automaticCollectionPositions(
  items: RuleSortItem[],
  sortKey: string | null | undefined,
): Map<string, number> | undefined {
  const collator = new Intl.Collator("de");
  const price = (p: RuleSortItem, dir: 1 | -1) =>
    p.priceCents == null ? Number.POSITIVE_INFINITY : dir * p.priceCents;
  let compare: ((a: RuleSortItem, b: RuleSortItem) => number) | null = null;
  switch (sortKey) {
    case "title-asc":
      compare = (a, b) => collator.compare(a.title, b.title);
      break;
    case "title-desc":
      compare = (a, b) => collator.compare(b.title, a.title);
      break;
    case "price-asc":
      compare = (a, b) => price(a, 1) - price(b, 1) || collator.compare(a.title, b.title);
      break;
    case "price-desc":
      compare = (a, b) => price(a, -1) - price(b, -1) || collator.compare(a.title, b.title);
      break;
    case "created-desc":
      compare = (a, b) => b.createdAt.localeCompare(a.createdAt);
      break;
    case "created-asc":
      compare = (a, b) => a.createdAt.localeCompare(b.createdAt);
      break;
    default:
      return undefined;
  }
  return new Map([...items].sort(compare).map((item, i) => [item.handle, i]));
}
