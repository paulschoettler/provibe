import { describe, expect, it } from "vitest";
import { formatEur } from "@/lib/money";
import {
  describeRules,
  parseStoredRules,
  segmentRulesSchema,
  translateSegment,
  type SegmentRules,
} from "./rules";

describe("translateSegment", () => {
  it("übersetzt leere Regeln in true", () => {
    expect(translateSegment({ match: "all", conditions: [] })).toEqual({
      where: "true",
      params: [],
    });
  });

  it("bindet Werte als Parameter und verknüpft mit UND", () => {
    const sql = translateSegment({
      match: "all",
      conditions: [
        { field: "orders_count", op: "gte", value: 2 },
        { field: "last_order", op: "older_than_days", value: 60 },
      ],
    });
    expect(sql.where).toBe(
      "(c.orders_count >= ($1->>0)::integer) and (c.last_order_at < now() - make_interval(days => ($1->>1)::integer))",
    );
    expect(sql.params).toEqual([2, 60]);
  });

  it("verknüpft mit ODER bei match any", () => {
    const sql = translateSegment({
      match: "any",
      conditions: [
        { field: "tag", op: "has", value: "Pre-Sale" },
        { field: "customer_type", op: "is", value: "b2b" },
      ],
    });
    expect(sql.where).toBe("(($1->>0) = any (c.tags)) or (c.customer_type::text = ($1->>1))");
    expect(sql.params).toEqual(["Pre-Sale", "b2b"]);
  });

  it("setzt Werte nie in den SQL-Text ein", () => {
    const evil = "x') or 1=1 --";
    const sql = translateSegment({
      match: "all",
      conditions: [
        { field: "tag", op: "has", value: evil },
        { field: "acquisition_source", op: "contains", value: evil },
      ],
    });
    expect(sql.where).not.toContain("1=1");
    expect(sql.where).not.toContain("--");
    expect(sql.params).toEqual([evil, evil]);
  });

  it("lehnt unbekannte Felder und Operatoren ab", () => {
    expect(() =>
      translateSegment({ match: "all", conditions: [{ field: "email", op: "is", value: "a" }] }),
    ).toThrow();
    expect(() =>
      translateSegment({
        match: "all",
        conditions: [{ field: "orders_count", op: "like", value: 1 }],
      }),
    ).toThrow();
    expect(() =>
      translateSegment({
        match: "all",
        conditions: [{ field: "purchased_product", op: "is", value: "peach'; drop" }],
      }),
    ).toThrow();
  });

  it("übersetzt Datumsoperatoren mit Berliner Tagesgrenzen", () => {
    const sql = translateSegment({
      match: "all",
      conditions: [
        { field: "first_order", op: "after", value: "2026-09-01" },
        { field: "first_order", op: "before", value: "2026-10-01" },
        { field: "last_order", op: "is_empty" },
      ],
    });
    expect(sql.where).toContain(
      "c.first_order_at >= (($1->>0)::date + 1)::timestamp at time zone 'Europe/Berlin'",
    );
    expect(sql.where).toContain(
      "c.first_order_at < (($1->>1)::date)::timestamp at time zone 'Europe/Berlin'",
    );
    expect(sql.where).toContain("(c.last_order_at is null)");
    expect(sql.params).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("nutzt den Produkt-Handle zweimal mit demselben Platzhalter (auch Bundle-Komponenten)", () => {
    const sql = translateSegment({
      match: "all",
      conditions: [{ field: "purchased_product", op: "is_not", value: "peach" }],
    });
    expect(sql.params).toEqual(["peach"]);
    expect(sql.where.startsWith("(not exists (select 1 from public.order_items oi")).toBe(true);
    expect(sql.where.match(/\(\$1->>0\)/g)).toHaveLength(2);
  });

  it("normalisiert PLZ-Präfix und Newsletter-Status", () => {
    const sql = translateSegment({
      match: "all",
      conditions: [
        { field: "postal_code_prefix", op: "starts_with", value: "86" },
        { field: "newsletter_status", op: "is", value: "none" },
      ],
    });
    expect(sql.params).toEqual(["86", "none"]);
    expect(sql.where).toContain("public.customer_addresses a");
    expect(sql.where).toContain("'none') = ($1->>1)");
  });

  it("hängt Filter der Kundenliste mit UND an, Suche gekürzt", () => {
    const sql = translateSegment(
      { match: "any", conditions: [{ field: "tag", op: "has", value: "VIP" }] },
      [
        { field: "search", op: "matches", value: `  ${"a".repeat(150)}  ` },
        { field: "newsletter_status", op: "is", value: "subscribed" },
      ],
    );
    expect(sql.where.startsWith("((($1->>0) = any (c.tags))) and (")).toBe(true);
    expect(sql.params[1]).toHaveLength(100);
    expect(sql.params[2]).toBe("subscribed");
  });

  it("enthält keine Zeichen, die die Datenbankprüfung ablehnt", () => {
    const sql = translateSegment({
      match: "all",
      conditions: [
        { field: "orders_count", op: "gte", value: 1 },
        { field: "total_spent_cents", op: "lt", value: 5000 },
        { field: "last_order", op: "within_days", value: 30 },
        { field: "purchased_product", op: "is", value: "wildberry" },
        { field: "newsletter_status", op: "is_not", value: "unsubscribed" },
        { field: "tag", op: "has_not", value: "test" },
        { field: "acquisition_source", op: "is_empty" },
        { field: "postal_code_prefix", op: "not_starts_with", value: "1" },
      ],
    });
    expect(sql.where).not.toMatch(/(;|--|\/\*|\*\/)/);
    expect(sql.where).not.toMatch(
      /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do)\b/i,
    );
  });
});

describe("describeRules", () => {
  it("beschreibt Regeln wie im Entwurf", () => {
    const rules: SegmentRules = {
      match: "all",
      conditions: [
        { field: "orders_count", op: "gte", value: 2 },
        { field: "last_order", op: "older_than_days", value: 60 },
        { field: "purchased_product", op: "is", value: "peach" },
      ],
    };
    expect(describeRules(rules, { products: { peach: "Peach" } })).toBe(
      "Bestellungen ≥ 2 und Letzte Bestellung vor mehr als 60 Tagen und Hat Produkt gekauft: Peach",
    );
    expect(describeRules({ match: "all", conditions: [] })).toBe("Alle Kunden");
  });

  it("formatiert Umsatz in Euro", () => {
    expect(
      describeRules({
        match: "any",
        conditions: [{ field: "total_spent_cents", op: "gte", value: 10000 }],
      }),
    ).toBe(`Umsatz ≥ ${formatEur(10000)}`);
  });
});

describe("Schema", () => {
  it("wandelt Zahlen aus Formularen um und lehnt negative Werte ab", () => {
    const ok = segmentRulesSchema.parse({
      conditions: [{ field: "orders_count", op: "gte", value: "3" }],
    });
    expect(ok.match).toBe("all");
    expect(ok.conditions[0]).toEqual({ field: "orders_count", op: "gte", value: 3 });
    expect(
      segmentRulesSchema.safeParse({
        conditions: [{ field: "orders_count", op: "gte", value: -1 }],
      }).success,
    ).toBe(false);
  });

  it("liest ungültige gespeicherte Definitionen als null", () => {
    expect(parseStoredRules({ foo: 1 })).toBeNull();
    expect(parseStoredRules({ match: "all", conditions: [] })).toEqual({
      match: "all",
      conditions: [],
    });
  });
});
