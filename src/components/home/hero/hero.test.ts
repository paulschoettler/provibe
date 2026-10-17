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
      back: "EISTEE",
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

describe("heroGeometry, gestapelter Zoom auf dem Tablet (Richtung A)", () => {
  for (const [width, height] of [
    [768, 1024],
    [820, 1180],
  ] as const) {
    it(`hält die gezoomte Dose bei ${width} × ${height} über dem Zutatenpanel`, () => {
      const geometry = heroGeometry(width, height);
      expect(geometry.isSide).toBe(false);
      expect(geometry.factsLayout).toBe("stacked");
      const center = 0.5 - geometry.canCenterYFraction + geometry.seqShiftYFraction;
      const half = (geometry.canHeightFraction * geometry.seqScale) / 2;
      // Oberkante unter dem Logo, Unterkante vor dem Panel (41,7 Prozent).
      expect(center - half).toBeGreaterThan(0.05);
      expect(center + half).toBeLessThan(geometry.factsTopFraction);
    });
  }
});

describe("heroGeometry, Zutaten-Schritt auf dem Telefon", () => {
  /** Panel mindestens 400 px, darunter Dock 64 px, 16 px Rand und 12 px Luft. */
  const PANEL_MIN = 400;
  const DOCK_RESERVE = 92;
  const phones = [
    [360, 640],
    [375, 667],
    [390, 844],
    [412, 915],
    [430, 932],
    // mit eingeblendeter Adressleiste (rund 56 px weniger)
    [360, 584],
    [390, 788],
    [412, 859],
  ] as const;

  for (const [width, height] of phones) {
    it(`lässt bei ${width} × ${height} Platz für das ganze Panel`, () => {
      const geometry = heroGeometry(width, height);
      expect(geometry.isMobile).toBe(true);
      expect(geometry.factsLayout).toBe(height < 700 ? "vignette" : "compact");

      const factsTop = geometry.factsTopFraction * height;
      // Panel samt Reserve endet über dem Dock, ohne inneren Scroll.
      expect(factsTop + PANEL_MIN + DOCK_RESERVE).toBeLessThanOrEqual(height + 0.01);

      const centerPx = (0.5 - geometry.canCenterYFraction + geometry.seqShiftYFraction) * height;
      const canPx = geometry.canHeightFraction * geometry.seqScale * height;
      expect(canPx).toBeCloseTo(geometry.zoomHeightFraction * height, 6);

      if (geometry.factsLayout === "compact") {
        // Ganze Dose zwischen Logo (bis 42 px) und Panel, 19 bis 26 Prozent hoch.
        expect(geometry.zoomHeightFraction).toBeGreaterThanOrEqual(0.19);
        expect(geometry.zoomHeightFraction).toBeLessThanOrEqual(0.26);
        expect(centerPx - canPx / 2).toBeGreaterThanOrEqual(50 - 0.01);
        expect(centerPx + canPx / 2).toBeLessThanOrEqual(factsTop - 10 + 0.01);
        expect(geometry.seqShiftXFraction).toBe(0);
      } else {
        // Vignette: Dose im ovalen Fenster links neben dem Titel (Mitte 16 + 16 + 27 px).
        expect(canPx).toBeLessThan(2 * 37);
        const centerX = (0.5 + geometry.seqShiftXFraction) * width;
        expect(centerX).toBeCloseTo(59, 6);
        expect(centerPx).toBeCloseTo(factsTop + 14 + 27, 6);
      }
    });
  }

  it("schiebt die Nachbardosen im Zoom aus dem Bild", () => {
    for (const [width, height] of phones) {
      expect(heroGeometry(width, height).neighborSpreadZoom).toBeGreaterThan(1);
    }
  });

  it("lässt Tablet und Desktop bei ihrem Aufbau", () => {
    expect(heroGeometry(768, 1024).factsLayout).toBe("stacked");
    expect(heroGeometry(1440, 900).factsLayout).toBe("side");
    expect(heroGeometry(1024, 768).factsLayout).toBe("side");
  });
});
