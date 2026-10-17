import type { CSSProperties } from "react";
import { brandSvg, type BrandSvgName } from "./svg-source";

/** Frucht-Icons aus brand/provibe-ci/icons/fruits (CI-Guide Abschnitt 5). */
export type FruitIconName = Extract<
  BrandSvgName,
  | "erdbeere"
  | "himbeere"
  | "heidelbeere"
  | "limette-scheibe"
  | "pfirsich-blatt-gross"
  | "pfirsich-blatt-klein"
  | "pfirsich-rund"
  | "pfirsich-gruppe"
>;

/** UI-Icons aus brand/provibe-ci/icons/ui, gefärbt über currentColor. */
export type UiIconName = Extract<BrandSvgName, "check" | "instagram" | "tiktok">;

/**
 * Farbe der Frucht-Icons laut CI-Guide 5.1: Lime-Raspberry auf Cream, Cream auf Wildberry.
 * Die Limettenscheibe ist zweifarbig und behält ihre eigenen Farben.
 */
export type FruitTone = "lime-raspberry" | "cream";

const TONE_CLASS: Record<FruitTone, string> = {
  "lime-raspberry": "text-pv-lime-raspberry",
  cream: "text-pv-cream",
};

interface InlineSvgProps {
  name: BrandSvgName;
  className?: string;
  style?: CSSProperties;
}

/** Inline-SVG im Server-HTML; Füllung über currentColor, damit CSS die Farbe setzt. */
function InlineSvg({ name, className, style }: InlineSvgProps) {
  const svg = brandSvg(name);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={svg.viewBox}
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: svg.inner }}
    />
  );
}

/** Dekoratives Frucht-Icon. `flip` spiegelt horizontal (CI-Guide 5.5 erlaubt das). */
export function FruitIcon({
  name,
  tone = "lime-raspberry",
  flip = false,
  className = "",
  style,
}: {
  name: FruitIconName;
  tone?: FruitTone;
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <InlineSvg
      name={name}
      className={`${TONE_CLASS[tone]} ${className}`.trim()}
      style={flip ? { scale: "-1 1", ...style } : style}
    />
  );
}

/** UI-Icon (Häkchen, Instagram, TikTok) in der Textfarbe des Elternelements. */
export function UiIcon({ name, className = "" }: { name: UiIconName; className?: string }) {
  return <InlineSvg name={name} className={`pointer-events-none ${className}`.trim()} />;
}

export function InstagramIcon({ className = "" }: { className?: string }) {
  return <UiIcon name="instagram" className={className} />;
}

export function TiktokIcon({ className = "" }: { className?: string }) {
  return <UiIcon name="tiktok" className={className} />;
}

/** Blatt-Häkchen für USP-Listen (CI-Guide 6, Produkt-Callouts). */
export function CheckIcon({ className = "" }: { className?: string }) {
  return <UiIcon name="check" className={className} />;
}
