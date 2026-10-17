import { describe, expect, it } from "vitest";
import {
  berlinLocalToIso,
  centsToEuroInput,
  euroToCents,
  flag,
  isoToBerlinLocal,
  kgToGrams,
  list,
  percentToBp,
} from "./input";

describe("euroToCents", () => {
  it("liest deutsche und englische Schreibweisen", () => {
    expect(euroToCents("4,90")).toBe(490);
    expect(euroToCents("4.90")).toBe(490);
    expect(euroToCents("50")).toBe(5000);
    expect(euroToCents("1.234,50 €")).toBe(123450);
    expect(euroToCents("1.500")).toBe(150000);
    expect(euroToCents("")).toBeNull();
    expect(euroToCents("abc")).toBeNaN();
  });
  it("gibt Cent als Eingabewert zurück", () => {
    expect(centsToEuroInput(490)).toBe("4,90");
    expect(centsToEuroInput(null)).toBe("");
  });
});

describe("Einheiten", () => {
  it("rechnet Kilogramm und Prozent um", () => {
    expect(kgToGrams("31,5")).toBe(31500);
    expect(kgToGrams("")).toBeNull();
    expect(percentToBp("19")).toBe(1900);
    expect(percentToBp("7,5 %")).toBe(750);
    expect(percentToBp("x")).toBeNaN();
  });
});

describe("FormData", () => {
  it("liest Schalter und Mehrfachwerte", () => {
    const fd = new FormData();
    fd.append("a", "on");
    fd.append("ids", "1");
    fd.append("ids", "1");
    fd.append("ids", "2");
    expect(flag(fd, "a")).toBe(true);
    expect(flag(fd, "b")).toBe(false);
    expect(list(fd, "ids")).toEqual(["1", "2"]);
  });
});

describe("Berliner Ortszeit", () => {
  it("rechnet Sommer- und Winterzeit in UTC um", () => {
    expect(berlinLocalToIso("2026-07-01T12:00")).toBe("2026-07-01T10:00:00.000Z");
    expect(berlinLocalToIso("2026-12-01T12:00")).toBe("2026-12-01T11:00:00.000Z");
    expect(berlinLocalToIso("unsinn")).toBeNull();
  });
  it("ist umkehrbar", () => {
    expect(isoToBerlinLocal("2026-07-01T10:00:00.000Z")).toBe("2026-07-01T12:00");
    expect(isoToBerlinLocal(berlinLocalToIso("2026-03-29T03:30"))).toBe("2026-03-29T03:30");
    expect(isoToBerlinLocal(null)).toBe("");
  });
});
