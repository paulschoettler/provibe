import type { HomeFlavor } from "@/lib/catalog/home";
import { charsStyle } from "./HeroBackdrop";
import { fruitsFor } from "./FruitStickers";
import { heroWords } from "./words";

/**
 * Vordere Ebene des Heros (Richtung A), liegt in der Bühne über der 3D-Canvas:
 * vordere Zeile der Riesentypo, runder Protein-Sticker, Vibe-Sticker und drei
 * Frucht-Sticker je Sorte. Rein dekorativ (aria-hidden, keine Zeigerereignisse);
 * Sortenname, Badges und Slogan stehen zusätzlich als echter Text im HTML.
 *
 * Positionen hängen an der aktiven Dose (Mittelpunkt und Höhe aus
 * hero-geometry.ts), die Werte je Sticker stehen in globals.css.
 */
export default function HeroDeco({ flavors }: { flavors: HomeFlavor[] }) {
  return (
    <div className="pv-deco" aria-hidden="true">
      <div className="pv-bigname pv-bigname--front">
        {flavors.map((flavor, index) => {
          const words = heroWords(flavor.slug, flavor.shortName);
          return (
            <p
              key={flavor.slug}
              className="pv-bigname__line"
              data-pv-flavor={index}
              data-active={index === 0 ? "true" : "false"}
              data-outline={words.outline ? "true" : "false"}
              style={charsStyle(words.front)}
            >
              {words.front}
            </p>
          );
        })}
      </div>

      {flavors.map((flavor, index) => {
        const fruits = fruitsFor(flavor.slug);
        return (
          <div
            key={flavor.slug}
            className="pv-fruits"
            data-pv-flavor={index}
            data-active={index === 0 ? "true" : "false"}
          >
            {fruits.map((Fruit, slot) => (
              <span key={slot} className={`pv-sticker pv-sticker--f${slot + 1}`}>
                <span className="pv-sticker__float">
                  <Fruit />
                </span>
              </span>
            ))}
          </div>
        );
      })}

      <span className="pv-sticker pv-sticker--protein">
        <span className="pv-sticker__float pv-protein">
          <span className="pv-protein__value">15 g</span>
          <span className="pv-protein__label">Protein</span>
        </span>
      </span>
      <span className="pv-sticker pv-sticker--vibe">
        <span className="pv-vibe">Such dir deinen Vibe.</span>
      </span>
    </div>
  );
}
