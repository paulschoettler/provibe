import { describe, expect, it } from "vitest";
import {
  centsToInput,
  flattenFormValues,
  nutritionToInputs,
  parseDecimalInput,
  parseNutrition,
  parseProductForm,
} from "./form";
import { kindForLine, productLineOf } from "./lines";

const V1 = "11111111-1111-4111-8111-111111111111";
const B1 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";
const I1 = "44444444-4444-4444-8444-444444444444";

describe("Beträge und Zahlen", () => {
  it("formatiert Cent als Eingabe", () => {
    expect(centsToInput(2610)).toBe("26,10");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(null)).toBe("");
  });
  it("liest Dezimalzahlen mit Komma", () => {
    expect(parseDecimalInput("0,33")).toBe(0.33);
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNaN();
  });
});

describe("Produkttyp", () => {
  const base = { handle: "peach", tags: ["eistee"], productType: "Eistee", isFood: true };
  it("leitet Sorte, Mixed, Bundle und Merch ab", () => {
    expect(productLineOf({ ...base, kind: "simple" })).toBe("sorte");
    expect(productLineOf({ ...base, kind: "simple", handle: "provibe-eistee-mixed" })).toBe(
      "mixed",
    );
    expect(productLineOf({ ...base, kind: "bundle" })).toBe("bundle");
    expect(productLineOf({ ...base, kind: "simple", tags: ["merch"], isFood: false })).toBe(
      "merch",
    );
  });
  it("gespeicherter Typ gewinnt, außer er widerspricht der Art", () => {
    expect(productLineOf({ ...base, kind: "simple", attributes: { product_line: "mixed" } })).toBe(
      "mixed",
    );
    expect(productLineOf({ ...base, kind: "simple", attributes: { product_line: "bundle" } })).toBe(
      "sorte",
    );
    expect(kindForLine("bundle")).toBe("bundle");
    expect(kindForLine("merch")).toBe("simple");
  });
});

describe("Nährwerte", () => {
  it("liest eine Tabelle und meldet Pflichtwerte", () => {
    const errors: Record<string, string> = {};
    const n = parseNutrition(
      {
        "lmiv.nutrition.per": "100 ml",
        "lmiv.nutrition.energy_kj": "91",
        "lmiv.nutrition.energy_kcal": "22",
        "lmiv.nutrition.fat_g": "<0,5",
        "lmiv.nutrition.saturated_fat_g": "<0,1",
        "lmiv.nutrition.carbs_g": "<0,5",
        "lmiv.nutrition.sugar_g": "<0,5",
        "lmiv.nutrition.protein_g": "4.5",
        "lmiv.nutrition.salt_g": "",
      },
      errors,
    );
    expect(n).toMatchObject({ per: "100 ml", energy_kj: 91, protein_g: "4,5" });
    expect(errors["lmiv.nutrition.salt_g"]).toBeTruthy();
  });
  it("alles leer heißt keine Tabelle", () => {
    expect(parseNutrition({}, {})).toBeNull();
  });
  it("Rundreise je Sorte (Mixed)", () => {
    const stored = {
      per: "100 ml",
      variants: {
        peach: {
          per: "100 ml",
          energy_kj: 89,
          energy_kcal: 21,
          fat_g: "<0,5",
          saturated_fat_g: "<0,1",
          carbs_g: "<0,5",
          sugar_g: "<0,5",
          protein_g: "4,5",
          salt_g: "<0,01",
        },
      },
    };
    const inputs = nutritionToInputs(stored);
    expect(inputs["lmiv.nutrition.keys"]).toBe("peach");
    const errors: Record<string, string> = {};
    expect(parseNutrition(inputs, errors)).toEqual(stored);
    expect(errors).toEqual({});
  });
});

describe("Produktformular", () => {
  const form = {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Peach Eistee",
    handle: "Peach",
    status: "active",
    line: "sorte",
    tags: "eistee, Sommer",
    depositCentsPerUnit: "0,25",
    netContentPerUnit: "0,33",
    netContentMeasure: "l",
    basePriceMeasure: "l",
    isFood: "on",
    attributesJson: JSON.stringify({ made_in: "DE" }),
    "collectionIds.present": "1",
    collectionIds: [C1],
    "variants.0.id": V1,
    "variants.0.title": "12 Dosen",
    "variants.0.titleOriginal": "9 Dosen",
    "variants.0.optionValues": JSON.stringify({ Menge: "9 Dosen" }),
    "variants.0.priceCents": "26,10",
    "variants.0.compareAtKind": "none",
    "variants.0.unitCount": "9",
    "variants.0.isActive": "on",
    "variants.1.isNew": "1",
    "variants.1.title": "",
    "variants.1.priceCents": "",
    [`components.${B1}.present`]: "1",
    [`components.${B1}.0.componentVariantId`]: V1,
    [`components.${B1}.0.quantity`]: "2",
    [`components.${B1}.new.componentVariantId`]: C1,
    [`components.${B1}.new.quantity`]: "1",
    [`images.${I1}.alt`]: "Peach Dose",
    [`images.${I1}.altOriginal`]: "Alt",
  };

  it("übersetzt Felder in die Eingaben der Serverlogik", () => {
    const r = parseProductForm(form, { optionName: "Menge", variantCount: 1 });
    expect(r.errors).toEqual({});
    expect(r.product).toMatchObject({
      handle: "peach",
      kind: "simple",
      isFood: true,
      depositCentsPerUnit: 25,
      netContentPerUnit: 0.33,
      tags: ["eistee", "Sommer"],
      collectionIds: [C1],
      attributes: { made_in: "DE", product_line: "sorte" },
    });
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]).toMatchObject({
      id: V1,
      priceCents: 2610,
      unitCount: 9,
      isActive: true,
      optionValues: { Menge: "12 Dosen" },
    });
    expect(r.newVariantIndex).toBeNull();
    expect(r.components).toEqual([
      {
        bundleVariantId: B1,
        items: [
          { componentVariantId: V1, quantity: 2 },
          { componentVariantId: C1, quantity: 1 },
        ],
      },
    ]);
    expect(r.imageAlts).toEqual([{ id: I1, alt: "Peach Dose" }]);
  });

  it("nimmt eine ausgefüllte neue Variante mit Optionswert auf", () => {
    const r = parseProductForm(
      {
        ...form,
        "variants.1.title": "48 Dosen",
        "variants.1.priceCents": "132",
        "variants.1.isActive": "on",
      },
      { optionName: "Menge", variantCount: 1 },
    );
    expect(r.newVariantIndex).toBe(1);
    expect(r.variants[1]).toMatchObject({
      id: undefined,
      priceCents: 13200,
      optionValues: { Menge: "48 Dosen" },
    });
  });

  it("meldet ungültige Beträge und leere Alt-Texte am Feld", () => {
    const r = parseProductForm({
      ...form,
      "variants.0.priceCents": "26,1x",
      depositCentsPerUnit: "x",
      [`images.${I1}.alt`]: "",
    });
    expect(r.errors["variants.0.priceCents"]).toBeTruthy();
    expect(r.errors.depositCentsPerUnit).toBeTruthy();
    expect(r.errors[`images.${I1}.alt`]).toBeTruthy();
  });

  it("ohne Kollektions-Marker bleibt die Zuordnung unverändert", () => {
    const { ["collectionIds.present"]: _p, ...rest } = form;
    expect(parseProductForm(rest).product.collectionIds).toBeUndefined();
  });

  it("Mehrfachwerte für die Wiederanzeige", () => {
    expect(flattenFormValues({ a: ["x", "y"], b: "z" })).toEqual({ a: "x,y", b: "z" });
  });
});
