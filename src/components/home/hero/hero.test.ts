import { describe, expect, it } from "vitest";
import { heroGeometry } from "../hero-geometry";
import { nutritionRows } from "./nutrition";
import { heroWords } from "./words";

describe("heroWords", () => {
  it("liefert die Wortpaare aus dem Entwurf", () => {
    expect(heroWords("wildberry", "Wildberry")).toMatchObject({ back: "WILD", front: "BERRY" });
    expect(heroWords("raspberry-lime", "Raspberry Lime")).toMatchObject({
      back: "RASPBERRY",
      front: "LIME",
    });
    expect(heroWords("peach", "Peach")).toMatchObject({
      back: "JUICY",
      front: "PEACH",
      outline: true,
    });
  });

  it("teilt unbekannte Sorten am Leerzeichen", () => {
    expect(heroWords("mango-maracuja", "Mango Maracuja")).toMatchObject({
      back: "MANGO",
      front: "MARACUJA",
    });
  });
});

describe("nutritionRows", () => {
  const nutrition = {
    per: "100 ml",
    energy_kj: 91,
    energy_kcal: 22,
    salt_g: "<0,01",
    protein_g: "4,5",
    sugar_g: "<0,5",
    fat_g: "<0,5",
    saturated_fat_g: "<0,1",
    carbs_g: "<0,5",
    fibre_g: "<0,5",
  };

  it("sortiert nach LMIV und setzt Energie als eine Kachel", () => {
    const { per, rows } = nutritionRows(nutrition);
    expect(per).toBe("100 ml");
    expect(rows.map((row) => row.key)).toEqual([
      "energy",
      "fat_g",
      "saturated_fat_g",
      "carbs_g",
      "sugar_g",
      "fibre_g",
      "protein_g",
      "salt_g",
    ]);
    expect(rows[0]).toMatchObject({ value: "22 kcal", label: "Energie · 91 kJ", featured: true });
  });

  it("markiert die drei mobilen Kacheln und hebt Eiweiß hervor", () => {
    const { rows } = nutritionRows(nutrition);
    expect(rows.filter((row) => row.featured).map((row) => row.key)).toEqual([
      "energy",
      "sugar_g",
      "protein_g",
    ]);
    expect(rows.find((row) => row.highlight)?.value).toBe("4,5 g");
  });

  it("kommt ohne Nährwerte aus", () => {
    expect(nutritionRows(null)).toEqual({ per: "100 ml", rows: [] });
  });
});

describe("heroGeometry, gestapelter Zoom (Richtung A)", () => {
  for (const [width, height] of [
    [390, 844],
    [360, 640],
    [768, 1024],
  ] as const) {
    it(`hält die gezoomte Dose bei ${width} × ${height} über dem Zutatenpanel`, () => {
      const geometry = heroGeometry(width, height);
      expect(geometry.isSide).toBe(false);
      const center = 0.5 - geometry.canCenterYFraction + geometry.seqShiftYFraction;
      const half = (geometry.canHeightFraction * geometry.seqScale) / 2;
      // Oberkante unter dem Logo, Unterkante vor dem Panel (41,7 Prozent).
      expect(center - half).toBeGreaterThan(0.05);
      expect(center + half).toBeLessThan(0.417);
    });
  }
});
