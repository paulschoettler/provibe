import type { Cents } from "@/lib/money";
import type { ShippingRateRule } from "./types";

export interface ShippingSelection {
  rate: ShippingRateRule | null;
  priceCents: Cents;
  free: boolean;
  amountToFreeShippingCents: Cents;
}

/**
 * Passenden Versandtarif wählen. Grundlage für Grenzen ist der rabattierte Warenwert OHNE Pfand.
 * Bei mehreren passenden Tarifen gewinnt der günstigste.
 */
export function selectShippingRate(
  rates: ShippingRateRule[],
  discountedSubtotalCents: Cents,
  totalWeightGrams: number,
  forceFree = false,
): ShippingSelection {
  const candidates = rates.filter(
    (r) =>
      discountedSubtotalCents >= r.minSubtotalCents &&
      (r.maxSubtotalCents == null || discountedSubtotalCents <= r.maxSubtotalCents) &&
      totalWeightGrams >= r.minWeightGrams &&
      (r.maxWeightGrams == null || totalWeightGrams <= r.maxWeightGrams),
  );
  if (candidates.length === 0) {
    return { rate: null, priceCents: 0, free: false, amountToFreeShippingCents: 0 };
  }
  const priced = candidates.map((r) => {
    const free =
      forceFree ||
      (r.freeAboveSubtotalCents != null && discountedSubtotalCents >= r.freeAboveSubtotalCents);
    return { rate: r, priceCents: free ? 0 : r.priceCents, free };
  });
  priced.sort((a, b) => a.priceCents - b.priceCents);
  const best = priced[0];
  const threshold = best.rate.freeAboveSubtotalCents;
  const amountToFree =
    best.free || threshold == null ? 0 : Math.max(0, threshold - discountedSubtotalCents);
  return { ...best, amountToFreeShippingCents: amountToFree };
}
