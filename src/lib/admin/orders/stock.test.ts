import { describe, expect, it } from "vitest";
import {
  capRestock,
  directlyBookedVariants,
  expandStock,
  packUnitsFrom,
  restockableByVariant,
} from "./stock";

/** Lagereinheit Dose (H24, ADR-018): Rückbuchung in Dosen, alte Bestellungen weiter auf dem Pack. */
const packUnits = packUnitsFrom([
  { bundle_variant_id: "wb9", component_variant_id: "wb1", quantity: 9 },
  { bundle_variant_id: "mx12", component_variant_id: "wb1", quantity: 4 },
  { bundle_variant_id: "mx12", component_variant_id: "rl1", quantity: 4 },
  { bundle_variant_id: "mx12", component_variant_id: "pe1", quantity: 4 },
]);

describe("Rückbuchung in Dosen (H24)", () => {
  it("löst Packs über bundle_components in Dosen auf", () => {
    const m = expandStock(
      [
        { variantId: "wb9", components: null, quantity: 2 },
        { variantId: "mx12", components: null, quantity: 1 },
      ],
      { packUnits },
    );
    expect(Object.fromEntries(m)).toEqual({ wb1: 22, rl1: 4, pe1: 4 });
  });

  it("Bundles über den Snapshot, Merch bleibt eigene Lagereinheit", () => {
    const m = expandStock(
      [
        {
          variantId: "fb1",
          components: [
            { variant_id: "wb1", quantity: 2 },
            { variant_id: "rl1", quantity: 2 },
            { variant_id: "pe1", quantity: 2 },
            { variant_id: "cup", quantity: 1 },
          ],
          quantity: 1,
        },
        { variantId: "shirt-m", components: null, quantity: 1 },
      ],
      { packUnits },
    );
    expect(Object.fromEntries(m)).toEqual({ wb1: 2, rl1: 2, pe1: 2, cup: 1, "shirt-m": 1 });
  });

  it("Bundle-Komponente, die selbst ein Pack ist, wird eine Ebene tiefer aufgelöst", () => {
    const m = expandStock(
      [
        {
          variantId: "set",
          components: [
            { variant_id: "wb9", quantity: 1 },
            { variant_id: "cup", quantity: 1 },
          ],
          quantity: 2,
        },
      ],
      { packUnits },
    );
    expect(Object.fromEntries(m)).toEqual({ wb1: 18, cup: 2 });
  });

  it("Bestellungen von vor der Umstellung buchen auf das Pack zurück", () => {
    const movements = [{ variant_id: "wb9", delta: -1, reason: "sale" }];
    const m = expandStock([{ variantId: "wb9", components: null, quantity: 1 }], {
      packUnits,
      bookedDirectly: directlyBookedVariants(movements),
    });
    expect(Object.fromEntries(m)).toEqual({ wb9: 1 });
    expect(capRestock(m, restockableByVariant(movements)).apply).toEqual([
      { variantId: "wb9", quantity: 1 },
    ]);
  });

  it("Storno nach H24: Abgang in Dosen, Rückbuchung in Dosen, nie doppelt", () => {
    const movements = [
      { variant_id: "wb1", delta: -13, reason: "sale" },
      { variant_id: "rl1", delta: -4, reason: "sale" },
      { variant_id: "pe1", delta: -4, reason: "sale" },
    ];
    const requested = expandStock(
      [
        { variantId: "wb9", components: null, quantity: 1 },
        { variantId: "mx12", components: null, quantity: 1 },
      ],
      { packUnits, bookedDirectly: directlyBookedVariants(movements) },
    );
    const first = capRestock(requested, restockableByVariant(movements));
    expect(first.apply).toEqual([
      { variantId: "wb1", quantity: 13 },
      { variantId: "rl1", quantity: 4 },
      { variantId: "pe1", quantity: 4 },
    ]);
    const after = [
      ...movements,
      ...first.apply.map((a) => ({
        variant_id: a.variantId,
        delta: a.quantity,
        reason: "correction",
      })),
    ];
    expect(capRestock(requested, restockableByVariant(after)).apply).toEqual([]);
  });
});
