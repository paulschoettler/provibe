/**
 * HTML aus dem Backoffice-Editor (Seiten, Rechtstexte, Blog) vor dem Speichern bereinigen.
 * Whitelist von Tags und Attributen, keine Skripte, keine Event-Handler, nur sichere Links.
 * Auch Staff-Eingaben werden bereinigt (Schutz bei gekaperten Konten, XSS auf der Storefront).
 * Rein, getestet in sanitize.test.ts.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "blockquote",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
  "img",
  "figure",
  "figcaption",
  "sup",
  "sub",
  "small",
  "address",
  "dl",
  "dt",
  "dd",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "*": new Set(["id", "title"]),
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  ol: new Set(["start", "type"]),
};

const DROP_WITH_CONTENT =
  /<(script|style|iframe|object|embed|noscript|template|svg|math|form|select|textarea|button)\b[\s\S]*?(<\/\1\s*>|$)/gi;

function safeHref(value: string): string | null {
  const v = value.trim();
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (v.startsWith("#")) return v;
  return null;
}

function safeSrc(value: string): string | null {
  const v = value.trim();
  if (/^https:\/\//i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return null;
}

function escapeAttr(v: string): string {
  return v
    .replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

function cleanAttributes(tag: string, raw: string): string {
  const allowed = new Set([...(ALLOWED_ATTRS["*"] ?? []), ...(ALLOWED_ATTRS[tag] ?? [])]);
  const out: string[] = [];
  let targetBlank = false;
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw))) {
    const name = m[1].toLowerCase();
    if (!allowed.has(name)) continue;
    let value = (m[2] ?? "").replace(/^["']|["']$/g, "");
    if (name === "href") {
      const safe = safeHref(value);
      if (!safe) continue;
      value = safe;
    } else if (name === "src") {
      const safe = safeSrc(value);
      if (!safe) continue;
      value = safe;
    } else if (name === "target") {
      if (value !== "_blank") continue;
      targetBlank = true;
    } else if (name === "rel") {
      continue; // wird bei target=_blank selbst gesetzt
    } else if (["width", "height", "colspan", "rowspan", "start"].includes(name)) {
      if (!/^\d{1,4}$/.test(value)) continue;
    }
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a" && targetBlank) out.push('rel="noopener noreferrer"');
  return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeRichHtml(html: string): string {
  let s = html.replace(/<!--[\s\S]*?(-->|$)/g, "").replace(DROP_WITH_CONTENT, "");
  // h1 gehört der Seite selbst (genau eine H1), im Inhalt wird daraus h2
  s = s.replace(/<(\/?)h1\b/gi, "<$1h2");
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    return `<${tag}${cleanAttributes(tag, attrs)}>`;
  });
  // Übrig gebliebene spitze Klammern ohne Tag maskieren
  return s.replace(/<(?![a-zA-Z/])/g, "&lt;").trim();
}

/** Klartext-Länge zur Plausibilitätsprüfung (leerer Rechtstext soll nicht veröffentlicht werden). */
export function textLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}
