import type { FruitIconName } from "@/components/brand/BrandIcon";

/**
 * Frucht-Sticker des Heros: CI-Icons aus brand/provibe-ci/icons/fruits (CI-Guide 5),
 * gerendert von FruitIcon. Früher selbst gezeichnete Kontur-Illustrationen; die CI-Icons
 * sind flächig, deshalb entfällt die Kontur.
 *
 * Je Sorte nur die passenden Früchte (CLAUDE.md, Sorten-Logik): Wildberry Erdbeere,
 * Himbeere, Heidelbeere; Raspberry Lime Himbeere und Limettenscheibe; Peach nur Pfirsiche.
 * Doppelte Motive werden gespiegelt, damit die Streuung locker bleibt (CI-Guide 5.5).
 */
export interface FruitSlot {
  name: FruitIconName;
  flip?: boolean;
}

/** Drei Sticker je Sorte: oben links, oben rechts, unten. */
const FRUITS: Record<string, [FruitSlot, FruitSlot, FruitSlot]> = {
  wildberry: [{ name: "himbeere" }, { name: "heidelbeere" }, { name: "erdbeere" }],
  "raspberry-lime": [
    { name: "himbeere" },
    { name: "limette-scheibe" },
    { name: "limette-scheibe", flip: true },
  ],
  peach: [
    { name: "pfirsich-blatt-gross" },
    { name: "pfirsich-rund" },
    { name: "pfirsich-blatt-klein", flip: true },
  ],
};

const FALLBACK: [FruitSlot, FruitSlot, FruitSlot] = [
  { name: "heidelbeere" },
  { name: "erdbeere" },
  { name: "pfirsich-blatt-gross" },
];

export function fruitsFor(slug: string): [FruitSlot, FruitSlot, FruitSlot] {
  return FRUITS[slug] ?? FALLBACK;
}
