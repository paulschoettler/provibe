import { describe, expect, it } from "vitest";
import { calculateBasePrice, formatBasePrice } from "./base-price";

const eistee = { depositCentsPerUnit: 25, netContentPerUnit: 0.33, measure: "l" as const };

describe("Grundpreis", () => {
  it("rechnet das Pfand heraus (9er-Pack wie im alten Shop: 8,03 €/l)", () => {
    const bp = calculateBasePrice({ ...eistee, priceCents: 2610, unitCount: 9 });
    expect(bp.depositCents).toBe(225);
    expect(bp.priceWithoutDepositCents).toBe(2385);
    expect(bp.cents).toBe(803);
    expect(formatBasePrice(bp)).toBe("8,03 € / l");
  });

  it("ist je Packgröße unterschiedlich (der alte Shop zeigte überall 8,03)", () => {
    expect(calculateBasePrice({ ...eistee, priceCents: 3460, unitCount: 12 }).cents).toBe(798);
    expect(calculateBasePrice({ ...eistee, priceCents: 13200, unitCount: 48 }).cents).toBe(758);
  });

  it("funktioniert ohne Pfand (Standardwert 0)", () => {
    expect(
      calculateBasePrice({ ...eistee, depositCentsPerUnit: 0, priceCents: 2610, unitCount: 9 })
        .cents,
    ).toBe(879);
  });

  it("fällt bei Stückware auf Preis je Stück zurück", () => {
    const bp = calculateBasePrice({
      priceCents: 2990,
      depositCentsPerUnit: 0,
      unitCount: 1,
      netContentPerUnit: null,
      measure: "piece",
    });
    expect(bp.cents).toBe(2990);
    expect(formatBasePrice(bp)).toBe("29,90 € / Stück");
  });

  it("lehnt Pfand über dem Preis ab", () => {
    expect(() => calculateBasePrice({ ...eistee, priceCents: 100, unitCount: 9 })).toThrow(
      RangeError,
    );
  });
});
