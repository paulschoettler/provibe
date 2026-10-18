/**
 * Vertrag zwischen Bühne und 3D-Szene für das Ziehen mit Finger oder Maus
 * (Arbeitspaket A, Feedback 4).
 *
 * `HeroExperience` hört die Zeigerereignisse auf der Bühne ab und meldet den
 * Fortschritt als Ereignis auf `window`. `CanScene` dreht den Ring dann dem
 * Finger hinterher und rastet beim Loslassen ein. Der Store bleibt außen vor,
 * weil der Zwischenstand während des Ziehens kein Anwendungszustand ist und
 * sonst bei jedem Pixel ein Re-Render auslösen würde.
 */

/** Fortschritt während des Ziehens. */
export const HERO_DRAG_EVENT = "pv-hero-drag";
/** Loslassen: `settled` sagt, ob gleich ein Sortenwechsel folgt. */
export const HERO_DRAG_END_EVENT = "pv-hero-drag-end";

export interface HeroDragDetail {
  /**
   * Gezogener Weg geteilt durch die Bildbreite. Positiv heißt nach rechts
   * gezogen, also zur vorherigen Sorte.
   */
  progress: number;
  /** Beim Loslassen: Es folgt ein Sortenwechsel, der Ring dreht ohnehin weiter. */
  settled: boolean;
}

/**
 * Ziehen im Zutaten-Schritt (Panel sichtbar, seq ab 0,4): Statt den Ring zu drehen, dreht der
 * Finger oder die Maus die vordere Dose selbst, waagerecht um ihre Achse, senkrecht als Kippen.
 * Beim Loslassen federt sie in die Grundstellung zurück (Feedback 18.10.2026).
 */
export const HERO_SPIN_EVENT = "pv-hero-spin";
export const HERO_SPIN_END_EVENT = "pv-hero-spin-end";

export interface HeroSpinDetail {
  /** Waagerechter Weg geteilt durch die Bildbreite, positiv nach rechts. */
  x: number;
  /** Senkrechter Weg geteilt durch die Bildhöhe, positiv nach unten. */
  y: number;
}

/** Eine Bildbreite Ziehen dreht die Dose gut anderthalb Mal. */
export const SPIN_GAIN_X = Math.PI * 3;
/** Eine Bildhöhe Ziehen kippt um rund 100 Grad, begrenzt durch SPIN_MAX_PITCH. */
export const SPIN_GAIN_Y = Math.PI * 0.55;
/** Weiter als so weit kippt die Dose nicht (Bogenmaß, rund 50 Grad). */
export const SPIN_MAX_PITCH = Math.PI * 0.28;

/** Fortschritt in einen Anteil eines Ringschritts umrechnen. */
export const DRAG_GAIN = 1.3;
/** Weiter als so weit folgt der Ring dem Finger nicht. */
export const DRAG_MAX_STEP = 0.8;
