/**
 * Scroll-Choreografie der Finale-Sektion (#pvlogo) als reine Funktion.
 *
 * Quelle: Figma-Frame "Finale / Choreografie" (Datei wttVzqEheGArNkqUliXd3x, node 99:665).
 * Alle Werte hängen linear am Scroll-Fortschritt 0 bis 1 der Pin-Strecke, nur der
 * Sticker "15 g Protein" federt mit back.out(2). Ab 0,95 steht alles still (Haltezone).
 *
 * Einheiten wie im Entwurf: Dosen-Versatz in vw und vh, Textversatz in px, Winkel in
 * Grad (positiv dreht im Uhrzeigersinn wie CSS rotate). Fortschritt 1 entspricht genau
 * dem Endzustand aus dem CSS, den auch Besucher ohne JavaScript sehen.
 */

export type FinaleCanKey = "wildberry" | "peach" | "raspberry-lime";

export interface CanPose {
  /** Versatz zur Endposition in vw */
  x: number;
  /** Versatz zur Endposition in vh */
  y: number;
  /** Absoluter Winkel in Grad */
  rotate: number;
  opacity: number;
}

export interface FinaleFrame {
  logo: { scale: number };
  blob: { scale: number; opacity: number; rotate: number };
  cans: Record<FinaleCanKey, CanPose>;
  copy: { opacity: number; y: number };
  sticker: { scale: number; rotate: number };
  fruit: { opacity: number };
}

/** Zeitfenster aus der Zeitleiste des Entwurfs. */
export const FINALE_WINDOWS = {
  logo: [0, 0.7],
  blob: [0, 0.5],
  wildberry: [0.1, 0.75],
  peach: [0.15, 0.8],
  raspberry: [0.25, 0.8],
  /** Raspberry Lime ist laut Zustand 2 bei 0,5 schon voll sichtbar. */
  raspberryFade: [0.25, 0.45],
  copy: [0.6, 0.9],
  sticker: [0.78, 0.9],
  fruit: [0.82, 0.95],
} as const satisfies Record<string, readonly [number, number]>;

/** Start- und Endpose je Dose (Zustand 1 und 3 des Entwurfs). */
export const CAN_START: Record<FinaleCanKey, CanPose> = {
  wildberry: { x: -70, y: 30, rotate: -32, opacity: 1 },
  peach: { x: 70, y: 30, rotate: 32, opacity: 1 },
  "raspberry-lime": { x: 0, y: 60, rotate: 0, opacity: 0 },
};

export const CAN_END: Record<FinaleCanKey, CanPose> = {
  wildberry: { x: 0, y: 0, rotate: -9, opacity: 1 },
  peach: { x: 0, y: 0, rotate: 9, opacity: 1 },
  "raspberry-lime": { x: 0, y: 0, rotate: 0, opacity: 1 },
};

const LOGO_FROM = 0.5;
const BLOB_FROM = { scale: 0.6, opacity: 0.4, rotate: 20 };
const BLOB_TO = { scale: 1, opacity: 1, rotate: 6 };
const COPY_OFFSET_PX = 24;
const STICKER_ROTATE = 12;
const STICKER_OVERSHOOT = 2;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Linearer Anteil von value im Fenster [from, to], auf 0 bis 1 begrenzt. */
export function windowed(value: number, [from, to]: readonly [number, number]): number {
  return clamp01((value - from) / (to - from));
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Wie GSAP back.out(overshoot): schießt kurz über 1 hinaus und federt zurück. */
export function backOut(t: number, overshoot = STICKER_OVERSHOOT): number {
  const u = clamp01(t) - 1;
  return 1 + (overshoot + 1) * u * u * u + overshoot * u * u;
}

function canPose(key: FinaleCanKey, t: number, opacityT = 1): CanPose {
  const a = CAN_START[key];
  const b = CAN_END[key];
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    rotate: mix(a.rotate, b.rotate, t),
    opacity: mix(a.opacity, b.opacity, opacityT),
  };
}

/** Zustand aller bewegten Elemente beim Fortschritt progress (0 bis 1). */
export function finaleFrame(progress: number): FinaleFrame {
  const p = clamp01(progress);
  const w = FINALE_WINDOWS;

  const logo = windowed(p, w.logo);
  const blob = windowed(p, w.blob);
  const copy = windowed(p, w.copy);

  return {
    logo: { scale: mix(LOGO_FROM, 1, logo) },
    blob: {
      scale: mix(BLOB_FROM.scale, BLOB_TO.scale, blob),
      opacity: mix(BLOB_FROM.opacity, BLOB_TO.opacity, blob),
      rotate: mix(BLOB_FROM.rotate, BLOB_TO.rotate, blob),
    },
    cans: {
      wildberry: canPose("wildberry", windowed(p, w.wildberry)),
      peach: canPose("peach", windowed(p, w.peach)),
      "raspberry-lime": canPose(
        "raspberry-lime",
        windowed(p, w.raspberry),
        windowed(p, w.raspberryFade),
      ),
    },
    copy: { opacity: copy, y: mix(COPY_OFFSET_PX, 0, copy) },
    sticker: { scale: backOut(windowed(p, w.sticker)), rotate: STICKER_ROTATE },
    fruit: { opacity: windowed(p, w.fruit) },
  };
}

/** CSS-Transform einer Dose relativ zu ihrer Endposition. */
export function canTransform(pose: CanPose): string {
  return `translate3d(${round(pose.x)}vw, ${round(pose.y)}vh, 0) rotate(${round(pose.rotate)}deg)`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
