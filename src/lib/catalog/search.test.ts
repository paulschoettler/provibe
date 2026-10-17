import { describe, expect, it } from "vitest";
import {
  buildSnippet,
  databaseQuery,
  matchStaticPages,
  MAX_QUERY_LENGTH,
  normalizeQuery,
} from "./search";

describe("normalizeQuery", () => {
  it("fasst Leerraum zusammen und begrenzt die Länge", () => {
    expect(normalizeQuery("  peach   eistee ")).toBe("peach eistee");
    expect(normalizeQuery(["wild", "x"])).toBe("wild");
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery("a".repeat(200))).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("databaseQuery", () => {
  it("bildet deutsche Begriffe auf Produktnamen ab und entschärft LIKE-Platzhalter", () => {
    expect(databaseQuery("Pfirsich")).toBe("peach");
    expect(databaseQuery("Bundles")).toBe("bundle");
    expect(databaseQuery("50%_rabatt")).toBe("50  rabatt");
  });
});

describe("buildSnippet", () => {
  it("markiert den Treffer und kürzt davor und danach", () => {
    const text = `${"Vorlauf ".repeat(20)}Peach ist der Klassiker${" Nachlauf".repeat(20)}`;
    const parts = buildSnippet(text, "peach", 30);
    const marked = parts.find((p) => p.mark);
    expect(marked?.text).toBe("Peach");
    expect(parts[0].text.startsWith("… ")).toBe(true);
    expect(parts[parts.length - 1].text.endsWith(" …")).toBe(true);
  });

  it("entfernt Markdown-Links aus dem Shopify-Import", () => {
    const parts = buildSnippet("[Peach Eistee](/products/peach) In den Warenkorb", "peach");
    expect(parts.map((p) => p.text).join("")).toBe("Peach Eistee In den Warenkorb");
  });

  it("liefert ohne Treffer den Textanfang", () => {
    expect(buildSnippet("Nur Text ohne Begriff", "xyz")).toEqual([
      { text: "Nur Text ohne Begriff", mark: false },
    ]);
    expect(buildSnippet("", "xyz")).toEqual([]);
  });
});

describe("matchStaticPages", () => {
  it("findet Rechtstexte und Versand über Schlagworte", () => {
    expect(matchStaticPages("Versand").map((p) => p.url)).toEqual(["/pages/versand"]);
    expect(matchStaticPages("widerruf").map((p) => p.url)).toContain("/pages/widerruf-formular");
    expect(matchStaticPages("x")).toEqual([]);
  });
});
