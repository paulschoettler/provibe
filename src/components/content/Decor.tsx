import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { WaveDivider, type WaveShape } from "@/components/layout/WaveDivider";

/**
 * Dekorative Bausteine der Inhaltsseiten (Figma Richtung A): Eyebrow, Protein-Sticker,
 * Blobs und Icons. Alles rein dekorativ (aria-hidden), Assets aus public/images/inhalte
 * (aus Figma geladen). Frucht-Sticker kommen aus dem CI: src/components/brand/FruitSticker.tsx.
 */

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`pv-eyebrow ${className}`}>{children}</p>;
}

/** Runder Magenta-Sticker "15 g Protein" (A/Sticker Protein). */
export function ProteinSticker({
  className = "",
  rotate = 8,
  style,
}: {
  className?: string;
  rotate?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`pv-sticker-protein ${className}`}
      style={{ ["--pv-rot" as string]: `${rotate}deg`, ...style }}
      aria-hidden="true"
    >
      <b>15 g</b>
      <span>Protein</span>
    </span>
  );
}

const BLOBS = {
  "hero-1": { w: 280, h: 260 },
  "hero-2": { w: 240, h: 240 },
  "bild-a": { w: 322, h: 261 },
  "bild-b": { w: 322, h: 261 },
  zitat: { w: 160, h: 150 },
  dosen: { w: 320, h: 270 },
  "partner-1": { w: 260, h: 240 },
  "partner-2": { w: 200, h: 200 },
  "partner-3": { w: 220, h: 220 },
} as const;

export type BlobName = keyof typeof BLOBS;

/** Organische Fläche hinter Bildern und in Heros (Figma "Blob"). Position per className/style. */
export function Blob({
  name,
  className = "",
  style,
  parallax,
}: {
  name: BlobName;
  className?: string;
  style?: CSSProperties;
  /** Versatz in px für den Scroll-Parallax (src/components/motion), ohne Angabe kein Effekt */
  parallax?: number;
}) {
  const b = BLOBS[name];
  return (
    <Image
      src={`/images/inhalte/blob-${name}.svg`}
      alt=""
      aria-hidden="true"
      width={b.w}
      height={b.h}
      unoptimized
      className={`pv-blob ${className}`}
      style={style}
      data-pv-parallax={parallax}
    />
  );
}

/** Kleines Icon aus public/images/inhalte (Figma-Export), dekorativ. */
export function InhaltIcon({
  name,
  size = 20,
  className = "",
}: {
  name: "mail" | "heart" | "arrow" | "clock" | "percent" | "boxes" | "bolt" | "check-white";
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/images/inhalte/icon-${name}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      className={className}
    />
  );
}

/**
 * Welle, die von unten in die vorherige Sektion schneidet (zum Beispiel Creme in einen Hero
 * mit overflow hidden). Höhe 0, die Welle ragt per WaveDivider nach oben.
 */
export function WaveCut({
  fill = "var(--pv-cream)",
  shape = "soft",
  flip,
}: {
  fill?: string;
  shape?: WaveShape;
  flip?: boolean;
}) {
  return (
    <div className="pv-wave-cut" aria-hidden="true">
      <WaveDivider shape={shape} fill={fill} position="top" flip={flip} />
    </div>
  );
}
