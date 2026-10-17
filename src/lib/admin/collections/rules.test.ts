import { describe, expect, it } from "vitest";
import {
  collectionInputSchema,
  computeMembership,
  diffMembership,
  matchesRule,
  opsForField,
  parseStoredRules,
  ruleSchema,
  sortFacts,
  type ProductFacts,
} from "./rules";

const p = (over: Partial<ProductFacts>): ProductFacts => ({
  id: over.handle ?? "x",
  handle: "x",
  title: "X",
  tags: [],
  productType: null,
  vendor: "provibe",
  status: "active",
  kind: "simple",
  isFood: false,
  priceCents: 1000,
  createdAt: "2026-09-21T10:00:00Z",
  position: 0,
  ...over,
});

const products = [
  p({
    handle: "peach",
    title: "Peach",
    tags: ["eistee"],
    isFood: true,
    priceCents: 2610,
    position: 7,
    createdAt: "2026-09-21T10:00:03Z",
  }),
  p({
    handle: "wildberry",
    title: "Wildberry",
    tags: ["eistee"],
    isFood: true,
    priceCents: 2610,
    position: 1,
    createdAt: "2026-09-21T10:00:01Z",
  }),
  p({
    handle: "founder-bundle-i",
    title: "Founder Bundle I",
    tags: ["bundle"],
    kind: "bundle",
    priceCents: 3580,
    position: 2,
  }),
  p({
    handle: "provibe-shirt",
    title: "provibe Shirt",
    tags: ["merch"],
    priceCents: 2990,
    position: 3,
  }),
  p({ handle: "alt", title: "Alt", status: "archived", tags: ["eistee"], priceCents: null }),
];

describe("Regeln", () => {
  it("Schema prüft Operator und Werttyp je Feld", () => {
    expect(ruleSchema.safeParse({ field: "status", op: "eq", value: "active" }).success).toBe(true);
    expect(ruleSchema.safeParse({ field: "status", op: "contains", value: "act" }).success).toBe(
      false,
    );
    expect(ruleSchema.safeParse({ field: "status", op: "eq", value: "live" }).success).toBe(false);
    expect(ruleSchema.safeParse({ field: "price", op: "gt", value: "10" }).success).toBe(false);
    expect(ruleSchema.safeParse({ field: "is_food", op: "eq", value: true }).success).toBe(true);
    expect(ruleSchema.safeParse({ field: "tag", op: "eq", value: "" }).success).toBe(false);
    expect(opsForField("price")).toEqual(["eq", "neq", "gt", "lt"]);
  });

  it("Tag-Regeln ohne Groß/klein", () => {
    const peach = products[0];
    expect(matchesRule(peach, { field: "tag", op: "eq", value: "Eistee" })).toBe(true);
    expect(matchesRule(peach, { field: "tag", op: "neq", value: "eistee" })).toBe(false);
    expect(matchesRule(peach, { field: "tag", op: "contains", value: "ist" })).toBe(true);
    expect(matchesRule(peach, { field: "tag", op: "not_contains", value: "merch" })).toBe(true);
  });

  it("Text-, Status-, Art- und Preisregeln", () => {
    const bundle = products[2];
    expect(matchesRule(bundle, { field: "title", op: "starts_with", value: "founder" })).toBe(true);
    expect(matchesRule(bundle, { field: "title", op: "ends_with", value: " i" })).toBe(true);
    expect(matchesRule(bundle, { field: "kind", op: "eq", value: "bundle" })).toBe(true);
    expect(matchesRule(bundle, { field: "status", op: "neq", value: "archived" })).toBe(true);
    expect(matchesRule(bundle, { field: "price", op: "gt", value: 3000 })).toBe(true);
    expect(matchesRule(bundle, { field: "price", op: "lt", value: 3000 })).toBe(false);
    expect(matchesRule(products[4], { field: "price", op: "lt", value: 99999 })).toBe(false);
    expect(matchesRule(products[0], { field: "is_food", op: "eq", value: true })).toBe(true);
  });

  it("Regel der Kollektion all: status = active, sortiert", () => {
    expect(
      computeMembership(products, [{ field: "status", op: "eq", value: "active" }], "title-asc"),
    ).toEqual(["founder-bundle-i", "peach", "provibe-shirt", "wildberry"]);
  });

  it("alle Bedingungen müssen zutreffen", () => {
    expect(
      computeMembership(
        products,
        [
          { field: "tag", op: "eq", value: "eistee" },
          { field: "status", op: "eq", value: "active" },
        ],
        "price-asc",
      ),
    ).toEqual(["peach", "wildberry"]);
    expect(computeMembership(products, [], "title-asc")).toEqual([]);
  });

  it("Sortierungen", () => {
    const ids = (k: Parameters<typeof sortFacts>[1]) => sortFacts(products, k).map((x) => x.handle);
    expect(ids("price-desc")[0]).toBe("founder-bundle-i");
    expect(ids("price-asc").at(-1)).toBe("alt");
    expect(ids("manual")[0]).toBe("alt");
    expect(ids("created-desc")[0]).toBe("peach");
    expect(ids("title-desc")[0]).toBe("wildberry");
  });

  it("gespeicherte Regeln: ungültige fallen weg", () => {
    expect(
      parseStoredRules([
        { field: "status", op: "eq", value: "active" },
        { field: "foo", op: "eq", value: "x" },
      ]),
    ).toEqual([{ field: "status", op: "eq", value: "active" }]);
    expect(parseStoredRules(null)).toEqual([]);
  });
});

describe("Formular", () => {
  it("regelbasierte Kollektion braucht Regeln und automatische Sortierung", () => {
    const r = collectionInputSchema.safeParse({
      title: "Alle",
      kind: "automatic",
      rules: [],
      sortKey: "manual",
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("rules");
    expect(paths).toContain("sortKey");
  });
  it("manuelle Kollektion mit Standardwerten", () => {
    const r = collectionInputSchema.parse({ title: "Eistee" });
    expect(r).toMatchObject({
      kind: "manual",
      status: "draft",
      sortKey: "manual",
      rules: [],
      locale: "de",
    });
  });
});

describe("diffMembership", () => {
  it("erkennt Zugänge, Abgänge und neue Reihenfolge", () => {
    expect(diffMembership(["a", "b", "c"], ["c", "a", "d"])).toEqual({
      added: ["d"],
      removed: ["b"],
      reordered: true,
    });
    expect(diffMembership(["a", "b"], ["a", "b"])).toEqual({
      added: [],
      removed: [],
      reordered: false,
    });
  });
});
