/**
 * Serverseitige HTML-Bereinigung für Texte aus dem Backoffice (Produktbeschreibung, Zutaten,
 * Kollektionsbeschreibung). Allowlist statt Blocklist: nur erlaubte Tags bleiben, alle Attribute
 * außer href und title an Links fallen weg (auch class, style, data-*, on*).
 *
 * Kein DOM und keine Abhängigkeit, damit die Funktion in Server Actions, Netlify Functions und
 * Tests gleich arbeitet. Die Ausgabe ist wohlgeformt: offene Tags werden am Ende geschlossen,
 * verwaiste schließende Tags verworfen. Inhalte von script, style, iframe und ähnlichen Tags
 * werden komplett entfernt, bei allen anderen nicht erlaubten Tags bleibt der Text erhalten.
 */

export type SanitizeProfile = "rich" | "inline";

const RICH_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
  "span",
  "sup",
  "sub",
  "hr",
]);

/** Zutatenliste: Hervorhebung der Allergene, Absätze und Umbrüche. */
const INLINE_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "span", "sup", "sub"]);

const VOID_TAGS = new Set(["br", "hr"]);

/** Tags, deren Inhalt mit entfernt wird. */
const DROP_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "svg",
  "math",
  "textarea",
  "select",
  "button",
  "form",
  "title",
  "head",
]);

/** Die Seite hat genau eine H1 (Produkttitel), deshalb wird h1 zu h2. */
const RENAME: Record<string, string> = { h1: "h2" };

const TOKEN =
  /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<[!?][^>]*>|[^<]+|</g;

const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  colon: ":",
  tab: "\t",
  newline: "\n",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

function escapeText(s: string): string {
  return s.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, "&amp;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Erlaubte Linkziele: http(s), mailto, tel und relative Pfade. Alles andere fällt weg. */
export function isSafeHref(raw: string): boolean {
  const v = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  if (!v) return false;
  const scheme = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!scheme) return true;
  return ["http", "https", "mailto", "tel"].includes(scheme[1].toLowerCase());
}

function sanitizeAttributes(tag: string, raw: string): string {
  if (tag !== "a") return "";
  let href: string | null = null;
  let title: string | null = null;
  let blank = false;
  for (const m of raw.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name === "href" && isSafeHref(value)) href = decodeEntities(value).trim();
    else if (name === "title") title = decodeEntities(value);
    else if (name === "target" && value.toLowerCase() === "_blank") blank = true;
  }
  let out = "";
  if (href !== null) out += ` href="${escapeAttr(href)}"`;
  if (title) out += ` title="${escapeAttr(title)}"`;
  if (blank && href !== null) out += ` target="_blank" rel="noopener noreferrer"`;
  return out;
}

export function sanitizeHtml(input: string | null | undefined, profile: SanitizeProfile = "rich") {
  if (!input) return "";
  const allowed = profile === "inline" ? INLINE_TAGS : RICH_TAGS;
  const out: string[] = [];
  const stack: string[] = [];
  let dropping: { tag: string; depth: number } | null = null;

  for (const m of input.matchAll(TOKEN)) {
    const token = m[0];
    const tagName = m[2]?.toLowerCase();

    if (dropping) {
      if (tagName === dropping.tag) {
        const selfClosing = /\/\s*$/.test(m[3] ?? "");
        if (m[1] === "/") dropping.depth--;
        else if (!selfClosing) dropping.depth++;
        if (dropping.depth === 0) dropping = null;
      }
      continue;
    }

    if (token.startsWith("<!--") || /^<[!?]/.test(token)) continue;
    if (token === "<") {
      out.push("&lt;");
      continue;
    }
    if (!tagName) {
      out.push(escapeText(token));
      continue;
    }

    const closing = m[1] === "/";
    const attrs = m[3] ?? "";
    if (DROP_CONTENT.has(tagName)) {
      if (!closing && !/\/\s*$/.test(attrs)) dropping = { tag: tagName, depth: 1 };
      continue;
    }
    const tag = RENAME[tagName] ?? tagName;
    if (!allowed.has(tag)) continue;

    if (VOID_TAGS.has(tag)) {
      if (!closing) out.push(`<${tag}>`);
      continue;
    }
    if (!closing) {
      out.push(`<${tag}${sanitizeAttributes(tag, attrs)}>`);
      stack.push(tag);
      continue;
    }
    const idx = stack.lastIndexOf(tag);
    if (idx === -1) continue;
    while (stack.length > idx) out.push(`</${stack.pop()}>`);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);

  return out
    .join("")
    .replace(/<(p|li|h2|h3|h4|span|strong|b|em|i|u|s)>\s*<\/\1>/g, "")
    .trim();
}

/** Reiner Text ohne Tags, für Längenprüfungen und Vorschauen. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
