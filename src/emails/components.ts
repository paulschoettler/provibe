/**
 * Bausteine für E-Mails in Brand-Optik (React-Email-Ersatz ohne neue Abhängigkeit).
 * Jede Funktion liefert einen HTML-String mit Inline-CSS und Tabellenlayout, damit Gmail, Outlook
 * und Apple Mail gleich darstellen. Texte von außen werden immer escaped; nur ausdrücklich als
 * HTML gekennzeichnete Inhalte (bodyHtml, html) gehen unverändert durch.
 * Reine Funktionen, keine Datenbank, getestet in templates.test.ts.
 */

import { BRAND_COLORS, BRAND_RADIUS, EMAIL_FONT_STACK } from "@/lib/brand/tokens";

/**
 * Farbrollen aller Mails nach CI-Guide. Mailclients kennen keine CSS-Variablen, deshalb kommen die
 * Werte aus brand/provibe-ci/tokens.json (über src/lib/brand/tokens.ts), nie als Hex im Code.
 * Die übrigen Mailvorlagen (Checkout, Abo, Konto, Formulare, Backoffice) nutzen dieselben Rollen.
 */
export const EMAIL_COLORS = {
  /** Seitenhintergrund */
  background: BRAND_COLORS.cream,
  /** Kästen auf dem Hintergrund (Zusammenfassung, Produktkarte); Weiß, damit sie sich vom Cream abheben */
  surface: BRAND_COLORS.white,
  /** Fließtext, Überschriften, gedämpfter Text und Links */
  text: BRAND_COLORS.wildberry,
  /** Button */
  accent: BRAND_COLORS.wildberry,
  onAccent: BRAND_COLORS.white,
  /** Testhinweis-Fläche (Wildberry-Text darauf, Kontrast 7,48) */
  highlight: BRAND_COLORS.lime_raspberry,
  /** Trennlinien auf dem Cream-Hintergrund */
  line: BRAND_COLORS.wildberry,
  /** Trennlinien in weißen Kästen */
  lineSoft: BRAND_COLORS.cream,
} as const;

/**
 * Filson lädt im Mailclient nicht (Adobe-Kit), die Fallbacks Helvetica und Arial tragen die Darstellung.
 * Doppelte Anführungszeichen werden zu einfachen, weil der Stapel in style="…" steht.
 */
export const EMAIL_FONT = EMAIL_FONT_STACK.replace(/"/g, "'");

/** Radien aus dem CI-Guide: Kasten 24 px, Testhinweis wie Button-Leiste 12 px. Buttons bleiben Pill wie im Shop. */
export const EMAIL_RADIUS = {
  box: `${BRAND_RADIUS.box}px`,
  banner: `${BRAND_RADIUS.button}px`,
  pill: "100px",
} as const;

/**
 * Logo im Mailkopf: PNG-Ableitung des CI-SVG (provibe-logo-wildberry.svg, siehe docs/brand-assets.md),
 * angezeigt mit 120 × 47 px (Seitenverhältnis 2,55 : 1). Einzige Stelle für den Pfad.
 */
export const EMAIL_LOGO_PATH = "/brand/logo-derived/provibe-logo-wildberry@2x.png";

/** Logo-Kopf als verlinktes Bild, absolute URL aus siteUrl (Mailclients brauchen absolute Pfade). */
export function emailLogo(siteUrl: string, align: "center" | "left" = "center"): string {
  const base = siteUrl.replace(/\/$/, "");
  return `<p style="margin:0 0 24px;text-align:${align}"><a href="${escapeHtml(base)}" style="text-decoration:none"><img src="${escapeHtml(base + EMAIL_LOGO_PATH)}" width="120" height="47" alt="provibe" style="display:inline-block;width:120px;height:47px;border:0"></a></p>`;
}

const C = EMAIL_COLORS;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Nur http(s)- und mailto-Links sowie relative Pfade (werden mit siteUrl absolut). */
export function safeUrl(url: string, siteUrl: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${siteUrl.replace(/\/$/, "")}${trimmed}`;
  return siteUrl;
}

/** Einfacher Text mit Leerzeilen als Absätze, einzelne Umbrüche als <br> (escaped). */
export function textParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => escapeHtml(para).replace(/\n/g, "<br>"));
}

export interface ImprintEntity {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  managingDirector?: string;
  register?: string;
  vatId?: string;
}

export function heading(text: string, level: 1 | 2 = 1): string {
  const size = level === 1 ? "28px" : "20px";
  return `<h${level} style="margin:0 0 12px;font-family:${EMAIL_FONT};font-size:${size};line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:${C.text}">${escapeHtml(text)}</h${level}>`;
}

export function paragraph(
  html: string,
  options: { muted?: boolean; small?: boolean } = {},
): string {
  // Gedämpfter Text bleibt Wildberry (keine Abstufungen im CI), kleiner gesetzt
  const color = C.text;
  const size = options.small ? "13px" : "16px";
  return `<p style="margin:0 0 16px;font-family:${EMAIL_FONT};font-size:${size};line-height:1.6;color:${color}">${html}</p>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 24px"><tr><td style="border-radius:${EMAIL_RADIUS.pill};background:${C.accent}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT};font-size:15px;font-weight:700;color:${C.onAccent};text-decoration:none;border-radius:${EMAIL_RADIUS.pill}">${escapeHtml(label)}</a></td></tr></table>`;
}

export function image(src: string, alt: string, href?: string): string {
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:${EMAIL_RADIUS.box}">`;
  return `<div style="margin:0 0 20px">${href ? `<a href="${escapeHtml(href)}">${img}</a>` : img}</div>`;
}

export function divider(): string {
  return `<hr style="border:0;border-top:1px solid ${C.line};margin:24px 0">`;
}

export interface ProductCardData {
  title: string;
  line: string | null;
  priceLine: string;
  detailLine: string | null;
  imageUrl: string | null;
  url: string;
}

export function productCard(p: ProductCardData): string {
  const img = p.imageUrl
    ? `<td width="120" style="padding:16px 0 16px 16px;vertical-align:middle"><a href="${escapeHtml(p.url)}"><img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.title)}" width="104" style="display:block;width:104px;height:auto;border:0"></a></td>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${C.surface};border-radius:${EMAIL_RADIUS.box}"><tr>${img}<td style="padding:16px 20px;vertical-align:middle;font-family:${EMAIL_FONT};color:${C.text}">
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${C.text}"><a href="${escapeHtml(p.url)}" style="color:${C.text};text-decoration:none">${escapeHtml(p.title)}</a></p>
${p.line ? `<p style="margin:0 0 8px;font-size:14px">${escapeHtml(p.line)}</p>` : ""}
<p style="margin:0 0 4px;font-size:18px;font-weight:700">${escapeHtml(p.priceLine)}</p>
${p.detailLine ? `<p style="margin:0;font-size:13px;color:${C.text}">${escapeHtml(p.detailLine)}</p>` : ""}
</td></tr></table>`;
}

/** Pflichtangaben im Fuß: Grund des Empfangs, Abmeldelink (bei Werbung), Impressum-Kurzfassung. */
export function footer(options: {
  entity: ImprintEntity | null;
  reason?: string;
  unsubscribeUrl?: string;
  siteUrl: string;
}): string {
  const e = options.entity;
  const imprint = e
    ? [
        `${escapeHtml(e.name)} · ${escapeHtml(e.street)} · ${escapeHtml(e.zip)} ${escapeHtml(e.city)}`,
        [
          e.managingDirector ? `Geschäftsführung: ${escapeHtml(e.managingDirector)}` : "",
          e.register ? escapeHtml(e.register) : "",
          e.vatId ? `USt-IdNr.: ${escapeHtml(e.vatId)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        `Kontakt: <a href="mailto:${escapeHtml(e.email)}" style="color:${C.text}">${escapeHtml(e.email)}</a> · <a href="${escapeHtml(options.siteUrl)}/pages/impressum" style="color:${C.text}">Impressum</a>`,
      ]
        .filter(Boolean)
        .join("<br>")
    : "";
  const reason = options.reason ? `${escapeHtml(options.reason)} ` : "";
  const unsubscribe = options.unsubscribeUrl
    ? `<a href="${escapeHtml(options.unsubscribeUrl)}" style="color:${C.text};font-weight:700">Abmelden</a>`
    : "";
  return `<div style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-family:${EMAIL_FONT};font-size:12px;line-height:1.7;color:${C.text};text-align:center">
${reason || unsubscribe ? `<p style="margin:0 0 8px">${reason}${unsubscribe}</p>` : ""}
<p style="margin:0">${imprint}</p>
</div>`;
}

/** Grundgerüst: Vorschautext, Logo-Kopf, Inhalt, Fuß. */
export function emailLayout(options: {
  title: string;
  preheader?: string | null;
  bodyHtml: string;
  footerHtml: string;
  siteUrl: string;
  testBanner?: string | null;
}): string {
  const pre = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(options.preheader)}</div>`
    : "";
  const banner = options.testBanner
    ? `<p style="margin:0 0 16px;padding:8px 12px;background:${C.highlight};border:1.5px solid ${C.text};border-radius:${EMAIL_RADIUS.banner};font-family:${EMAIL_FONT};font-size:13px;font-weight:700;color:${C.text}">${escapeHtml(options.testBanner)}</p>`
    : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background:${C.background};font-family:${EMAIL_FONT};color:${C.text}">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px"><tr><td style="padding:8px 20px 32px">
${banner}
${emailLogo(options.siteUrl)}
${options.bodyHtml}
${options.footerHtml}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** Textfassung aus HTML (für multipart/alternative). */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|tr|div|li|table)>/gi, "\n")
    .replace(/<hr[^>]*>/gi, "\n----\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
