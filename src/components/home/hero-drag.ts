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

/** Fortschritt in einen Anteil eines Ringschritts umrechnen. */
export const DRAG_GAIN = 1.3;
/** Weiter als so weit folgt der Ring dem Finger nicht. */
export const DRAG_MAX_STEP = 0.8;
