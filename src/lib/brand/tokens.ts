import tokens from "../../../brand/provibe-ci/tokens.json";

/**
 * CI-Tokens für Stellen, an denen keine CSS-Variable greift (E-Mail-Vorlagen, PDF-Lieferschein,
 * themeColor, Open-Graph-Bilder). Einzige Quelle ist brand/provibe-ci/tokens.json; im Code
 * stehen deshalb keine Hex-Werte (CLAUDE.md, Abschnitt "Design: CI-Guide ist verpflichtend").
 */
export type BrandColorName = keyof typeof tokens.color;

export const BRAND_COLORS = Object.fromEntries(
  Object.entries(tokens.color).map(([name, value]) => [name, value.hex]),
) as Record<BrandColorName, string>;

export const BRAND_FONTS = {
  sans: `"${tokens.font.sans.css_family}", sans-serif`,
  serifItalic: `"${tokens.font.serif_italic.css_family}", serif`,
  serifItalicSub: `"${tokens.font.serif_italic_sub.css_family}", serif`,
  condensed: `"${tokens.font.condensed.css_family}", sans-serif`,
} as const;

/** Schriftstapel für E-Mails: das Adobe-Kit lädt dort nicht, die Fallbacks tragen die Darstellung. */
export const EMAIL_FONT_STACK = `"filson-pro", "Helvetica Neue", Arial, sans-serif`;

export const BRAND_RADIUS = tokens.radius;
export const BRAND_KIT_URL = `https://use.typekit.net/${tokens.web_fonts.kit_id}.css`;
