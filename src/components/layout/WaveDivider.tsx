/**
 * Wellen-Übergang zwischen zwei Sektionen (Muster royalbev.com).
 *
 * Die Welle ist ein Inline-SVG ohne Client-Code. Sie sitzt an der Ober- oder Unterkante
 * einer farbigen Sektion und ragt in die Nachbarsektion hinein. Die Füllfarbe ist immer
 * die Farbe der eigenen Sektion, damit der Übergang nahtlos wirkt.
 *
 * Die Pfade sind so gezeichnet, dass die Fläche UNTER der Kurve gefüllt ist
 * (Variante "top"). Für "bottom" wird das SVG per CSS gespiegelt.
 */

export type WaveShape = "soft" | "swell" | "double";

export interface WaveDividerProps {
  shape?: WaveShape;
  /** CSS-Farbe oder Token, z.B. "var(--color-butter)" */
  fill: string;
  /** "top": Welle liegt über der Sektion. "bottom": Welle liegt unter der Sektion. */
  position?: "top" | "bottom";
  /** Horizontal spiegeln, damit zwei Wellen untereinander nicht gleich aussehen */
  flip?: boolean;
  className?: string;
}

/** Flache, ruhige Welle (Footer, Stimmungsbild) */
const SOFT = "M0 70 C 240 24, 470 24, 720 58 C 970 92, 1200 92, 1440 50 L1440 120 L0 120 Z";
/** Kräftigere Welle mit zwei Bögen (Sorten, Banner) */
const SWELL = "M0 90 C 200 14, 430 112, 720 70 C 1010 28, 1250 98, 1440 34 L1440 120 L0 120 Z";
/** Hintere Welle der Variante "double" (leicht versetzt, transparent) */
const DOUBLE_BACK =
  "M0 58 C 260 106, 500 18, 760 46 C 1020 74, 1230 42, 1440 78 L1440 120 L0 120 Z";

const PATHS: Record<WaveShape, string> = { soft: SOFT, swell: SWELL, double: SWELL };

export function WaveDivider({
  shape = "soft",
  fill,
  position = "top",
  flip = false,
  className = "",
}: WaveDividerProps) {
  const classes = [
    "pv-wave",
    position === "top" ? "pv-wave--top" : "pv-wave--bottom",
    flip ? "pv-wave--flip" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={classes}
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {shape === "double" ? <path d={DOUBLE_BACK} fill={fill} opacity={0.38} /> : null}
      <path d={PATHS[shape]} fill={fill} />
    </svg>
  );
}

export default WaveDivider;
