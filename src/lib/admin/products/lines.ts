/**
 * Produkttyp im Backoffice (Liste und Editor): Sorte, Mixed, Bundle, Merch.
 *
 * Das Schema kennt nur products.kind (simple, bundle), dazu product_type und Tags aus Shopify.
 * Der Typ steht deshalb ausdrücklich in products.attributes.product_line; fehlt er (Seed,
 * Import), wird er aus kind, Tags, product_type und is_food abgeleitet. Rein, ohne Server.
 */

export const PRODUCT_LINES = [
  { value: "sorte", label: "Sorte" },
  { value: "mixed", label: "Mixed" },
  { value: "bundle", label: "Bundle" },
  { value: "merch", label: "Merch" },
] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number]["value"];

export const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  sorte: "Sorte",
  mixed: "Mixed",
  bundle: "Bundle",
  merch: "Merch",
};

export function isProductLine(v: unknown): v is ProductLine {
  return typeof v === "string" && PRODUCT_LINES.some((l) => l.value === v);
}

export interface ProductLineFacts {
  kind: "simple" | "bundle";
  handle: string;
  tags: readonly string[];
  productType: string | null;
  isFood: boolean;
  attributes?: Record<string, unknown> | null;
}

export function productLineOf(p: ProductLineFacts): ProductLine {
  const stored = p.attributes?.product_line;
  if (isProductLine(stored)) {
    // Bundle und Art müssen zusammenpassen, sonst gilt die Art
    if (p.kind === "bundle") return "bundle";
    if (stored !== "bundle") return stored;
  }
  if (p.kind === "bundle") return "bundle";
  const tags = p.tags.map((t) => t.toLowerCase());
  const type = (p.productType ?? "").toLowerCase();
  if (tags.includes("merch") || type.startsWith("merch")) return "merch";
  if (tags.includes("mixed") || /(^|-)mixed($|-)/.test(p.handle)) return "mixed";
  return p.isFood ? "sorte" : "merch";
}

/** Typ Bundle bedeutet Art bundle, alle anderen Typen sind Einzelprodukte. */
export function kindForLine(line: ProductLine): "simple" | "bundle" {
  return line === "bundle" ? "bundle" : "simple";
}
