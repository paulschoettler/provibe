import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  applyBasisPoints,
  formatEur,
  includedTaxFromGross,
  netFromGross,
} from "./index";

describe("money", () => {
  it("formatiert Cent als Euro im deutschen Format", () => {
    expect(formatEur(2610)).toBe("26,10\u00a0€");
    expect(formatEur(0)).toBe("0,00\u00a0€");
    expect(formatEur(13200)).toBe("132,00\u00a0€");
  });

  it("wendet Basispunkte kaufmännisch gerundet an", () => {
    expect(applyBasisPoints(2610, 1000)).toBe(261);
    expect(applyBasisPoints(3345, 1000)).toBe(335); // 334,5 → 335
    expect(applyBasisPoints(1, 5000)).toBe(1); // 0,5 → 1
  });

  it("rechnet enthaltene MwSt. heraus", () => {
    expect(includedTaxFromGross(11900, 1900)).toBe(1900);
    expect(netFromGross(11900, 1900)).toBe(10000);
    expect(includedTaxFromGross(2610, 1900)).toBe(417); // 2610 / 1,19 = 2193,28 → Steuer 416,72 → 417
    expect(includedTaxFromGross(1000, 700)).toBe(65);
  });

  it("verteilt Beträge ohne Rundungsdifferenz", () => {
    const parts = allocateProportionally(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocateProportionally(261, [2610, 1990])).toEqual([148, 113]);
    expect(allocateProportionally(0, [1, 2])).toEqual([0, 0]);
  });
});
