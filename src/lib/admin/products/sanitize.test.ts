import { describe, expect, it } from "vitest";
import { htmlToPlainText, isSafeHref, sanitizeHtml } from "./sanitize";

describe("sanitizeHtml (rich)", () => {
  it("lässt erlaubte Tags stehen und entfernt alle Attribute außer href", () => {
    expect(
      sanitizeHtml(
        '<p data-end="37" class="x" style="color:red"><strong data-start="0">Das ultimative</strong> Bundle</p>',
      ),
    ).toBe("<p><strong>Das ultimative</strong> Bundle</p>");
  });

  it("entfernt script, style und iframe samt Inhalt", () => {
    expect(
      sanitizeHtml(
        '<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x">y</iframe><p>b</p>',
      ),
    ).toBe("<p>a</p><p>b</p>");
  });

  it("verschachtelte Drop-Tags werden vollständig entfernt", () => {
    expect(sanitizeHtml("<svg><svg><script>x</script></svg>t</svg><p>ok</p>")).toBe("<p>ok</p>");
  });

  it("behält Text unbekannter Tags", () => {
    expect(sanitizeHtml("<div><section>Hallo <font>Welt</font></section></div>")).toBe(
      "Hallo Welt",
    );
  });

  it("entfernt Event-Handler und gefährliche Links", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">klick</a>')).toBe(
      "<a>klick</a>",
    );
    expect(sanitizeHtml('<a href="jav&#x09;ascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).toBe("");
  });

  it("erlaubt http(s), mailto, tel und relative Links, target _blank mit rel", () => {
    expect(sanitizeHtml('<a href="https://provibe-drinks.de" target="_blank">x</a>')).toBe(
      '<a href="https://provibe-drinks.de" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeHtml('<a href="/pages/versand">Versand</a>')).toBe(
      '<a href="/pages/versand">Versand</a>',
    );
    expect(sanitizeHtml('<a href="mailto:hello@provibe-drinks.de">m</a>')).toContain("mailto:");
  });

  it("macht aus h1 eine h2 und schließt offene Tags", () => {
    expect(sanitizeHtml("<h1>Titel</h1><p>Text <strong>fett")).toBe(
      "<h2>Titel</h2><p>Text <strong>fett</strong></p>",
    );
  });

  it("verwirft verwaiste schließende Tags und Kommentare", () => {
    expect(sanitizeHtml("</p><!-- geheim --><p>a</em></p>")).toBe("<p>a</p>");
  });

  it("maskiert spitze Klammern im Text und lose &", () => {
    expect(sanitizeHtml("<p>1 < 2 & 3 > 2 &amp; ok</p>")).toBe(
      "<p>1 &lt; 2 &amp; 3 &gt; 2 &amp; ok</p>",
    );
  });

  it("Attribut mit > in Anführungszeichen bricht den Tag nicht", () => {
    expect(sanitizeHtml('<p title="a>b">x</p>')).toBe("<p>x</p>");
  });

  it("leere Eingabe und leere Absätze", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml("<p> </p><p>a</p>")).toBe("<p>a</p>");
  });
});

describe("sanitizeHtml (inline, Zutaten)", () => {
  it("erlaubt nur Hervorhebungen und Absätze", () => {
    expect(
      sanitizeHtml(
        '<ul><li>Wasser, <strong>Molkenprotein</strong> (<b>Milch</b>)</li></ul><a href="/">x</a>',
        "inline",
      ),
    ).toBe("Wasser, <strong>Molkenprotein</strong> (<b>Milch</b>)x");
  });
});

describe("Hilfen", () => {
  it("isSafeHref", () => {
    expect(isSafeHref("https://a.de")).toBe(true);
    expect(isSafeHref("#faq")).toBe(true);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeHref("vbscript:x")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
  it("htmlToPlainText", () => {
    expect(htmlToPlainText("<p>a&nbsp;<b>b</b></p>")).toBe("a b");
  });
});
