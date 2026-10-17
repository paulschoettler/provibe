import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Liest die CI-SVGs aus brand/provibe-ci/icons (einzige Quelle, CLAUDE.md) zur Build- bzw.
 * Renderzeit. Jede Datei steht als eigener Literal-Pfad da, damit die Dateiverfolgung von
 * Next.js genau diese Dateien in die Server-Bundles übernimmt (ISR auf Netlify).
 *
 * Verändert wird nur die Hülle: <metadata> (C2PA-Manifest) und das Füllattribut am <svg>
 * fallen weg, viewBox und alle Pfade bleiben unverändert.
 */

const SOURCES = {
  erdbeere: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/fruits/erdbeere.svg"), "utf8"),
  himbeere: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/fruits/himbeere.svg"), "utf8"),
  heidelbeere: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/fruits/heidelbeere.svg"), "utf8"),
  "limette-scheibe": () =>
    readFileSync(
      path.join(process.cwd(), "brand/provibe-ci/icons/fruits/limette-scheibe.svg"),
      "utf8",
    ),
  "pfirsich-blatt-gross": () =>
    readFileSync(
      path.join(process.cwd(), "brand/provibe-ci/icons/fruits/pfirsich-blatt-gross.svg"),
      "utf8",
    ),
  "pfirsich-blatt-klein": () =>
    readFileSync(
      path.join(process.cwd(), "brand/provibe-ci/icons/fruits/pfirsich-blatt-klein.svg"),
      "utf8",
    ),
  "pfirsich-rund": () =>
    readFileSync(
      path.join(process.cwd(), "brand/provibe-ci/icons/fruits/pfirsich-rund.svg"),
      "utf8",
    ),
  "pfirsich-gruppe": () =>
    readFileSync(
      path.join(process.cwd(), "brand/provibe-ci/icons/fruits/pfirsich-gruppe.svg"),
      "utf8",
    ),
  check: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/ui/check.svg"), "utf8"),
  instagram: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/ui/instagram.svg"), "utf8"),
  tiktok: () =>
    readFileSync(path.join(process.cwd(), "brand/provibe-ci/icons/ui/tiktok.svg"), "utf8"),
} as const;

export type BrandSvgName = keyof typeof SOURCES;

export interface BrandSvg {
  viewBox: string;
  /** Inhalt des <svg> ohne <metadata>, Pfade unverändert. */
  inner: string;
}

const cache = new Map<BrandSvgName, BrandSvg>();

/** Zerlegt eine CI-SVG-Datei in viewBox und Inhalt. Exportiert für den Test. */
export function parseBrandSvg(source: string): BrandSvg {
  const open = source.match(/<svg\b[^>]*>/);
  const viewBox = open?.[0].match(/\bviewBox="([^"]+)"/)?.[1];
  const close = source.lastIndexOf("</svg>");
  if (!open || open.index === undefined || !viewBox || close < 0) {
    throw new Error("CI-SVG ohne <svg viewBox> gefunden");
  }
  const inner = source
    .slice(open.index + open[0].length, close)
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .trim();
  return { viewBox, inner };
}

export function brandSvg(name: BrandSvgName): BrandSvg {
  let svg = cache.get(name);
  if (!svg) {
    svg = parseBrandSvg(SOURCES[name]());
    cache.set(name, svg);
  }
  return svg;
}
