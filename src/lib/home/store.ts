"use client";

import { create } from "zustand";

/**
 * Gemeinsamer Zustand der Startseite. Einzige Kopplung zwischen 3D-Szene, Hero,
 * Scroll-Sequenz, Warenkorb-Button und Logo-Zoom. Kein Server-Code hier.
 *
 * Fortschrittswerte laufen von 0 bis 1 und werden von ScrollTrigger-Instanzen gesetzt.
 */
export type RenderTier = "3d" | "static";

export interface HomeState {
  /** Index der aktiven Sorte in HomeData.flavors (0 = Wildberry) */
  flavorIndex: number;
  flavorCount: number;
  /** Richtung des letzten Wechsels (für die Karussell-Drehung): 1 = weiter, -1 = zurück */
  direction: 1 | -1;
  setFlavor: (index: number) => void;
  next: () => void;
  prev: () => void;

  /** Fortschritt der Scroll-Sequenz (Zoom, Rotation, Zutaten), gesetzt von HeroExperience */
  seqProgress: number;
  setSeqProgress: (p: number) => void;

  /** Fortschritt der Logo-Zoom-Sektion (Dosen fliegen ein), gesetzt von LogoZoom */
  footerProgress: number;
  setFooterProgress: (p: number) => void;

  /** 3D aktiv oder PNG-Fallback, gesetzt nach der Fähigkeitsprüfung im Client */
  tier: RenderTier;
  setTier: (tier: RenderTier) => void;

  /** Modell der Sorte ist geladen und sichtbar (Überblendung PNG zu 3D) */
  modelReady: boolean[];
  setModelReady: (index: number, ready: boolean) => void;
}

function wrap(i: number, count: number) {
  return ((i % count) + count) % count;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  flavorIndex: 0,
  flavorCount: 3,
  direction: 1,
  setFlavor: (index) => {
    const { flavorCount, flavorIndex } = get();
    const target = wrap(index, flavorCount);
    if (target === flavorIndex) return;
    set({ flavorIndex: target, direction: target > flavorIndex ? 1 : -1 });
  },
  next: () => {
    const { flavorCount, flavorIndex } = get();
    set({ flavorIndex: wrap(flavorIndex + 1, flavorCount), direction: 1 });
  },
  prev: () => {
    const { flavorCount, flavorIndex } = get();
    set({ flavorIndex: wrap(flavorIndex - 1, flavorCount), direction: -1 });
  },

  seqProgress: 0,
  setSeqProgress: (p) => set({ seqProgress: Math.min(1, Math.max(0, p)) }),

  footerProgress: 0,
  setFooterProgress: (p) => set({ footerProgress: Math.min(1, Math.max(0, p)) }),

  tier: "static",
  setTier: (tier) => {
    set({ tier });
    if (typeof document !== "undefined") document.documentElement.dataset.tier = tier;
  },

  modelReady: [false, false, false],
  setModelReady: (index, ready) =>
    set((s) => {
      const modelReady = [...s.modelReady];
      modelReady[index] = ready;
      return { modelReady };
    }),
}));
