/**
 * Kurzfassung der Produktbeschreibung für die Zutatenkarte im Hero: der erste echte Absatz der
 * Beschreibung, davon ein bis zwei Sätze, höchstens `max` Zeichen. Überschriften ohne Satzende
 * und der Pfandhinweis fallen weg. Die Quelle bleibt die Beschreibung aus dem Backoffice, es gibt
 * kein zweites Textfeld zu pflegen.
 */
const DEFAULT_MAX = 260;

const ENTITIES: Record<string, string> = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  euro: "€",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITIES[code] ?? match;
  });
}

/** HTML in Textabsätze zerlegen (Block-Elemente und Zeilenumbrüche trennen). */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((block) => decodeEntities(block).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitSentences(paragraph: string): string[] {
  return (paragraph.match(/[^.!?…]+[.!?…]+["“”»)]?/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export function shortDescription(
  html: string | null | undefined,
  max: number = DEFAULT_MAX,
): string | null {
  if (!html) return null;
  let sentences: string[] = [];
  for (const paragraph of htmlToParagraphs(html)) {
    if (/\bpfand\b/i.test(paragraph)) continue;
    // Überschriften und Zwischenzeilen haben kein Satzende
    if (!/[.!?…]["“”»)]?$/.test(paragraph)) continue;
    sentences = splitSentences(paragraph);
    if (sentences.length > 0) break;
  }
  if (sentences.length === 0) return null;

  let text = sentences[0] ?? "";
  for (const sentence of sentences.slice(1, 2)) {
    if (text.length + 1 + sentence.length > max) break;
    text = `${text} ${sentence}`;
  }
  if (text.length > max) {
    const cut = text.slice(0, max - 1);
    text = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[,;:\s]+$/, "")}…`;
  }
  return text;
}
