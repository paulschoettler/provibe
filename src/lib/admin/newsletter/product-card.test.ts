import { describe, expect, it } from "vitest";
import { formatEur } from "@/lib/money";
import { toProductCard } from "./product-card";

const v9 = {
  id: "v9",
  title: "9 Dosen",
  priceCents: 2610,
  depositCents: 225,
  basePriceText: "8,03 € / l",
  available: true,
};
const v12 = {
  id: "v12",
  title: "12 Dosen",
  priceCents: 3420,
  depositCents: 300,
  basePriceText: "7,88 € / l",
  available: false,
};
const product = {
  handle: "peach",
  shortTitle: "Peach",
  line1: "Eistee · 0,33 l",
  image: { src: "/images/cans/peach.webp" },
  productUrl: "/products/peach",
  variants: [v9, v12],
  defaultVariant: v9,
};

describe("toProductCard", () => {
  it("zeigt Packpreis, Pfand getrennt und Grundpreis ohne Pfand", () => {
    const card = toProductCard(product, "https://shop.example/");
    expect(card).toEqual({
      title: "Peach",
      line: "Eistee · 0,33 l",
      priceLine: `9 Dosen ${formatEur(2610)}`,
      detailLine: `inkl. ${formatEur(225)} Pfand · Grundpreis 8,03 € / l (ohne Pfand)`,
      imageUrl: "https://shop.example/images/cans/peach.webp",
      url: "https://shop.example/products/peach",
    });
  });
  it("nimmt die gewählte Variante und weist Ausverkauf aus", () => {
    const card = toProductCard(product, "https://shop.example", "v12");
    expect(card.priceLine).toBe(`12 Dosen ${formatEur(3420)}`);
    expect(card.detailLine).toContain("derzeit ausverkauft");
  });
  it("fällt bei unbekannter Variante auf die Standardvariante zurück", () => {
    expect(toProductCard(product, "https://s", "gibt-es-nicht").priceLine).toContain("9 Dosen");
  });
});
