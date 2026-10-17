import type { HomeFlavor } from "@/lib/catalog/home";
import { formatEur } from "@/lib/money";

type PriceSource = {
  pack: Pick<
    HomeFlavor["pack"],
    "unitCount" | "priceWithoutDepositCents" | "depositCents" | "basePriceText"
  >;
  depositPerCanCents: HomeFlavor["depositPerCanCents"];
};

export interface FinalePriceLine {
  unitCount: number;
  /** Preis ohne Pfand, Hauptpreis (H22) */
  price: string;
  /** Pfand des Packs, getrennt ausgewiesen */
  deposit: string;
  /** Grundpreis, Text aus src/lib/pricing (formatBasePrice) */
  basePrice: string;
  /** Pfand je Dose für die Pill */
  depositPerCan: string;
}

/**
 * Preiszeile "9er-Pack ab … zzgl. … Pfand (…)" aus den Katalogdaten der Startseite.
 * Alle Beträge sind dort serverseitig über src/lib/pricing berechnet; hier wird nur
 * der günstigste Pack ausgewählt und mit formatEur formatiert.
 */
export function finalePriceLine(flavors: PriceSource[]): FinalePriceLine | null {
  if (flavors.length === 0) return null;
  const cheapest = flavors.reduce((best, f) =>
    f.pack.priceWithoutDepositCents < best.pack.priceWithoutDepositCents ? f : best,
  );
  return {
    unitCount: cheapest.pack.unitCount,
    price: formatEur(cheapest.pack.priceWithoutDepositCents),
    deposit: formatEur(cheapest.pack.depositCents),
    basePrice: cheapest.pack.basePriceText,
    depositPerCan: formatEur(cheapest.depositPerCanCents),
  };
}
