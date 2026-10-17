import { describe, expect, it } from "vitest";
import {
  buildVariantView,
  bundleSummary,
  catalogHref,
  cleanDescriptionHtml,
  componentKind,
  htmlToText,
  matchesFilter,
  netContentText,
  nutritionTable,
  parseCatalogParams,
  pickDefaultVariant,
  productTypeOf,
  readableRange,
  shortTitleOf,
  sortComponents,
  sortProducts,
  sortRankOf,
  splitLead,
  truncate,
  type BundleComponentView,
} from "./products";

const variant = (unitCount: number, priceCents: number, id = `v${unitCount}`) => ({
  id,
  title: `${unitCount} Dosen`,
  option_values: { Menge: String(unitCount) },
  unit_count: unitCount,
  price_cents: priceCents,
  sku: `PV-WB-${unitCount}`,
});

describe("productTypeOf", () => {
  it("erkennt Sorte, Mixed, Bundle und Merch aus den Daten", () => {
    expect(
      productTypeOf({
        kind: "simple",
        tags: ["eistee"],
        attributes: { palette: { from: "#fff" } },
      }),
    ).toBe("sorte");
    expect(productTypeOf({ kind: "simple", tags: ["eistee"], attributes: {} })).toBe("mixed");
    expect(productTypeOf({ kind: "bundle", tags: ["bundle", "aktion"], attributes: {} })).toBe(
      "bundle",
    );
    expect(productTypeOf({ kind: "simple", tags: ["merch"], attributes: {} })).toBe("merch");
  });
});

describe("shortTitleOf und sortRankOf", () => {
  it("kürzt Sortennamen wie im Entwurf", () => {
    expect(shortTitleOf("raspberry-lime", "sorte", "Raspberry-Lime Eistee")).toBe("Raspberry Lime");
    expect(shortTitleOf("neu", "sorte", "Mango Eistee")).toBe("Mango");
    expect(shortTitleOf("provibe-eistee-mixed", "mixed", "provibe Eistee mixed")).toBe("Mixed");
    expect(shortTitleOf("founder-bundle-ii", "bundle", "Founder Bundle II")).toBe(
      "Founder Bundle II",
    );
  });

  it("sortiert Sorten vor Mix, Bundles und Merch", () => {
    const ranks = [
      sortRankOf("provibe-shirt", "merch", "provibe shirt"),
      sortRankOf("founder-bundle-iii-1", "bundle", "Founder Bundle III"),
      sortRankOf("founder-bundle-i", "bundle", "Founder Bundle I"),
      sortRankOf("provibe-eistee-mixed", "mixed", "provibe Eistee mixed"),
      sortRankOf("peach", "sorte", "Peach Eistee"),
      sortRankOf("wildberry", "sorte", "Wildberry Eistee"),
    ];
    expect([...ranks].sort((a, b) => a - b)).toEqual([...ranks].reverse());
  });
});

describe("buildVariantView", () => {
  it("rechnet Preis je Dose und Grundpreis ohne Pfand (9er: 26,10 € → 2,65 € und 8,03 €/l)", () => {
    const v = buildVariantView({
      variant: variant(9, 2610),
      depositCentsPerUnit: 25,
      netContentPerUnit: 0.33,
      measure: "l",
    });
    expect(v.depositCents).toBe(225);
    // Hauptpreis ohne Pfand (§ 7 PAngV, H22): 26,10 € − 2,25 € = 23,85 €
    expect(v.goodsPriceCents).toBe(2385);
    expect(v.priceCents).toBe(2610);
    expect(v.perUnitCents).toBe(265);
    expect(v.basePriceCents).toBe(803);
    expect(v.basePriceText).toBe("8,03 € / l");
    expect(v.optionValue).toBe("9");
  });

  it("48er-Pack: 132,00 € → 2,50 € je Dose und 7,58 €/l", () => {
    const v = buildVariantView({
      variant: variant(48, 13200),
      depositCentsPerUnit: 25,
      netContentPerUnit: 0.33,
      measure: "l",
    });
    expect(v.perUnitCents).toBe(250);
    expect(v.basePriceText).toBe("7,58 € / l");
  });

  it("Merch ohne Grundpreis und ohne Pfand", () => {
    const v = buildVariantView({
      variant: { ...variant(1, 2990), title: "M", option_values: { Größe: "M" } },
      depositCentsPerUnit: 0,
      netContentPerUnit: null,
      measure: "piece",
    });
    expect(v.basePriceText).toBeNull();
    expect(v.basePriceCents).toBeNull();
    expect(v.depositCents).toBe(0);
    expect(v.goodsPriceCents).toBe(2990);
    expect(v.componentsSumGoodsCents).toBeNull();
    expect(v.optionValue).toBe("M");
  });

  it("Bundle: Pfand aus den Komponenten, Einzelsumme durchgereicht", () => {
    const v = buildVariantView({
      variant: { ...variant(1, 5740), title: "S" },
      depositCentsPerUnit: 150,
      netContentPerUnit: null,
      measure: "piece",
      componentsSumCents: 6720,
    });
    expect(v.depositCents).toBe(150);
    expect(v.componentsSumCents).toBe(6720);
    // Founder Bundle III: 57,40 € → 55,90 € zzgl. 1,50 € Pfand, einzeln 65,70 € ohne Pfand
    expect(v.goodsPriceCents).toBe(5590);
    expect(v.componentsSumGoodsCents).toBe(6570);
  });

  it("begrenzt Pfand, das über dem Preis läge, auf 0", () => {
    const v = buildVariantView({
      variant: variant(9, 100),
      depositCentsPerUnit: 25,
      netContentPerUnit: 0.33,
      measure: "l",
    });
    expect(v.depositCents).toBe(0);
    expect(v.goodsPriceCents).toBe(100);
  });
});

describe("pickDefaultVariant", () => {
  it("nimmt den 9er-Pack, sonst die erste Variante", () => {
    const views = [12, 9, 18].map((n) =>
      buildVariantView({
        variant: variant(n, n * 290),
        depositCentsPerUnit: 0,
        netContentPerUnit: null,
        measure: "piece",
      }),
    );
    expect(pickDefaultVariant(views)?.unitCount).toBe(9);
    expect(pickDefaultVariant(views.filter((v) => v.unitCount !== 9))?.unitCount).toBe(12);
    expect(pickDefaultVariant([])).toBeUndefined();
  });
});

describe("Filter und Sortierung", () => {
  const products = [
    { handle: "shirt", type: "merch" as const, priceFromCents: 2990, sortRank: 3000 },
    { handle: "bundle-i", type: "bundle" as const, priceFromCents: 3580, sortRank: 2001 },
    { handle: "peach", type: "sorte" as const, priceFromCents: 2610, sortRank: 20 },
    { handle: "mixed", type: "mixed" as const, priceFromCents: 2610, sortRank: 1000 },
  ];

  it("filtert nach Eistee, Bundles und Merch", () => {
    expect(products.filter((p) => matchesFilter(p, "eistee")).map((p) => p.handle)).toEqual([
      "peach",
      "mixed",
    ]);
    expect(products.filter((p) => matchesFilter(p, "bundles")).map((p) => p.handle)).toEqual([
      "bundle-i",
    ]);
    expect(products.filter((p) => matchesFilter(p, "merch")).map((p) => p.handle)).toEqual([
      "shirt",
    ]);
    expect(products.filter((p) => matchesFilter(p, "alle"))).toHaveLength(4);
  });

  it("sortiert nach Beliebtheit, Kollektionsposition und Preis", () => {
    expect(sortProducts(products, "beliebt").map((p) => p.handle)).toEqual([
      "peach",
      "mixed",
      "bundle-i",
      "shirt",
    ]);
    const positions = new Map([
      ["shirt", 0],
      ["peach", 1],
      ["mixed", 2],
      ["bundle-i", 3],
    ]);
    expect(sortProducts(products, "beliebt", positions)[0].handle).toBe("shirt");
    expect(sortProducts(products, "preis-auf").map((p) => p.handle)).toEqual([
      "peach",
      "mixed",
      "shirt",
      "bundle-i",
    ]);
    expect(sortProducts(products, "preis-ab").map((p) => p.handle)).toEqual([
      "bundle-i",
      "shirt",
      "peach",
      "mixed",
    ]);
  });

  it("prüft Suchparameter und baut Links ohne Standardwerte", () => {
    expect(parseCatalogParams({ filter: "merch", sort: "preis-ab" })).toEqual({
      filter: "merch",
      sort: "preis-ab",
    });
    expect(parseCatalogParams({ filter: "<script>", sort: ["preis-auf", "x"] })).toEqual({
      filter: "alle",
      sort: "preis-auf",
    });
    expect(catalogHref("/collections/all", "alle", "beliebt")).toBe("/collections/all");
    expect(catalogHref("/collections/all", "eistee", "preis-auf")).toBe(
      "/collections/all?filter=eistee&sort=preis-auf",
    );
  });
});

describe("nutritionTable", () => {
  it("formatiert Werte je 100 ml mit Einheit und Einrückung", () => {
    const t = nutritionTable({
      per: "100 ml",
      energy_kj: 91,
      energy_kcal: 22,
      fat_g: "<0,5",
      saturated_fat_g: "<0,1",
      carbs_g: "<0,5",
      sugar_g: "<0,5",
      fibre_g: "<0,5",
      protein_g: "4,5",
      salt_g: "<0,01",
    })!;
    expect(t.columns).toEqual(["je 100 ml"]);
    expect(t.rows[0]).toMatchObject({ label: "Energie", values: ["91 kJ / 22 kcal"] });
    expect(t.rows.find((r) => r.label === "Fett")?.values).toEqual(["< 0,5 g"]);
    expect(t.rows.find((r) => r.label === "davon Zucker")?.indent).toBe(true);
    expect(t.rows.find((r) => r.label === "Eiweiß")).toMatchObject({
      values: ["4,5 g"],
      strong: true,
    });
  });

  it("baut für Mixed eine Spalte je Sorte in fester Reihenfolge", () => {
    const t = nutritionTable({
      per: "100 ml",
      variants: {
        peach: { energy_kj: 89, energy_kcal: 21, protein_g: "4,5" },
        wildberry: { energy_kj: 91, energy_kcal: 22, protein_g: "4,5" },
      },
    })!;
    expect(t.columns).toEqual(["Wildberry", "Peach"]);
    expect(t.rows[0].values).toEqual(["91 kJ / 22 kcal", "89 kJ / 21 kcal"]);
  });

  it("liefert null ohne Daten", () => {
    expect(nutritionTable(null)).toBeNull();
    expect(nutritionTable({})).toBeNull();
  });
});

describe("Bundles", () => {
  const c = (
    kind: BundleComponentView["kind"],
    quantity: number,
    handle: string = kind,
  ): BundleComponentView => ({
    kind,
    quantity,
    productHandle: handle,
    label: handle,
    imageUrl: null,
    unitCount: 1,
    depositCentsPerUnit: kind === "dose" ? 25 : 0,
  });

  it("erkennt die Art der Komponente", () => {
    expect(componentKind("peach", ["eistee"])).toBe("dose");
    expect(componentKind("provibe-clear-cup", ["merch"])).toBe("becher");
    expect(componentKind("provibe-shirt", ["merch"])).toBe("shirt");
  });

  it("beschreibt den Inhalt wie im Entwurf", () => {
    const cans = [c("dose", 2, "peach"), c("dose", 2, "wildberry"), c("dose", 2, "raspberry-lime")];
    expect(bundleSummary([...cans, c("becher", 1)])).toBe("6 Dosen und Trinkbecher");
    expect(bundleSummary([...cans, c("shirt", 1)])).toBe("6 Dosen und T-Shirt");
    expect(bundleSummary([...cans, c("becher", 1), c("shirt", 1)])).toBe(
      "6 Dosen, Becher und Shirt",
    );
    expect(bundleSummary([])).toBeNull();
  });

  it("ordnet Dosen nach Sorte, dann Becher, dann Shirt", () => {
    const sorted = sortComponents([
      c("shirt", 1, "provibe-shirt"),
      c("dose", 2, "peach"),
      c("becher", 1, "provibe-clear-cup"),
      c("dose", 2, "wildberry"),
      c("dose", 2, "raspberry-lime"),
    ]);
    expect(sorted.map((x) => x.productHandle)).toEqual([
      "wildberry",
      "raspberry-lime",
      "peach",
      "provibe-clear-cup",
      "provibe-shirt",
    ]);
  });
});

describe("Texthilfen", () => {
  it("entfernt Editor-Attribute, Skripte und leere Absätze", () => {
    const html =
      '<p data-start="0" data-end="5"><strong>Hi</strong></p><p> </p><script>alert(1)</script><p onclick="x()">Text</p><ul><li>a</li><li>\n</li></ul>';
    expect(cleanDescriptionHtml(html)).toBe(
      "<p><strong>Hi</strong></p><p>Text</p><ul><li>a</li></ul>",
    );
    expect(cleanDescriptionHtml(null)).toBeNull();
  });

  it("trennt den fetten Einleitungssatz ab", () => {
    expect(splitLead("<p><strong>Das ultimative provibe Bundle!</strong></p><p>Mehr</p>")).toEqual({
      lead: "Das ultimative provibe Bundle!",
      body: "<p>Mehr</p>",
    });
    expect(splitLead("<p>Ohne Lead</p>")).toEqual({ lead: null, body: "<p>Ohne Lead</p>" });
  });

  it("macht aus HTML Text und kürzt an Wortgrenzen", () => {
    expect(htmlToText("<p>Eins&nbsp;zwei</p><p>drei &amp; vier</p>")).toBe("Eins zwei drei & vier");
    expect(truncate("Ein langer Satz mit vielen Wörtern", 20)).toBe("Ein langer Satz mit …");
    expect(truncate("kurz", 20)).toBe("kurz");
  });

  it("formatiert Füllmenge und Zeitspannen", () => {
    expect(netContentText(0.33, "l")).toBe("0,33 l");
    expect(netContentText(null, "piece")).toBeNull();
    expect(readableRange("3–5 Werktage")).toBe("3 bis 5 Werktage");
  });
});
