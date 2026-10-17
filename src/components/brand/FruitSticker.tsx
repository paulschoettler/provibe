import type { CSSProperties } from "react";
import { FruitIcon, type FruitIconName, type FruitTone } from "./BrandIcon";

/**
 * Frucht-Sticker der Inhaltsseiten (früher A/Sticker Brombeere, Erdbeere, Pfirsich aus Figma,
 * jetzt CI-Icons). Lage und Breite über className, Drehung über rotate wie bisher
 * (Klasse pv-sticker-img in globals.css). Liegt bewusst nicht in content/Decor.tsx, weil
 * Decor auch von Client-Komponenten importiert wird und dieses Icon serverseitig liest.
 */
export function FruitSticker({
  kind,
  className = "",
  rotate = 0,
  tone = "lime-raspberry",
  flip,
  style,
  parallax,
}: {
  kind: FruitIconName;
  className?: string;
  rotate?: number;
  tone?: FruitTone;
  flip?: boolean;
  style?: CSSProperties;
  /** Versatz in px für den Scroll-Parallax (src/components/motion), ohne Angabe kein Effekt */
  parallax?: number;
}) {
  return (
    <FruitIcon
      name={kind}
      tone={tone}
      flip={flip}
      className={`pv-sticker-img ${className}`}
      style={{ ["--pv-rot" as string]: `${rotate}deg`, ...style }}
      parallax={parallax}
    />
  );
}
