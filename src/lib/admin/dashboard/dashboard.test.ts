import { describe, expect, it } from "vitest";
import {
  lowStock,
  niceMax,
  percentDelta,
  revenueSeries,
  splitByPeriod,
  splitNewReturning,
  summarize,
  topProducts,
  type MetricOrder,
} from "./metrics";
import { addDays, berlinDay, berlinMidnight, berlinOffsetMinutes, parsePeriod } from "./period";

describe("Zeiträume in Europe/Berlin", () => {
  it("Mitternacht Sommer- und Winterzeit", () => {
    expect(berlinMidnight("2026-10-17").toISOString()).toBe("2026-10-16T22:00:00.000Z");
    expect(berlinMidnight("2026-12-01").toISOString()).toBe("2026-11-30T23:00:00.000Z");
    // Tag der Zeitumstellung (25.10.2026, 3 Uhr wird 2 Uhr)
    expect(berlinMidnight("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(berlinMidnight("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(berlinOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(120);
    expect(berlinOffsetMinutes(new Date("2026-01-01T12:00:00Z"))).toBe(60);
  });
  it("Berliner Kalendertag kurz nach Mitternacht", () => {
    expect(berlinDay(new Date("2026-10-16T22:30:00Z"))).toBe("2026-10-17");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  const now = new Date("2026-10-24T10:00:00Z");
  it("7 Tage (Standard) mit Vergleich zur Vorwoche", () => {
    const p = parsePeriod({}, now);
    expect(p.key).toBe("7");
    expect(p.days).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(p.from.toISOString()).toBe("2026-10-17T22:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(p.prevFrom.toISOString()).toBe("2026-10-10T22:00:00.000Z");
    expect(p.label).toBe("18.10. bis 24.10.2026");
    expect(p.prevLabel).toBe("11.10. bis 17.10.2026");
    expect(p.bucket).toBe("day");
  });
  it("Heute stündlich", () => {
    const p = parsePeriod({ zeitraum: "heute" }, now);
    expect(p.days).toEqual(["2026-10-24"]);
    expect(p.bucket).toBe("hour");
    expect(p.prevLabel).toBe("23.10.2026");
  });
  it("Benutzerdefiniert: vertauscht, gekappt auf heute, ungültig fällt auf 7 Tage", () => {
    const p = parsePeriod({ von: "2026-10-30", bis: "2026-10-20" }, now);
    expect(p.key).toBe("custom");
    expect(p.fromDay).toBe("2026-10-20");
    expect(p.toDay).toBe("2026-10-24");
    expect(parsePeriod({ von: "2026-02-30", bis: "2026-03-01" }, now).key).toBe("7");
    expect(parsePeriod({ von: "2020-01-01", bis: "2026-10-24" }, now).days).toHaveLength(366);
  });
});

const o = (id: string, placed_at: string, total_cents: number, email = "a@x.de"): MetricOrder => ({
  id,
  placed_at,
  total_cents,
  email,
});

describe("Kennzahlen", () => {
  it("Umsatz, Anzahl, Warenkorb", () => {
    expect(
      summarize([o("1", "2026-10-20T10:00:00Z", 3100), o("2", "2026-10-20T11:00:00Z", 6190)]),
    ).toEqual({
      revenueCents: 9290,
      orders: 2,
      aovCents: 4645,
    });
    expect(summarize([])).toEqual({ revenueCents: 0, orders: 0, aovCents: 0 });
  });
  it("Veränderung in Prozent", () => {
    expect(percentDelta(112, 100)).toEqual({ text: "+12,0 %", direction: "up" });
    expect(percentDelta(97, 100)).toEqual({ text: "−3,0 %", direction: "down" });
    expect(percentDelta(100, 100)).toEqual({ text: "±0,0 %", direction: "flat" });
    expect(percentDelta(5, 0)).toBeNull();
  });
  it("Reihe je Tag mit Vorzeitraum an derselben Position", () => {
    const p = parsePeriod({}, new Date("2026-10-24T10:00:00Z"));
    const rows = [
      o("a", "2026-10-17T22:30:00Z", 1000), // 18.10. Berlin, erster Tag
      o("b", "2026-10-24T21:59:00Z", 500), // 24.10. Berlin, letzter Tag
      o("c", "2026-10-10T22:30:00Z", 700), // 11.10., erster Tag Vorzeitraum
      o("d", "2026-10-24T22:00:00Z", 999), // 25.10., außerhalb
    ];
    const { current, previous } = splitByPeriod(rows, p);
    expect(current.map((r) => r.id)).toEqual(["a", "b"]);
    expect(previous.map((r) => r.id)).toEqual(["c"]);
    const s = revenueSeries(current, previous, p);
    expect(s).toHaveLength(7);
    expect(s[0]).toMatchObject({
      key: "2026-10-18",
      label: "So 18.",
      current: 1000,
      previous: 700,
    });
    expect(s[6]).toMatchObject({ current: 500, previous: 0 });
  });
  it("Neu- gegen Bestandskunden", () => {
    const split = splitNewReturning(
      [
        o("1", "2026-10-20T10:00:00Z", 1000, "neu@x.de"),
        o("2", "2026-10-21T10:00:00Z", 2000, "NEU@x.de"),
        o("3", "2026-10-21T11:00:00Z", 3000, "alt@x.de"),
      ],
      new Set(["alt@x.de"]),
    );
    expect(split).toEqual({
      total: 3,
      newCustomers: { orders: 1, revenueCents: 1000 },
      returning: { orders: 2, revenueCents: 5000 },
    });
  });
  it("Top-Produkte und niedrige Bestände", () => {
    const top = topProducts([
      { product_id: "p1", product_title: "Wildberry", quantity: 2, line_total_cents: 5000 },
      { product_id: "p2", product_title: "Peach", quantity: 1, line_total_cents: 2610 },
      { product_id: "p1", product_title: "Wildberry", quantity: 1, line_total_cents: 2610 },
    ]);
    expect(top[0]).toEqual({
      productId: "p1",
      title: "Wildberry",
      quantity: 3,
      revenueCents: 7610,
    });
    const low = lowStock([
      { variantId: "v1", title: "A", onHand: 50, reserved: 0, threshold: 10 },
      { variantId: "v2", title: "B", onHand: 6, reserved: 2, threshold: 10 },
      { variantId: "v3", title: "C", onHand: 1, reserved: 1, threshold: 5 },
    ]);
    expect(low.map((l) => [l.variantId, l.available, l.soldOut])).toEqual([
      ["v3", 0, true],
      ["v2", 4, false],
    ]);
  });
  it("Achsenmaximum", () => {
    expect(niceMax(0)).toBe(100);
    expect(niceMax(73_000)).toBe(100_000);
    expect(niceMax(61_000)).toBe(100_000);
    expect(niceMax(38_000)).toBe(40_000);
    expect(niceMax(80_000)).toBe(100_000);
  });
});
