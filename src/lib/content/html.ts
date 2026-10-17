/**
 * Reine HTML-Helfer für Inhalte aus pages, legal_document_versions und blog_post_translations.
 * Kein DOM, keine Abhängigkeiten, damit alles serverseitig und testbar bleibt.
 *
 * Grundsatz für Rechtstexte: Der Wortlaut bleibt unverändert. Die Helfer ändern nur Markup
 * (Überschriften-Tags, Anker-ids, Links auf E-Mail-Adressen, zusammengelegte Listen)
 * und entfernen Überschriften, die den Seitentitel doppeln (die Seite hat genau eine H1).
 */

export type LegalKind = "impressum" | "agb" | "widerruf" | "datenschutz" | "versand";

export interface TocEntry {
  id: string;
  label: string;
}

export interface StructuredHtml {
  html: string;
  toc: TocEntry[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Text ohne Tags, Entities aufgelöst, Leerraum normalisiert. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Sprechende Anker-id aus deutschem Text ("Folgen des Widerrufs" → "folgen-des-widerrufs"). */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/§/g, "paragraf-")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "abschnitt"
  );
}

/** Aufeinanderfolgende einzelne Listen (<ul><li>…</li></ul><ul>…) zu einer Liste zusammenführen. */
export function mergeAdjacentLists(html: string): string {
  return html.replace(/<\/ul>\s*<ul>/g, "").replace(/<\/ol>\s*<ol>/g, "");
}

/** Führende Überschriften oder Absätze entfernen, die nur den Seitentitel wiederholen. */
export function stripLeadingTitle(html: string, title: string): string {
  const want = stripTags(title).toLowerCase();
  let out = html.trimStart();
  for (;;) {
    const m = out.match(/^<(h1|h2|p)(\s[^>]*)?>([\s\S]*?)<\/\1>\s*/i);
    if (!m || stripTags(m[3]).toLowerCase() !== want) return out;
    out = out.slice(m[0].length);
  }
}

/** E-Mail-Adressen im Fließtext verlinken (nicht innerhalb vorhandener Links oder Tags). */
export function linkifyEmails(html: string): string {
  const parts = html.split(/(<[^>]+>)/);
  let inLink = 0;
  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<a[\s>]/i.test(part)) inLink++;
        else if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1);
        return part;
      }
      if (inLink > 0) return part;
      return part.replace(
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
        (m) => `<a href="mailto:${m}">${m}</a>`,
      );
    })
    .join("");
}

/**
 * Überschriften für Rechtstexte ohne eigene H2 (Shopify-Import liefert nur Absätze).
 * Die Regeln greifen nur, wenn der Text keine einzige <h2> enthält; eine im Backoffice
 * gepflegte Fassung mit echten Überschriften wird unverändert übernommen.
 */
type Level = "h2" | "h3" | "lead";
type Rule = (text: string) => Level | null;

const exact =
  (map: Record<string, Level>): Rule =>
  (t) =>
    map[t] ?? null;

const LEGAL_RULES: Partial<Record<LegalKind, Rule>> = {
  agb: (t) => {
    if (t === "Allgemeine Geschäftsbedingungen und Kundeninformationen") return "lead";
    if (/^§\s*\d+\s+\S/.test(t) && t.length <= 90) return "h2";
    if (/^[IVX]+\.\s+\S/.test(t) && t.length <= 90) return "h2";
    if (/^\d+\.\s+[A-ZÄÖÜ]/.test(t) && t.length <= 90 && !/[.:;,]$/.test(t)) return "h3";
    return null;
  },
  widerruf: exact({
    "Widerrufsrecht für den Verkauf von Waren": "lead",
    "Widerrufsrecht für Verbraucher": "h2",
    Widerrufsbelehrung: "h3",
    Widerrufsrecht: "h2",
    "Folgen des Widerrufs": "h2",
    "Ausschluss- bzw. Erlöschensgründe": "h2",
    "Muster-Widerrufsformular": "h2",
  }),
  versand: exact({
    "Zahlung und Versand": "lead",
    "Versandkosten (inklusive gesetzliche Mehrwertsteuer)": "h2",
    Lieferfristen: "h2",
    "Akzeptierte Zahlungsmöglichkeiten": "h2",
    "Weitere Einzelheiten zur Zahlung": "h2",
  }),
};

/**
 * Impressum: Der Shopify-Text ist eine Zeilenliste ohne Gliederung. Figma (26:5380) gliedert
 * ihn in Abschnitte; die Abschnittsüberschriften sind Navigationshilfen und werden vor der
 * jeweils ersten Zeile eingefügt. Der Wortlaut der Zeilen bleibt unverändert.
 */
const IMPRESSUM_SECTIONS: { startsWith: string; heading: string }[] = [
  { startsWith: "Gesetzliche Anbieterkennung", heading: "Anbieter" },
  { startsWith: "Telefon:", heading: "Kontakt" },
  { startsWith: "USt-IdNr.", heading: "Register und Umsatzsteuer" },
  { startsWith: "zuständige Aufsichtsbehörde", heading: "Aufsichtsbehörde" },
  { startsWith: "Wir sind nicht bereit", heading: "Verbraucherstreitbeilegung" },
];

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

/** Vorhandene <h2> mit ids versehen und als Inhaltsverzeichnis sammeln. */
function indexHeadings(html: string, used: Set<string>, toc: TocEntry[]): string {
  return html.replace(
    /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi,
    (_m, attrs: string | undefined, inner: string) => {
      const label = stripTags(inner);
      const existing = attrs?.match(/\sid="([^"]+)"/)?.[1];
      const id =
        existing && !used.has(existing)
          ? (used.add(existing), existing)
          : uniqueId(slugify(label), used);
      toc.push({ id, label });
      const rest = (attrs ?? "").replace(/\sid="[^"]*"/, "");
      return `<h2 id="${id}"${rest}>${inner}</h2>`;
    },
  );
}

/** H1 im Fließtext (zum Beispiel Datenschutzerklärung) zu H2 herabstufen: die Seite hat genau eine H1. */
function demoteH1(html: string): string {
  return html.replace(/<h1(\s[^>]*)?>/gi, "<h2$1>").replace(/<\/h1>/gi, "</h2>");
}

export function structureLegalHtml(kind: LegalKind, html: string, title: string): StructuredHtml {
  let body = stripLeadingTitle(html, title);
  body = demoteH1(body);
  body = mergeAdjacentLists(body);

  if (!/<h2[\s>]/i.test(body)) {
    if (kind === "impressum") {
      const done = new Set<string>();
      body = body.replace(/<p>([\s\S]*?)<\/p>/g, (m, inner: string) => {
        const text = stripTags(inner);
        const section = IMPRESSUM_SECTIONS.find(
          (s) => !done.has(s.heading) && text.startsWith(s.startsWith),
        );
        if (!section) return m;
        done.add(section.heading);
        return `<h2>${escapeHtml(section.heading)}</h2>${m}`;
      });
    } else {
      const rule = LEGAL_RULES[kind];
      if (rule) {
        body = body.replace(/<p>([\s\S]*?)<\/p>/g, (m, inner: string) => {
          const level = rule(stripTags(inner));
          if (level === "h2") return `<h2>${inner}</h2>`;
          if (level === "h3") return `<h3>${inner}</h3>`;
          if (level === "lead") return `<p class="pv-legal-lead">${inner}</p>`;
          return m;
        });
      }
    }
  }

  body = linkifyEmails(body);
  const toc: TocEntry[] = [];
  body = indexHeadings(body, new Set<string>(), toc);
  return { html: body, toc };
}

/** Absätze, Überschriften und Listenpunkte einer Seite in Reihenfolge (für Seiten mit festem Layout). */
export interface HtmlNode {
  tag: string;
  html: string;
  text: string;
}

export function htmlNodes(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  const re = /<(h[1-6]|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    nodes.push({ tag: m[1].toLowerCase(), html: m[2].trim(), text: stripTags(m[2]) });
  }
  return nodes;
}

/** Ersten Buchstaben großschreiben ("attraktive Konditionen" → "Attraktive Konditionen"). */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("de-DE") + s.slice(1) : s;
}
