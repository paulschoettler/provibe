import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  automaticCollectionPositions,
  cheapestActivePrice,
  matchesCollectionRules,
  resetCollectionRuleWarnings,
  type RuleProduct,
  type RuleVariant,
} from "./collection-rules";

const product = (over: Partial<RuleProduct> = {}): RuleProduct => ({
  handle: "peach",
  title: "Peach Eistee",
  tags: ["eistee", "Sommer"],
  product_type: "Eistee",
  vendor: "provibe",
  status: "active",
  kind: "simple",
  is_food: true,
  ...over,
});

const variants: RuleVariant[] = [
  { price_cents: 2835, is_active: true },
  { price_cents: 5470, is_active: true },
  { price_cents: 100, is_active: false },
];

const match = (rules: unknown, p = product(), v = variants, warn = vi.fn()) =>
  matchesCollectionRules(p, rules, v, { collectionKey: "test", warn });

beforeEach(() => resetCollectionRuleWarnings());

describe("matchesCollectionRules: Tags", () => {
  it("eq und neq vergleichen ganze Tags ohne Groß/Kleinschreibung", () => {
    expect(match([{ field: "tag", op: "eq", value: "EISTEE" }])).toBe(true);
    expect(match([{ field: "tag", op: "eq", value: "eis" }])).toBe(false);
    expect(match([{ field: "tag", op: "neq", value: "merch" }])).toBe(true);
    expect(match([{ field: "tag", op: "neq", value: "sommer" }])).toBe(false);
  });

  it("contains, not_contains, starts_with, ends_with", () => {
    expect(match([{ field: "tag", op: "contains", value: "omm" }])).toBe(true);
    expect(match([{ field: "tag", op: "not_contains", value: "omm" }])).toBe(false);
    expect(match([{ field: "tag", op: "not_contains", value: "merch" }])).toBe(true);
    expect(match([{ field: "tag", op: "starts_with", value: "eis" }])).toBe(true);
    expect(match([{ field: "tag", op: "ends_with", value: "mer" }])).toBe(true);
    expect(match([{ field: "tag", op: "ends_with", value: "eis" }])).toBe(false);
  });

  it("in passt, wenn ein Tag in der Liste steht", () => {
    expect(match([{ field: "tag", op: "in", value: ["merch", "Eistee"] }])).toBe(true);
    expect(match([{ field: "tag", op: "in", value: ["merch", "bundle"] }])).toBe(false);
  });

  it("Produkt ohne Tags passt nur auf neq und not_contains", () => {
    const p = product({ tags: [] });
    expect(match([{ field: "tag", op: "eq", value: "eistee" }], p)).toBe(false);
    expect(match([{ field: "tag", op: "neq", value: "eistee" }], p)).toBe(true);
    expect(match([{ field: "tag", op: "not_contains", value: "x" }], p)).toBe(true);
  });
});

describe("matchesCollectionRules: Textfelder", () => {
  it("title mit allen Textoperatoren", () => {
    expect(match([{ field: "title", op: "eq", value: " peach eistee " }])).toBe(true);
    expect(match([{ field: "title", op: "neq", value: "Peach" }])).toBe(true);
    expect(match([{ field: "title", op: "contains", value: "each" }])).toBe(true);
    expect(match([{ field: "title", op: "not_contains", value: "Wild" }])).toBe(true);
    expect(match([{ field: "title", op: "starts_with", value: "Pea" }])).toBe(true);
    expect(match([{ field: "title", op: "ends_with", value: "Eistee" }])).toBe(true);
    expect(match([{ field: "title", op: "in", value: ["Peach Eistee", "Wildberry"] }])).toBe(true);
  });

  it("handle, vendor und product_type", () => {
    expect(match([{ field: "handle", op: "eq", value: "peach" }])).toBe(true);
    expect(match([{ field: "handle", op: "in", value: ["wildberry", "peach"] }])).toBe(true);
    expect(match([{ field: "handle", op: "neq", value: "peach" }])).toBe(false);
    expect(match([{ field: "vendor", op: "eq", value: "PROVIBE" }])).toBe(true);
    expect(match([{ field: "product_type", op: "contains", value: "tee" }])).toBe(true);
    expect(match([{ field: "product_type", op: "eq", value: "Bundle" }])).toBe(false);
  });

  it("fehlende Produktart zählt als leerer Text", () => {
    const p = product({ product_type: null });
    expect(match([{ field: "product_type", op: "eq", value: "Eistee" }], p)).toBe(false);
    expect(match([{ field: "product_type", op: "neq", value: "Eistee" }], p)).toBe(true);
  });
});

describe("matchesCollectionRules: Status, Art, Lebensmittel", () => {
  it("status und kind mit eq, neq, in", () => {
    expect(match([{ field: "status", op: "eq", value: "active" }])).toBe(true);
    expect(match([{ field: "status", op: "neq", value: "active" }])).toBe(false);
    expect(match([{ field: "kind", op: "eq", value: "bundle" }])).toBe(false);
    expect(match([{ field: "kind", op: "neq", value: "bundle" }])).toBe(true);
    expect(match([{ field: "kind", op: "in", value: ["simple", "bundle"] }])).toBe(true);
  });

  it("is_food mit Wahrheitswert oder Text", () => {
    expect(match([{ field: "is_food", op: "eq", value: true }])).toBe(true);
    expect(match([{ field: "is_food", op: "eq", value: "false" }])).toBe(false);
    expect(match([{ field: "is_food", op: "neq", value: false }])).toBe(true);
    expect(match([{ field: "is_food", op: "in", value: [true] }])).toBe(true);
  });
});

describe("matchesCollectionRules: Preis", () => {
  it("nutzt die günstigste aktive Variante", () => {
    expect(cheapestActivePrice(variants)).toBe(2835);
    expect(cheapestActivePrice([{ price_cents: 900 }])).toBe(900);
    expect(cheapestActivePrice([{ price_cents: 900, is_active: false }])).toBeNull();
  });

  it("eq, neq, gt, lt, in", () => {
    expect(match([{ field: "price", op: "eq", value: 2835 }])).toBe(true);
    expect(match([{ field: "price", op: "neq", value: 2835 }])).toBe(false);
    expect(match([{ field: "price", op: "gt", value: 2834 }])).toBe(true);
    expect(match([{ field: "price", op: "gt", value: 2835 }])).toBe(false);
    expect(match([{ field: "price", op: "lt", value: 3000 }])).toBe(true);
    expect(match([{ field: "price", op: "lt", value: "2835" }])).toBe(false);
    expect(match([{ field: "price", op: "in", value: [100, 2835] }])).toBe(true);
  });

  it("ohne aktive Variante passt keine Preisregel", () => {
    expect(match([{ field: "price", op: "lt", value: 99999 }], product(), [])).toBe(false);
  });
});

describe("matchesCollectionRules: Verknüpfung und Fehler", () => {
  it("alle Regeln müssen passen", () => {
    const rules = [
      { field: "tag", op: "eq", value: "eistee" },
      { field: "price", op: "lt", value: 3000 },
    ];
    expect(match(rules)).toBe(true);
    expect(match([...rules, { field: "kind", op: "eq", value: "bundle" }])).toBe(false);
  });

  it("Beispiel aus der Migration und Seed-Regel der Kollektion all", () => {
    expect(match([{ field: "tag", op: "eq", value: "eistee" }])).toBe(true);
    expect(match([{ op: "eq", field: "status", value: "active" }])).toBe(true);
  });

  it("keine Regeln oder kein Array ergibt false", () => {
    const warn = vi.fn();
    expect(match([], product(), variants, warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(match({ field: "tag" }, product(), variants, warn)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("unbekanntes Feld, unbekannter Operator oder unpassender Wert ergibt false", () => {
    const cases: unknown[] = [
      [{ field: "farbe", op: "eq", value: "rot" }],
      [{ field: "tag", op: "matches", value: "eis" }],
      [{ field: "status", op: "gt", value: "active" }],
      [{ field: "price", op: "contains", value: 1 }],
      [{ field: "price", op: "gt", value: "viel" }],
      [{ field: "tag", op: "in", value: "eistee" }],
      [{ field: "tag", op: "eq" }],
      [{ field: "is_food", op: "eq", value: "vielleicht" }],
      ["tag = eistee"],
      [null],
    ];
    for (const rules of cases) {
      resetCollectionRuleWarnings();
      const warn = vi.fn();
      expect(match(rules, product(), variants, warn), JSON.stringify(rules)).toBe(false);
      expect(warn, JSON.stringify(rules)).toHaveBeenCalledTimes(1);
    }
  });

  it("eine kaputte Regel macht auch passende Regeln wirkungslos", () => {
    expect(
      match([
        { field: "tag", op: "eq", value: "eistee" },
        { field: "unbekannt", op: "eq", value: 1 },
      ]),
    ).toBe(false);
  });

  it("warnt nur einmal je Kollektion", () => {
    const warn = vi.fn();
    const rules = [{ field: "farbe", op: "eq", value: "rot" }];
    for (let i = 0; i < 5; i++) {
      matchesCollectionRules(product(), rules, variants, { collectionKey: "a", warn });
    }
    matchesCollectionRules(product(), rules, variants, { collectionKey: "b", warn });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain("Kollektion a");
    expect(warn.mock.calls[0][0]).toContain("farbe");
  });

  it("nutzt ohne eigenen Hinweisgeber console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    matchesCollectionRules(product(), [{ field: "x", op: "eq", value: 1 }], variants, {
      collectionKey: "c",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("automaticCollectionPositions", () => {
  const items = [
    { handle: "b", title: "Bundle", priceCents: 5000, createdAt: "2026-09-02T00:00:00Z" },
    { handle: "a", title: "Ärmelshirt", priceCents: 2500, createdAt: "2026-09-03T00:00:00Z" },
    { handle: "c", title: "Cup", priceCents: null, createdAt: "2026-09-01T00:00:00Z" },
  ];
  const order = (key: string) => {
    const pos = automaticCollectionPositions(items, key)!;
    return [...pos.entries()].sort((x, y) => x[1] - y[1]).map(([h]) => h);
  };

  it("sortiert nach den Backoffice-Schlüsseln", () => {
    expect(order("title-asc")).toEqual(["a", "b", "c"]);
    expect(order("title-desc")).toEqual(["c", "b", "a"]);
    expect(order("price-asc")).toEqual(["a", "b", "c"]);
    expect(order("price-desc")).toEqual(["b", "a", "c"]);
    expect(order("created-desc")).toEqual(["a", "b", "c"]);
    expect(order("created-asc")).toEqual(["c", "b", "a"]);
  });

  it("manual oder unbekannt: keine Positionen (Sortierrang der Storefront)", () => {
    expect(automaticCollectionPositions(items, "manual")).toBeUndefined();
    expect(automaticCollectionPositions(items, "best-selling")).toBeUndefined();
    expect(automaticCollectionPositions(items, null)).toBeUndefined();
  });
});
