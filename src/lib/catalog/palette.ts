import { BRAND_COLORS } from "@/lib/brand/tokens";

/**
 * Sortenfarben laut CI-Guide (brand/provibe-ci/CI-GUIDE.md, "Sorten-Logik").
 * Zwei Stufen je Sorte: Cream zur Sortenfarbe, keine Zwischentöne. `ink` ist die Textfarbe
 * im Sortenkontext (Wildberry, bei Peach Burgundy; Lime-Raspberry nie als Text auf Cream).
 *
 * Die Werte kommen als Hex aus brand/provibe-ci/tokens.json (über BRAND_COLORS), nicht als
 * var(): GSAP tweent die --flavor-* Variablen im Hero und kann nur echte Farbwerte
 * überblenden. Im Code steht dadurch trotzdem kein Hex-Wert.
 *
 * Die Paletten in products.attributes.palette (Datenbank) sind Altbestand aus dem
 * Shopify-Design und werden für die Darstellung nicht mehr gelesen.
 */
export interface FlavorPalette {
  from: string;
  via: string;
  to: string;
  accent: string;
  ink: string;
}

const C = BRAND_COLORS;

export const FLAVOR_PALETTES: Record<string, FlavorPalette> = {
  wildberry: {
    from: C.cream,
    via: C.cream,
    to: C.wildberry,
    accent: C.wildberry,
    ink: C.wildberry,
  },
  "raspberry-lime": {
    from: C.cream,
    via: C.cream,
    to: C.lime_raspberry,
    accent: C.lime_raspberry,
    ink: C.wildberry,
  },
  peach: { from: C.cream, via: C.cream, to: C.peach, accent: C.peach, ink: C.burgundy },
};

/** Palette je Produkt-Handle; alles ohne eigene Sorte (Bundles, Merch) läuft in Wildberry. */
export function flavorPalette(handle: string): FlavorPalette {
  return FLAVOR_PALETTES[handle] ?? FLAVOR_PALETTES.wildberry;
}
