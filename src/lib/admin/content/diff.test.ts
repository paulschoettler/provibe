import { describe, expect, it } from "vitest";
import { diffParagraphs, diffWords, similarity, splitParagraphs } from "./diff";

describe("splitParagraphs", () => {
  it("teilt an Block-Tags und ignoriert leere Absätze", () => {
    const p = splitParagraphs(
      "<h2>§ 1 Geltung</h2><p>Text <strong>eins</strong>.</p><p> </p><ul><li>Punkt</li></ul>",
    );
    expect(p.map((x) => [x.tag, x.text])).toEqual([
      ["h2", "§ 1 Geltung"],
      ["p", "Text eins ."],
      ["li", "Punkt"],
    ]);
  });
  it("teilt Text ohne Tags an Leerzeilen", () => {
    expect(splitParagraphs("Eins\n\nZwei").map((x) => x.text)).toEqual(["Eins", "Zwei"]);
  });
});

describe("diffWords", () => {
  it("markiert ersetzte Wörter", () => {
    expect(diffWords("Hosting durch Shopify Inc.", "Hosting durch Netlify Inc.")).toEqual([
      { type: "equal", text: "Hosting durch" },
      { type: "removed", text: "Shopify" },
      { type: "added", text: "Netlify" },
      { type: "equal", text: "Inc." },
    ]);
  });
});

describe("diffParagraphs", () => {
  const oldHtml =
    "<h2>Hosting</h2><p>Unser Shop wird bei Shopify Inc. gehostet.</p><p>Zahlungen über Shop Pay.</p><p>Kontakt per E-Mail.</p>";
  const newHtml =
    "<h2>Hosting</h2><p>Unser Shop wird bei Netlify Inc. gehostet.</p><p>Kontakt per E-Mail.</p><p>Rechnungen erstellt Lexware Office.</p>";

  it("erkennt gleich, geändert, entfernt und hinzugefügt", () => {
    const d = diffParagraphs(oldHtml, newHtml);
    expect(d.ops.map((o) => o.type)).toEqual(["equal", "changed", "removed", "equal", "added"]);
    expect(d.summary).toEqual({ equal: 2, added: 1, removed: 1, changed: 1 });
    const changed = d.ops[1];
    expect(changed.type === "changed" && changed.words).toContainEqual({
      type: "added",
      text: "Netlify",
    });
  });

  it("liefert nur gleiche Absätze bei identischem Text trotz anderem Markup", () => {
    const d = diffParagraphs("<p>A  b</p>", "<p>A <em>b</em></p>");
    expect(d.summary).toEqual({ equal: 1, added: 0, removed: 0, changed: 0 });
  });

  it("zeigt völlig neue Absätze nicht als Änderung", () => {
    const d = diffParagraphs("<p>Alpha Beta Gamma</p>", "<p>Völlig anderer Inhalt hier</p>");
    expect(d.ops.map((o) => o.type)).toEqual(["removed", "added"]);
  });

  it("misst Ähnlichkeit", () => {
    expect(similarity("a b c", "a b c")).toBe(1);
    expect(similarity("a b", "c d")).toBe(0);
  });
});
