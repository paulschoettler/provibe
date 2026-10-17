import { describe, expect, it } from "vitest";
import { backOut, canTransform, finaleFrame, windowed } from "./choreography";
import { finalePriceLine } from "./price";

describe("finaleFrame", () => {
  it("Zustand 1 (Fortschritt 0) entspricht dem Einstieg aus dem Entwurf", () => {
    const f = finaleFrame(0);
    expect(f.logo.scale).toBe(0.5);
    expect(f.blob).toEqual({ scale: 0.6, opacity: 0.4, rotate: 20 });
    expect(f.cans.wildberry).toEqual({ x: -70, y: 30, rotate: -32, opacity: 1 });
    expect(f.cans.peach).toEqual({ x: 70, y: 30, rotate: 32, opacity: 1 });
    expect(f.cans["raspberry-lime"]).toEqual({ x: 0, y: 60, rotate: 0, opacity: 0 });
    expect(f.sticker.scale).toBe(0);
    expect(f.fruit.opacity).toBe(0);
    expect(f.copy).toEqual({ opacity: 0, y: 24 });
  });

  it("Zustand 2 (Fortschritt 0,5) trifft die Zwischenwerte des Entwurfs", () => {
    const f = finaleFrame(0.5);
    // Logo wächst linear bis 0,7: 0,5 + 0,5 × (0,5 / 0,7) = 0,857
    expect(f.logo.scale).toBeCloseTo(0.857, 2);
    expect(f.blob).toEqual({ scale: 1, opacity: 1, rotate: 6 });
    expect(f.cans.wildberry.x).toBeCloseTo(-27, 0);
    expect(f.cans.wildberry.y).toBeCloseTo(11.5, 0);
    expect(f.cans.wildberry.rotate).toBeCloseTo(-18, 0);
    expect(f.cans.peach.x).toBeCloseTo(32, 0);
    expect(f.cans.peach.y).toBeCloseTo(14, 0);
    expect(f.cans.peach.rotate).toBeCloseTo(20, 0);
    expect(f.cans["raspberry-lime"].y).toBeCloseTo(33, 0);
    expect(f.cans["raspberry-lime"].opacity).toBe(1);
    expect(f.sticker.scale).toBe(0);
    expect(f.copy.opacity).toBe(0);
  });

  it("Zustand 3 (Fortschritt 1) ist der CSS-Endzustand", () => {
    const f = finaleFrame(1);
    expect(f.logo.scale).toBe(1);
    expect(f.cans.wildberry).toEqual({ x: 0, y: 0, rotate: -9, opacity: 1 });
    expect(f.cans.peach).toEqual({ x: 0, y: 0, rotate: 9, opacity: 1 });
    expect(f.cans["raspberry-lime"]).toEqual({ x: 0, y: 0, rotate: 0, opacity: 1 });
    expect(f.sticker).toEqual({ scale: 1, rotate: 12 });
    expect(f.fruit.opacity).toBe(1);
    expect(f.copy).toEqual({ opacity: 1, y: 0 });
  });

  it("hält ab 0,95 still und begrenzt Werte außerhalb von 0 bis 1", () => {
    expect(finaleFrame(0.96)).toEqual(finaleFrame(1));
    expect(finaleFrame(1.4)).toEqual(finaleFrame(1));
    expect(finaleFrame(-0.2)).toEqual(finaleFrame(0));
  });

  it("Headline erscheint erst im Fenster 0,6 bis 0,9", () => {
    expect(finaleFrame(0.6).copy.opacity).toBe(0);
    expect(finaleFrame(0.75).copy.opacity).toBeCloseTo(0.5, 5);
    expect(finaleFrame(0.9).copy.opacity).toBe(1);
  });
});

describe("Hilfsfunktionen", () => {
  it("windowed rechnet linear im Fenster", () => {
    expect(windowed(0.1, [0.1, 0.75])).toBe(0);
    expect(windowed(0.425, [0.1, 0.75])).toBeCloseTo(0.5, 5);
    expect(windowed(0.9, [0.1, 0.75])).toBe(1);
  });

  it("backOut federt über 1 hinaus und endet genau auf 1", () => {
    expect(backOut(0)).toBeCloseTo(0, 10);
    expect(backOut(1)).toBe(1);
    const peak = Math.max(...Array.from({ length: 21 }, (_, i) => backOut(i / 20)));
    expect(peak).toBeGreaterThan(1.05);
  });

  it("canTransform schreibt vw, vh und Grad", () => {
    expect(canTransform({ x: -70, y: 30, rotate: -32, opacity: 1 })).toBe(
      "translate3d(-70vw, 30vh, 0) rotate(-32deg)",
    );
  });
});

describe("finalePriceLine", () => {
  const pack = (priceWithoutDepositCents: number, depositCents: number, basePriceText: string) => ({
    pack: { unitCount: 9, priceWithoutDepositCents, depositCents, basePriceText },
    depositPerCanCents: 25,
  });

  it("nimmt den günstigsten 9er-Pack und weist Pfand getrennt aus (H22)", () => {
    const line = finalePriceLine([pack(2610, 225, "8,79 € / l"), pack(2385, 225, "8,03 € / l")]);
    expect(line).toEqual({
      unitCount: 9,
      price: "23,85 €",
      deposit: "2,25 €",
      basePrice: "8,03 € / l",
      depositPerCan: "0,25 €",
    });
  });

  it("liefert null ohne Katalogdaten", () => {
    expect(finalePriceLine([])).toBeNull();
  });
});
