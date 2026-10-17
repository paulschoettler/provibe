/**
 * Riesentypo im Hero (Richtung A): Sortenname in zwei Zeilen, die erste hinter
 * der Dose, die zweite davor. Rein dekorativ, der echte Sortenname steht
 * zusätzlich als Text im HTML.
 */

export interface HeroWords {
  /** Zeile hinter der Dose, in der Akzentfarbe der Sorte. */
  back: string;
  /** Zeile vor der Dose, Creme mit Versatzschatten in Wine. */
  front: string;
  /**
   * Vordere Zeile zusätzlich mit Wine-Kontur. Nötig, wo der Verlauf hinter der
   * Zeile so hell ist, dass Creme sonst verschwindet (Peach, Raspberry Lime).
   */
  outline: boolean;
}

const WORDS: Record<string, HeroWords> = {
  wildberry: { back: "WILD", front: "BERRY", outline: false },
  "raspberry-lime": { back: "RASPBERRY", front: "LIME", outline: true },
  peach: { back: "JUICY", front: "PEACH", outline: true },
};

/** Wortpaar je Sorte. Unbekannte Sorten teilen den Kurznamen am Leerzeichen. */
export function heroWords(slug: string, shortName: string): HeroWords {
  const known = WORDS[slug];
  if (known) return known;
  const parts = shortName.toUpperCase().trim().split(/\s+/);
  if (parts.length >= 2) {
    return { back: parts[0] ?? "", front: parts.slice(1).join(" "), outline: true };
  }
  return { back: "PROVIBE", front: parts[0] ?? "", outline: true };
}
