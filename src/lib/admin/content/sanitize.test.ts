import { describe, expect, it } from "vitest";
import { sanitizeRichHtml, textLength } from "./sanitize";

describe("sanitizeRichHtml", () => {
  it("entfernt Skripte, Event-Handler und gefährliche Links", () => {
    const out = sanitizeRichHtml(
      `<p onclick="x()">Hallo<script>alert(1)</script> <a href="javascript:alert(1)">böse</a> <a href="https://x.de" target="_blank" rel="opener">gut</a></p><iframe src="https://evil"></iframe>`,
    );
    expect(out).toBe(
      `<p>Hallo <a>böse</a> <a href="https://x.de" target="_blank" rel="noopener noreferrer">gut</a></p>`,
    );
  });
  it("behält erlaubte Struktur, macht aus h1 ein h2 und filtert Attribute", () => {
    const out = sanitizeRichHtml(
      `<h1 class="x">Titel</h1><ul><li style="color:red">Punkt</li></ul><img src="data:image/png;base64,AAA" alt="x"><img src="/media/a.png" alt="A" width="300" onerror="x">`,
    );
    expect(out).toBe(
      `<h2>Titel</h2><ul><li>Punkt</li></ul><img alt="x"><img src="/media/a.png" alt="A" width="300">`,
    );
  });
  it("lässt unbekannte Tags weg, behält ihren Text und entfernt Kommentare", () => {
    expect(sanitizeRichHtml(`<custom-el>Text</custom-el><!-- geheim --><p>a < b</p>`)).toBe(
      `Text<p>a &lt; b</p>`,
    );
  });
  it("misst die Textlänge", () => {
    expect(textLength("<p> Hallo&nbsp;Welt </p>")).toBe(10);
    expect(textLength("<p></p>")).toBe(0);
  });
});
