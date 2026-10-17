import { describe, expect, it } from "vitest";
import {
  htmlNodes,
  linkifyEmails,
  mergeAdjacentLists,
  slugify,
  stripLeadingTitle,
  stripTags,
  structureLegalHtml,
} from "./html";

/** Wortlaut ohne Markup, um zu prüfen, dass die Strukturierung keinen Text verändert. */
const words = (html: string) => stripTags(html).replace(/\s+/g, " ");

describe("slugify", () => {
  it("macht deutsche Überschriften zu Ankern", () => {
    expect(slugify("Folgen des Widerrufs")).toBe("folgen-des-widerrufs");
    expect(slugify("Ausschluss- bzw. Erlöschensgründe")).toBe("ausschluss-bzw-erloeschensgruende");
    expect(slugify("§ 2 Zustandekommen des Vertrages")).toBe(
      "paragraf-2-zustandekommen-des-vertrages",
    );
    expect(slugify("???")).toBe("abschnitt");
  });
});

describe("Hilfsfunktionen", () => {
  it("entfernt doppelte Titelzeilen am Anfang", () => {
    expect(stripLeadingTitle("<p>Impressum</p><p>Impressum</p><p>Text</p>", "Impressum")).toBe(
      "<p>Text</p>",
    );
    expect(stripLeadingTitle("<h1>Datenschutzerklärung</h1><p>A</p>", "Datenschutzerklärung")).toBe(
      "<p>A</p>",
    );
  });

  it("führt Einzellisten zusammen", () => {
    expect(mergeAdjacentLists("<ul><li>a</li></ul><ul><li>b</li></ul>")).toBe(
      "<ul><li>a</li><li>b</li></ul>",
    );
  });

  it("verlinkt E-Mail-Adressen, aber nicht in bestehenden Links", () => {
    expect(linkifyEmails("<p>E-Mail: hello@provibe-drinks.de</p>")).toBe(
      '<p>E-Mail: <a href="mailto:hello@provibe-drinks.de">hello@provibe-drinks.de</a></p>',
    );
    const linked = '<p><a href="mailto:a@b.de">a@b.de</a></p>';
    expect(linkifyEmails(linked)).toBe(linked);
  });

  it("liest Knoten in Reihenfolge", () => {
    const nodes = htmlNodes("<p>01</p><h2>Die Idee</h2><ul><li>eins</li></ul>");
    expect(nodes.map((n) => `${n.tag}:${n.text}`)).toEqual(["p:01", "h2:Die Idee", "li:eins"]);
  });
});

describe("structureLegalHtml", () => {
  it("Widerruf: H2 aus festen Zeilen, Wortlaut unverändert", () => {
    const src =
      "<p>Rückgabe- und Widerrufsbelehrung</p><p>Widerrufsrecht für den Verkauf von Waren</p>" +
      "<p>Widerrufsrecht für Verbraucher</p><p>(Verbraucher ist …)</p><p>Widerrufsbelehrung</p>" +
      "<p>Widerrufsrecht</p><p>Sie haben das Recht, binnen 14 Tagen …</p>" +
      "<p>Folgen des Widerrufs</p><p>Text</p><p>Das Widerrufsrecht besteht nicht bei Verträgen</p>" +
      "<ul><li>a;</li></ul><ul><li>b.</li></ul>";
    const out = structureLegalHtml("widerruf", src, "Rückgabe- und Widerrufsbelehrung");
    expect(out.toc.map((t) => t.label)).toEqual([
      "Widerrufsrecht für Verbraucher",
      "Widerrufsrecht",
      "Folgen des Widerrufs",
    ]);
    expect(out.html).toContain('<h2 id="folgen-des-widerrufs">Folgen des Widerrufs</h2>');
    expect(out.html).toContain("<h3>Widerrufsbelehrung</h3>");
    expect(out.html).toContain("<p>Das Widerrufsrecht besteht nicht bei Verträgen</p>");
    expect(out.html).toContain("<ul><li>a;</li><li>b.</li></ul>");
    expect(words(out.html)).toBe(words(src).replace(/^Rückgabe- und Widerrufsbelehrung /, ""));
  });

  it("AGB: Paragrafen und Teile als H2, nummerierte Kundeninformationen als H3", () => {
    const src =
      "<p>Allgemeine Geschäftsbedingungen</p><p>I. Allgemeine Geschäftsbedingungen</p>" +
      "<p>§ 1 Grundlegende Bestimmungen</p><p>(1) Text.</p><p>II. Kundeninformationen</p>" +
      "<p>1. Identität des Verkäufers</p><p>3.1. Vertragssprache ist deutsch .</p>";
    const out = structureLegalHtml("agb", src, "Allgemeine Geschäftsbedingungen");
    expect(out.toc.map((t) => t.label)).toEqual([
      "I. Allgemeine Geschäftsbedingungen",
      "§ 1 Grundlegende Bestimmungen",
      "II. Kundeninformationen",
    ]);
    expect(out.html).toContain("<h3>1. Identität des Verkäufers</h3>");
    expect(out.html).toContain("<p>3.1. Vertragssprache ist deutsch .</p>");
  });

  it("Impressum: Abschnitte nach Figma, Zeilen unverändert", () => {
    const src =
      "<p>Impressum</p><p>Impressum</p><p>Gesetzliche Anbieterkennung:</p><p>CG Projects UG (haftungsbeschränkt)</p>" +
      "<p>Telefon: +491629231702</p><p>E-Mail: hello@provibe-drinks.de</p><p>USt-IdNr.: DE457662597</p>" +
      "<p>Wir sind nicht bereit und nicht verpflichtet, …</p>";
    const out = structureLegalHtml("impressum", src, "Impressum");
    expect(out.toc.map((t) => t.label)).toEqual([
      "Anbieter",
      "Kontakt",
      "Register und Umsatzsteuer",
      "Verbraucherstreitbeilegung",
    ]);
    expect(out.html).toContain('<a href="mailto:hello@provibe-drinks.de">');
    expect(out.html).toContain("<p>CG Projects UG (haftungsbeschränkt)</p>");
  });

  it("übernimmt vorhandene H2 und stuft eine H1 im Text herab", () => {
    const src = "<h1>Datenschutzerklärung</h1><p>Intro</p><h2>Kontakt</h2><p>x</p><h1>Anhang</h1>";
    const out = structureLegalHtml("datenschutz", src, "Datenschutzerklärung");
    expect(out.html).not.toContain("<h1");
    expect(out.toc.map((t) => t.label)).toEqual(["Kontakt", "Anhang"]);
  });
});
