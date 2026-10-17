import { describe, expect, it } from "vitest";
import { planPackComponents, type PackComponent } from "./packs";

const wb = (q: number): PackComponent[] => [{ componentVariantId: "wb1", quantity: q }];
const mix = (q: number): PackComponent[] => [
  { componentVariantId: "wb1", quantity: q },
  { componentVariantId: "rl1", quantity: q },
  { componentVariantId: "pe1", quantity: q },
];

describe("Pack-Komponenten (H24)", () => {
  it("neues Sorten-Pack bekommt unit_count Dosen, die Einzeldose bleibt Lagereinheit", () => {
    const plan = planPackComponents(
      [
        { id: "wb1", unitCount: 1 },
        { id: "wb9", unitCount: 9 },
        { id: "wb12", unitCount: 12 },
        { id: "wb6", unitCount: 6 },
      ],
      new Map([
        ["wb9", wb(9)],
        ["wb12", wb(12)],
      ]),
    );
    expect(plan.set).toEqual([{ variantId: "wb6", items: wb(6) }]);
    expect(plan.skipped).toEqual([]);
  });

  it("geänderte Einheiten ziehen die Dosen nach", () => {
    const plan = planPackComponents(
      [
        { id: "wb1", unitCount: 1 },
        { id: "wb9", unitCount: 9 },
        { id: "wb24", unitCount: 20 },
      ],
      new Map([
        ["wb9", wb(9)],
        ["wb24", wb(24)],
      ]),
    );
    expect(plan.set).toEqual([{ variantId: "wb24", items: wb(20) }]);
  });

  it("Mixed: je ein Drittel, nicht teilbare Einheiten werden gemeldet", () => {
    const plan = planPackComponents(
      [
        { id: "mx9", unitCount: 9 },
        { id: "mx30", unitCount: 30 },
        { id: "mx10", unitCount: 10, title: "10 Dosen" },
      ],
      new Map([["mx9", mix(3)]]),
    );
    expect(plan.set).toEqual([{ variantId: "mx30", items: mix(10) }]);
    expect(plan.skipped).toEqual([{ variantId: "mx10", title: "10 Dosen", unitCount: 10 }]);
  });

  it("ohne vorhandene Packs (Merch, neue Produkte) passiert nichts", () => {
    expect(
      planPackComponents(
        [
          { id: "s", unitCount: 1 },
          { id: "m", unitCount: 1 },
        ],
        new Map(),
      ),
    ).toEqual({ set: [], skipped: [] });
  });
});
