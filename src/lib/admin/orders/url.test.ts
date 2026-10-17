import { describe, expect, it } from "vitest";
import { isChecked, parseCount, parseEuroToCents, parseKgToGrams } from "./form-input";
import { parseOrderFilter, selectedIds } from "./filters";
import { filterFromParams, idsFrom, periodRange, sortFrom, tabFrom } from "./url";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("Bestellliste: URL → Filter", () => {
  it("blendet Testbestellungen außerhalb des Tabs Test aus", () => {
    expect(filterFromParams({}).test).toBe("exclude");
    expect(filterFromParams({ tab: "offen" })).toMatchObject({
      status: "pending",
      test: "exclude",
    });
    expect(filterFromParams({ tab: "test" })).toMatchObject({ status: undefined, test: "only" });
    expect(tabFrom({ tab: "quatsch" })).toBe("alle");
  });

  it("übernimmt Suche, Zahlart, Sortierung und Seite", () => {
    const f = filterFromParams({
      q: " PV-10001 ",
      zahlart: "invoice",
      sort: "gesamt",
      dir: "asc",
      seite: "3",
    });
    expect(f).toMatchObject({
      search: "PV-10001",
      paymentMethod: "invoice",
      sort: "total_asc",
      page: 3,
    });
    expect(sortFrom({ sort: "kaputt" })).toEqual({ key: "datum", dir: "desc" });
    const parsed = parseOrderFilter(f as Record<string, unknown>);
    expect(parsed.sort).toBe("total_asc");
    expect(parsed.test).toBe("exclude");
  });

  it("rechnet Zeiträume in Europe/Berlin", () => {
    const now = new Date("2026-10-17T10:00:00Z");
    expect(periodRange({ zeitraum: "heute" }, now)).toEqual({
      from: "2026-10-16T22:00:00.000Z",
      to: "2026-10-17T21:59:59.999Z",
    });
    expect(periodRange({ zeitraum: "vormonat" }, now)).toEqual({
      from: "2026-08-31T22:00:00.000Z",
      to: "2026-09-30T21:59:59.999Z",
    });
    expect(periodRange({ zeitraum: "eigener", von: "2026-03-29", bis: "2026-03-29" }, now)).toEqual(
      {
        from: "2026-03-28T23:00:00.000Z",
        to: "2026-03-29T21:59:59.999Z",
      },
    );
    expect(periodRange({}, now)).toBeNull();
    expect(periodRange({ von: "kein-datum" }, now)).toBeNull();
  });

  it("liest die Auswahl tolerant und zeigt dann auch Testbestellungen", () => {
    expect(idsFrom({ ids: [A, `${B},${A}`, "<script>"] })).toEqual([A, B]);
    const f = filterFromParams({ ids: [A, B] });
    expect(f.test).toBe("include");
    const parsed = parseOrderFilter(f as Record<string, unknown>);
    expect(selectedIds(parsed)).toEqual([A, B]);
    expect(filterFromParams({ ids: A }, { ignoreSelection: true }).ids).toBeUndefined();
    expect(parseOrderFilter({ ids: "drop table" }).ids).toBeUndefined();
  });
});

describe("Formulareingaben", () => {
  it("liest Euro-Beträge als Cent", () => {
    expect(parseEuroToCents("26,10")).toBe(2610);
    expect(parseEuroToCents("26.1")).toBe(2610);
    expect(parseEuroToCents("1.234,50 €")).toBe(123450);
    expect(parseEuroToCents("26")).toBe(2600);
    expect(parseEuroToCents("-5")).toBeNull();
    expect(parseEuroToCents("2,555")).toBeNull();
    expect(parseEuroToCents("")).toBeNull();
  });

  it("liest Gewichte, Checkboxen und Mengen", () => {
    expect(parseKgToGrams("4,2")).toBe(4200);
    expect(parseKgToGrams("0,75 kg")).toBe(750);
    expect(parseKgToGrams("abc")).toBeNull();
    expect(isChecked("on")).toBe(true);
    expect(isChecked(null)).toBe(false);
    expect(parseCount("")).toBe(0);
    expect(parseCount("3")).toBe(3);
    expect(parseCount("-1")).toBeNull();
  });
});
