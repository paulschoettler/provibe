import { describe, expect, it } from "vitest";
import { changedFields, escapeSearch, zodFieldErrors } from "./result";
import {
  basePricePreview,
  bundleComponentErrors,
  catalogRevalidateTargets,
  handleChangeRedirect,
  handleError,
  isValidGtin,
  nextFreeHandle,
  normalizeProductInput,
  normalizeSku,
  normalizeTags,
  optionKey,
  productInputSchema,
  publishErrors,
  slugifyHandle,
  validateVariants,
  variantsInputSchema,
  type ComponentFacts,
  type ProductInput,
} from "./rules";

const baseInput: ProductInput = {
  title: "Peach",
  status: "draft",
  depositCentsPerUnit: 25,
  netContentPerUnit: 0.33,
  netContentMeasure: "l",
  basePriceMeasure: "l",
  isFood: true,
  unitLabel: "Dose",
};

describe("Handle", () => {
  it("leitet Slugs aus deutschen Titeln ab", () => {
    expect(slugifyHandle("Founder Bundle Größe M")).toBe("founder-bundle-groesse-m");
    expect(slugifyHandle("  Eistee & Mehr!  ")).toBe("eistee-und-mehr");
    expect(slugifyHandle("Crème brûlée")).toBe("creme-brulee");
    expect(slugifyHandle("---")).toBe("");
  });
  it("prüft die Datenbankregel", () => {
    expect(handleError("founder-bundle-iii-1")).toBeNull();
    expect(handleError("Peach")).not.toBeNull();
    expect(handleError("peach--x")).not.toBeNull();
    expect(handleError("-peach")).not.toBeNull();
    expect(handleError("")).not.toBeNull();
    expect(handleError("a".repeat(81))).not.toBeNull();
  });
  it("findet freie Handles für Kopien", () => {
    expect(nextFreeHandle("peach", new Set(["peach"]))).toBe("peach-kopie");
    expect(nextFreeHandle("peach", new Set(["peach", "peach-kopie", "peach-kopie-2"]))).toBe(
      "peach-kopie-3",
    );
    expect(nextFreeHandle("a".repeat(80), new Set()).length).toBeLessThanOrEqual(80);
  });
  it("Weiterleitung nur bei geändertem Handle eines veröffentlichten Produkts", () => {
    expect(handleChangeRedirect("peach", "pfirsich", true)).toEqual({
      fromPath: "/products/peach",
      toPath: "/products/pfirsich",
    });
    expect(handleChangeRedirect("peach", "pfirsich", false)).toBeNull();
    expect(handleChangeRedirect("peach", "peach", true)).toBeNull();
    expect(handleChangeRedirect(null, "peach", true)).toBeNull();
    expect(handleChangeRedirect("eistee", "tee", true, "/collections")?.fromPath).toBe(
      "/collections/eistee",
    );
  });
});

describe("GTIN, SKU, Tags", () => {
  it("prüft die Prüfziffer", () => {
    expect(isValidGtin("4006381333931")).toBe(true); // EAN-13
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("96385074")).toBe(true); // EAN-8
    expect(isValidGtin("036000291452")).toBe(true); // UPC-A
    expect(isValidGtin("10614141000415")).toBe(true); // GTIN-14
    expect(isValidGtin("12345")).toBe(false);
    expect(isValidGtin("40063813339a1")).toBe(false);
  });
  it("normalisiert SKU und Tags", () => {
    expect(normalizeSku(" pv-wb 09 ")).toBe("PV-WB-09");
    expect(normalizeSku("  ")).toBeNull();
    expect(normalizeTags([" Eistee", "eistee", "Merch  Shirt", ""])).toEqual([
      "eistee",
      "merch shirt",
    ]);
  });
  it("optionKey ist unabhängig von der Reihenfolge", () => {
    expect(optionKey({ a: "1", b: "2" })).toBe(optionKey({ b: "2", a: "1" }));
  });
});

describe("Produktformular", () => {
  it("füllt Standardwerte und bereinigt HTML", () => {
    const parsed = productInputSchema.parse({
      ...baseInput,
      descriptionHtml: '<p onclick="x">Hallo</p><script>x</script>',
      tags: ["Eistee", "eistee"],
      lmiv: { ingredientsHtml: "<p>Wasser, <strong>Milch</strong></p><img src=x>" },
    });
    const { product, fieldErrors, warnings } = normalizeProductInput(parsed);
    expect(fieldErrors).toEqual({});
    expect(product.handle).toBe("peach");
    expect(product.descriptionHtml).toBe("<p>Hallo</p>");
    expect(product.lmiv.ingredientsHtml).toBe("<p>Wasser, <strong>Milch</strong></p>");
    expect(product.tags).toEqual(["eistee"]);
    expect(product.taxClass).toBe("standard");
    expect(warnings.length).toBe(1);
  });
  it("rundet die Füllmenge auf drei Nachkommastellen", () => {
    const parsed = productInputSchema.parse({ ...baseInput, netContentPerUnit: 0.33333 });
    expect(parsed.netContentPerUnit).toBe(0.333);
  });
  it("lehnt ungültige Werte ab", () => {
    const r = productInputSchema.safeParse({
      ...baseInput,
      title: "",
      depositCentsPerUnit: 2.5,
      attributes: {
        palette: { from: "rot", via: "#fff", to: "#000000", accent: "#000000" },
        Bad: 1,
      },
    });
    expect(r.success).toBe(false);
    const errors = zodFieldErrors(r.error!);
    expect(errors.title).toBeDefined();
    expect(errors.depositCentsPerUnit).toBeDefined();
    expect(errors["attributes.palette.from"]).toBeDefined();
    expect(errors["attributes.Bad"]).toBeDefined();
  });
  it("akzeptiert palette, notes und weitere Attribute", () => {
    const r = productInputSchema.safeParse({
      ...baseInput,
      attributes: {
        palette: { from: "#FBF8EE", via: "#F7CA99", to: "#F3EDA4", accent: "#D97A3A" },
        notes: "Saftiger Pfirsich",
        lactose_free: true,
        protein_g_per_unit: 15,
        caffeine_mg: 0,
      },
    });
    expect(r.success).toBe(true);
  });
  it("prüft Maßeinheit und Füllmenge", () => {
    const parsed = productInputSchema.parse({
      ...baseInput,
      netContentPerUnit: null,
      basePriceMeasure: "kg",
    });
    const { fieldErrors } = normalizeProductInput(parsed);
    expect(fieldErrors.basePriceMeasure).toBeDefined();
    expect(fieldErrors.netContentPerUnit).toBeDefined();
  });
  it("Nährwerte: eine Tabelle oder je Sorte", () => {
    const panel = {
      per: "100 ml",
      energy_kj: 91,
      energy_kcal: 22,
      fat_g: "<0,5",
      saturated_fat_g: "<0,1",
      carbs_g: "<0,5",
      sugar_g: "<0,5",
      protein_g: "4,5",
      salt_g: "<0,01",
    };
    expect(productInputSchema.safeParse({ ...baseInput, lmiv: { nutrition: panel } }).success).toBe(
      true,
    );
    expect(
      productInputSchema.safeParse({
        ...baseInput,
        lmiv: { nutrition: { per: "100 ml", variants: { peach: panel } } },
      }).success,
    ).toBe(true);
    expect(
      productInputSchema.safeParse({
        ...baseInput,
        lmiv: { nutrition: { ...panel, fat_g: "viel" } },
      }).success,
    ).toBe(false);
  });
});

describe("Veröffentlichen", () => {
  const complete = normalizeProductInput(
    productInputSchema.parse({
      ...baseInput,
      lmiv: {
        foodName: "Eistee mit Protein",
        ingredientsHtml: "<p>Wasser, <strong>Milch</strong></p>",
        allergens: "Milch",
        nutrition: { per: "100 ml", variants: {} },
        storageInstructions: "Kühl lagern",
        foodBusinessOperator: "CG Projects UG, Augsburg",
      },
    }),
  ).product;

  it("vollständiges Lebensmittel mit Variante ist veröffentlichbar", () => {
    expect(publishErrors(complete, [{ priceCents: 2610, isActive: true }])).toEqual({});
  });
  it("ohne aktive Variante mit Preis nicht", () => {
    expect(publishErrors(complete, [{ priceCents: 2610, isActive: false }]).variants).toBeDefined();
    expect(publishErrors(complete, [{ priceCents: 0, isActive: true }]).variants).toBeDefined();
  });
  it("LMIV-Pflichtfelder fehlen", () => {
    const e = publishErrors(
      { ...complete, lmiv: { ...complete.lmiv, allergens: null, ingredientsHtml: "<p> </p>" } },
      [{ priceCents: 2610, isActive: true }],
    );
    expect(Object.keys(e).sort()).toEqual(["lmiv.allergens", "lmiv.ingredientsHtml"]);
  });
  it("Lebensmittel brauchen Füllmenge in l oder kg", () => {
    const e = publishErrors(
      { ...complete, netContentMeasure: "piece", basePriceMeasure: "piece" },
      [{ priceCents: 2610, isActive: true }],
    );
    expect(e.netContentPerUnit).toBeDefined();
    expect(e.basePriceMeasure).toBeDefined();
  });
  it("Merch und Bundles ohne LMIV-Pflicht", () => {
    expect(
      publishErrors({ ...complete, isFood: false, lmiv: { ...complete.lmiv, foodName: null } }, [
        { priceCents: 1990, isActive: true },
      ]),
    ).toEqual({});
    expect(
      publishErrors({ ...complete, kind: "bundle", lmiv: { ...complete.lmiv, foodName: null } }, [
        { priceCents: 3580, isActive: true },
      ]),
    ).toEqual({});
  });
});

describe("Grundpreis-Vorschau über src/lib/pricing", () => {
  const product = {
    kind: "simple" as const,
    depositCentsPerUnit: 25,
    netContentPerUnit: 0.33,
    basePriceMeasure: "l" as const,
  };
  it("9er-Pack: (2610 − 225) / 2,97 l = 8,03 €/l", () => {
    expect(basePricePreview(product, { priceCents: 2610, unitCount: 9 })).toEqual({
      cents: 803,
      measure: "l",
      label: "8,03 € / l",
      depositCents: 225,
    });
  });
  it("Pfand höher als Preis ergibt einen Fehler", () => {
    expect(basePricePreview(product, { priceCents: 100, unitCount: 9 })).toEqual({
      error: "Das Pfand ist höher als der Preis.",
    });
  });
  it("Bundles ohne Grundpreis", () => {
    expect(
      basePricePreview({ ...product, kind: "bundle" }, { priceCents: 3580, unitCount: 1 }),
    ).toBeNull();
  });
});

describe("Varianten", () => {
  const parse = (v: unknown[]) => variantsInputSchema.parse(v);
  const ctx = { productKind: "simple" as const, depositCentsPerUnit: 25 };

  it("normalisiert SKU und GTIN, setzt Position", () => {
    const { variants, fieldErrors } = validateVariants(
      parse([
        {
          title: "9 Dosen",
          optionValues: { Menge: "9" },
          priceCents: 2610,
          unitCount: 9,
          sku: "pv-wb-09",
          gtin: "4006 3813 3393 1",
          weightGrams: 3640,
        },
      ]),
      ctx,
    );
    expect(fieldErrors).toEqual({});
    expect(variants[0]).toMatchObject({
      sku: "PV-WB-09",
      gtin: "4006381333931",
      position: 0,
      compareAtCents: null,
    });
  });
  it("erkennt doppelte SKU, GTIN und Optionswerte", () => {
    const { fieldErrors } = validateVariants(
      parse([
        {
          title: "A",
          optionValues: { Menge: "9" },
          priceCents: 2610,
          unitCount: 9,
          sku: "X-1",
          gtin: "4006381333931",
        },
        {
          title: "B",
          optionValues: { Menge: "9" },
          priceCents: 3300,
          unitCount: 12,
          sku: "x-1",
          gtin: "4006381333931",
        },
      ]),
      ctx,
    );
    expect(fieldErrors["variants.1.sku"]).toContain("Variante 1");
    expect(fieldErrors["variants.1.gtin"]).toBeDefined();
    expect(fieldErrors["variants.1.optionValues"]).toBeDefined();
  });
  it("ungültige GTIN und SKU", () => {
    const { fieldErrors } = validateVariants(
      parse([{ title: "A", priceCents: 2610, unitCount: 9, sku: "PV/1", gtin: "4006381333932" }]),
      ctx,
    );
    expect(fieldErrors["variants.0.sku"]).toBeDefined();
    expect(fieldErrors["variants.0.gtin"]).toBeDefined();
  });
  it("Streichpreis-Arten nach H17", () => {
    const { variants, fieldErrors } = validateVariants(
      parse([
        {
          title: "A",
          optionValues: { a: "1" },
          priceCents: 2610,
          unitCount: 9,
          compareAtKind: "none",
          compareAtCents: 2900,
        },
        {
          title: "B",
          optionValues: { a: "2" },
          priceCents: 2610,
          unitCount: 9,
          compareAtKind: "components_sum",
        },
        {
          title: "C",
          optionValues: { a: "3" },
          priceCents: 2610,
          unitCount: 9,
          compareAtKind: "former_price",
          compareAtCents: 2900,
        },
      ]),
      ctx,
    );
    expect(variants[0].compareAtCents).toBeNull();
    expect(fieldErrors["variants.1.compareAtKind"]).toContain("Bundles");
    expect(fieldErrors["variants.2.compareAtKind"]).toContain("H17");
    expect(
      variantsInputSchema.safeParse([
        { title: "D", priceCents: 1, compareAtKind: "quantity_reference" },
      ]).success,
    ).toBe(false);
  });
  it("components_sum bei Bundles wird nicht gespeichert, sondern live berechnet", () => {
    const { variants, fieldErrors } = validateVariants(
      parse([
        { title: "M", priceCents: 4580, compareAtKind: "components_sum", compareAtCents: 9999 },
      ]),
      { productKind: "bundle", depositCentsPerUnit: 0 },
    );
    expect(fieldErrors).toEqual({});
    expect(variants[0].compareAtCents).toBeNull();
  });
  it("früherer Preis nach Freigabe: muss höher als der Preis sein", () => {
    const { fieldErrors } = validateVariants(
      parse([
        {
          title: "A",
          priceCents: 2610,
          unitCount: 9,
          compareAtKind: "former_price",
          compareAtCents: 2500,
        },
      ]),
      { ...ctx, formerPriceEnabled: true },
    );
    expect(fieldErrors["variants.0.compareAtCents"]).toBeDefined();
  });
  it("Preis muss das Pfand decken, Gewicht fehlt als Hinweis", () => {
    const { fieldErrors, warnings } = validateVariants(
      parse([{ title: "48 Dosen", priceCents: 1000, unitCount: 48 }]),
      ctx,
    );
    expect(fieldErrors["variants.0.priceCents"]).toBeDefined();
    expect(warnings[0]).toContain("Gewicht");
  });
  it("Zod: Preis in ganzen Cent, mindestens eine Variante", () => {
    expect(variantsInputSchema.safeParse([{ title: "A", priceCents: 26.1 }]).success).toBe(false);
    expect(variantsInputSchema.safeParse([]).success).toBe(false);
  });
});

describe("Bundle-Komponenten (H14)", () => {
  const facts = new Map<string, ComponentFacts>([
    [
      "11111111-1111-1111-1111-111111111111",
      { productKind: "simple", productStatus: "active", unitCount: 1, title: "Peach · 1 Dose" },
    ],
    [
      "22222222-2222-2222-2222-222222222222",
      { productKind: "simple", productStatus: "active", unitCount: 9, title: "Peach · 9 Dosen" },
    ],
    [
      "33333333-3333-3333-3333-333333333333",
      { productKind: "bundle", productStatus: "active", unitCount: 1, title: "Bundle" },
    ],
    [
      "44444444-4444-4444-4444-444444444444",
      { productKind: "simple", productStatus: "archived", unitCount: 1, title: "Alt" },
    ],
  ]);
  const bundle = "99999999-9999-9999-9999-999999999999";

  it("Einzeldose mit Menge ist gültig", () => {
    expect(
      bundleComponentErrors(
        bundle,
        [{ componentVariantId: "11111111-1111-1111-1111-111111111111", quantity: 2 }],
        facts,
      ),
    ).toEqual({});
  });
  it("Packs, Bundles, Archiviertes, Selbstbezug, Doppelte und Unbekanntes werden abgelehnt", () => {
    const e = bundleComponentErrors(
      bundle,
      [
        { componentVariantId: "22222222-2222-2222-2222-222222222222", quantity: 1 },
        { componentVariantId: "33333333-3333-3333-3333-333333333333", quantity: 1 },
        { componentVariantId: "44444444-4444-4444-4444-444444444444", quantity: 1 },
        { componentVariantId: bundle, quantity: 1 },
        { componentVariantId: "22222222-2222-2222-2222-222222222222", quantity: 1 },
        { componentVariantId: "55555555-5555-5555-5555-555555555555", quantity: 1 },
      ],
      facts,
    );
    expect(e["components.0.componentVariantId"]).toContain("H14");
    expect(e["components.1.componentVariantId"]).toContain("Bundles");
    expect(e["components.2.componentVariantId"]).toContain("archiviert");
    expect(e["components.3.componentVariantId"]).toContain("selbst");
    expect(e["components.4.componentVariantId"]).toContain("schon");
    expect(e["components.5.componentVariantId"]).toContain("gibt es nicht");
  });
});

describe("Revalidation und Hilfen", () => {
  it("nennt Startseite, Shop, Kollektionen, Sitemap und betroffene Seiten", () => {
    const t = catalogRevalidateTargets({
      productHandles: ["peach", "peach"],
      allCollections: true,
    });
    expect(t).toContainEqual({ path: "/" });
    expect(t).toContainEqual({ path: "/pages/shop" });
    expect(t).toContainEqual({ path: "/sitemap.xml" });
    expect(t).toContainEqual({ path: "/collections/[handle]", type: "page" });
    expect(t.filter((x) => x.path === "/products/peach")).toHaveLength(1);
    expect(catalogRevalidateTargets({ allProducts: true })).toContainEqual({
      path: "/products/[handle]",
      type: "page",
    });
  });
  it("changedFields liefert nur Änderungen", () => {
    expect(
      changedFields({ a: 1, b: ["x"], c: null }, { a: 1, b: ["x", "y"], c: undefined }),
    ).toEqual({
      before: { b: ["x"] },
      after: { b: ["x", "y"] },
    });
    expect(changedFields({ a: 1 }, { a: 1 })).toBeNull();
    expect(changedFields(null, { a: 1 })).toEqual({ before: { a: null }, after: { a: 1 } });
  });
  it("escapeSearch entfernt PostgREST-Sonderzeichen", () => {
    expect(escapeSearch("peach,(id.eq.1)*%")).toBe("peach id eq 1");
  });
});
