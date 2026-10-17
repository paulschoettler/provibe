import { describe, expect, it } from "vitest";
import { parseCollectionForm, parseRuleRows, ruleValueToInput } from "./form";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";

describe("Regelzeilen", () => {
  it("wandelt Preis in Cent und Ja/Nein in boolean, leere neue Zeile fällt weg", () => {
    const errors: Record<string, string> = {};
    const rules = parseRuleRows(
      {
        "rules.0.field": "price",
        "rules.0.op": "lt",
        "rules.0.value": "30,00",
        "rules.1.field": "is_food",
        "rules.1.op": "eq",
        "rules.1.value": "false",
        "rules.2.field": "tag",
        "rules.2.op": "eq",
        "rules.2.value": "",
        "rules.2.isNew": "1",
        "rules.3.field": "tag",
        "rules.3.op": "eq",
        "rules.3.value": "merch",
        "rules.3.remove": "on",
      },
      errors,
    );
    expect(errors).toEqual({});
    expect(rules).toEqual([
      { field: "price", op: "lt", value: 3000 },
      { field: "is_food", op: "eq", value: false },
    ]);
  });
  it("meldet leere Werte bestehender Zeilen", () => {
    const errors: Record<string, string> = {};
    parseRuleRows({ "rules.0.field": "tag", "rules.0.op": "eq", "rules.0.value": "" }, errors);
    expect(errors["rules.0.value"]).toBeTruthy();
  });
  it("Preis als Eingabetext", () => {
    expect(ruleValueToInput("price", 2610)).toBe("26,10");
    expect(ruleValueToInput("tag", "eistee")).toBe("eistee");
  });
});

describe("Kollektionsformular", () => {
  it("sortiert manuelle Produkte nach Position und hängt neue an", () => {
    const r = parseCollectionForm({
      title: "Eistee",
      kind: "manual",
      status: "published",
      "products.present": "1",
      "products.0.id": P1,
      "products.0.position": "2",
      "products.1.id": P2,
      "products.1.position": "1",
      "products.2.id": P3,
      "products.2.position": "3",
      "products.2.remove": "on",
      addProductIds: [P3],
    });
    expect(r.productIds).toEqual([P2, P1, P3]);
    expect(r.collection).toMatchObject({ kind: "manual", sortKey: "manual", rules: [] });
  });
  it("automatisch: Regeln statt Produktliste", () => {
    const r = parseCollectionForm({
      title: "Merch",
      kind: "automatic",
      sortKey: "title-asc",
      "rules.0.field": "tag",
      "rules.0.op": "eq",
      "rules.0.value": "merch",
      "products.present": "1",
    });
    expect(r.productIds).toBeNull();
    expect(r.collection.rules).toEqual([{ field: "tag", op: "eq", value: "merch" }]);
  });
});
