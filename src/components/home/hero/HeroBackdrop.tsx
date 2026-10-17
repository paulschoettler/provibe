import type { CSSProperties } from "react";
import type { HomeFlavor } from "@/lib/catalog/home";
import { heroWords } from "./words";

/**
 * Hintergrund des Heros (Richtung A), liegt in .pv-hero__bg unter der 3D-Canvas:
 * Sortenverlauf, organische Blobs, cremefarbenes Wellenband und die hintere
 * Zeile der Riesentypo (sie steht hinter der Dose). Alles aria-hidden, die
 * Farben kommen aus den --flavor-* Variablen und überblenden beim Sortenwechsel.
 */

/** Selbst gezeichnete Blob-Formen im Feld 200 × 200. */
const BLOBS = [
  "M183 98C187 140 151 176 109 186C67 196 21 172 9 130C-3 88 23 38 63 18C103 -2 145 10 165 40C177 58 181 78 183 98Z",
  "M176 112C170 154 132 190 92 186C52 182 14 148 8 106C2 64 32 22 76 12C120 2 168 26 178 64C182 80 178 96 176 112Z",
  "M180 86C190 124 168 168 128 182C88 196 38 184 18 150C-2 116 8 66 42 38C76 10 128 4 156 30C170 44 176 66 180 86Z",
  "M170 120C162 160 120 192 80 184C40 176 10 136 12 94C14 52 50 14 94 12C138 10 176 44 178 84C178 96 172 108 170 120Z",
];

/** Anzahl der Zeichen als CSS-Variable: daraus rechnet globals.css die Schriftgröße. */
export function charsStyle(word: string): CSSProperties {
  return { "--chars": Math.max(3, word.length) } as CSSProperties;
}

export default function HeroBackdrop({ flavors }: { flavors: HomeFlavor[] }) {
  return (
    <div className="pv-hero__bg-fill">
      <div className="pv-hero__grad" />
      <div className="pv-hero__grad pv-hero__grad--facts" />

      <div className="pv-blobs">
        {BLOBS.map((path, index) => (
          <svg
            key={path}
            className={`pv-blob pv-blob--${index + 1}`}
            viewBox="0 0 200 200"
            aria-hidden="true"
            focusable="false"
          >
            <path d={path} />
          </svg>
        ))}
      </div>

      {/* Hintere Zeile der Riesentypo: unter der Canvas, also hinter der Dose. */}
      <div className="pv-bigname pv-bigname--back">
        {flavors.map((flavor, index) => {
          const words = heroWords(flavor.slug, flavor.shortName);
          return (
            <p
              key={flavor.slug}
              className="pv-bigname__line"
              data-pv-flavor={index}
              data-active={index === 0 ? "true" : "false"}
              style={charsStyle(words.back)}
            >
              {words.back}
            </p>
          );
        })}
      </div>

      {/* Wellenband: Creme-Fläche am unteren Rand, darüber stehen Noten, Punkte und "Scrollen". */}
      <div className="pv-band">
        <svg
          className="pv-band__wave"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M0 30C240 2 480 2 720 24C960 46 1200 50 1440 16V60H0Z" />
        </svg>
        <div className="pv-band__fill" />
      </div>
    </div>
  );
}
