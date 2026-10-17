import { describe, expect, it } from "vitest";
import { fieldValue, formToConfig, MODULE_FIELDS, moduleSummary } from "./module-fields";

const hero = {
  eyebrow: "Eistee mit Protein",
  headline: "Protein, das in jede Tasche passt.",
  badges: ["15 g Protein", "Ohne Zucker"],
  cta: { url: "/collections/all", label: "Jetzt entdecken" },
  extra: { keep: true },
};

describe("Startseiten-Module", () => {
  it("liest Felder für das Formular", () => {
    const badges = MODULE_FIELDS.hero.fields.find((f) => f.path === "badges")!;
    expect(fieldValue(hero, badges)).toBe("15 g Protein\nOhne Zucker");
  });
  it("übernimmt Formularwerte und behält unbekannte Schlüssel", () => {
    const out = formToConfig(
      "hero",
      {
        "cfg.eyebrow": "Neu",
        "cfg.headline": "",
        "cfg.badges": "A\n\nB ",
        "cfg.cta.label": "",
        "cfg.cta.url": "",
      },
      hero,
    );
    expect(out).toEqual({ eyebrow: "Neu", badges: ["A", "B"], extra: { keep: true } });
  });
  it("baut Listen, entfernt leere und markierte Einträge", () => {
    const base = {
      items: [
        { product_handle: "peach", notes: "Pfirsich", image: "a.png" },
        { product_handle: "wildberry" },
      ],
    };
    const out = formToConfig(
      "flavors",
      {
        "cfg.items.0.product_handle": "peach",
        "cfg.items.0.notes": "Saftig",
        "cfg.items.0.image": "a.png",
        "cfg.items.1.product_handle": "wildberry",
        "cfg.items.1._remove": "on",
        "cfg.items.2.product_handle": "",
        "cfg.items.2.notes": "",
      },
      base,
    );
    expect(out.items).toEqual([{ product_handle: "peach", notes: "Saftig", image: "a.png" }]);
  });
  it("fasst Module zusammen", () => {
    expect(moduleSummary("hero", hero)).toBe("Protein, das in jede Tasche passt.");
    expect(moduleSummary("faq", { items: [{}, {}] })).toBe("2 Fragen");
  });
});
