import { describe, expect, it } from "vitest";
import { htmlToParagraphs, shortDescription } from "./short-description";

const PEACH =
  "<p><strong>Pfirsich-Eistee – der Klassiker von provibe</strong></p>" +
  "<p>Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schwarztee. " +
  "Das Ergebnis: eine ausgewogene Erfrischung mit vollem Geschmack – fruchtig, aber nicht aufdringlich, angenehm süß, aber nie zu viel. " +
  "Genau die richtige Balance für alle, die einen ehrlichen, unkomplizierten Eistee genießen möchten.</p>" +
  "<p>Pfand bereits im Preis inkl. (0,25€ pro Dose)</p>";

const RASPBERRY =
  "<p>Raspberry Lime vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis. " +
  "Die perfekt ausbalancierte Kombination aus süß und säuerlich sorgt für einen erfrischenden Genuss, der weder zu schwer noch zu intensiv wirkt.</p>";

describe("shortDescription", () => {
  it("überspringt Überschriften ohne Satzende und nimmt zwei Sätze, wenn sie passen", () => {
    expect(shortDescription(PEACH)).toBe(
      "Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schwarztee. " +
        "Das Ergebnis: eine ausgewogene Erfrischung mit vollem Geschmack – fruchtig, aber nicht aufdringlich, angenehm süß, aber nie zu viel.",
    );
  });

  it("bleibt bei einem Satz, wenn der zweite die Grenze sprengt", () => {
    expect(shortDescription(RASPBERRY)).toBe(
      "Raspberry Lime vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis.",
    );
  });

  it("lässt den Pfandhinweis weg und liefert null ohne Text", () => {
    expect(shortDescription("<p>Pfand bereits im Preis inkl. (0,25€ pro Dose)</p>")).toBeNull();
    expect(shortDescription(null)).toBeNull();
    expect(shortDescription("")).toBeNull();
  });

  it("kürzt einen überlangen ersten Satz am Wortende mit Auslassungspunkten", () => {
    const long = `<p>${"Sehr langer Satz ".repeat(30).trim()}.</p>`;
    const result = shortDescription(long, 80);
    expect(result).toMatch(/…$/);
    expect(result!.length).toBeLessThanOrEqual(80);
  });

  it("löst Entities auf und trennt an Block-Elementen und Zeilenumbrüchen", () => {
    expect(
      htmlToParagraphs("<h2>Titel</h2><p>S&uuml;&szlig; &amp; frisch.<br>Zweite Zeile.</p>"),
    ).toEqual(["Titel", "Süß & frisch.", "Zweite Zeile."]);
  });
});
