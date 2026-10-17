import type { AmountsSnapshot, SnapshotLine } from "@/lib/checkout/types";
import type { ShippingRateRule } from "@/lib/pricing";
import { subscriptionDeliveryPrice } from "@/lib/pricing/subscription";
import { firstNextOrderAt } from "./schedule";

/**
 * Pflichtangaben je Abo-Position vor dem Button "Zahlungspflichtig abonnieren" (§ 312j BGB,
 * Plan B): Intervall, Preis je Lieferung inklusive MwSt. und Pfand, Versand, erste Lieferung
 * jetzt, nächste am Datum, Laufzeit, Kündigung. Rein (getestet in terms.test.ts).
 *
 * Der Preis je Lieferung gilt für die Abo-Position allein: Spätere Lieferungen enthalten nur das
 * Abo, deshalb kann der Versand dort anders ausfallen als in einer gemischten ersten Bestellung.
 */
export interface SubscriptionTerms {
  variantId: string;
  productTitle: string;
  description: string;
  quantity: number;
  intervalWeeks: number;
  discountBp: number;
  /** Warenwert je Lieferung nach Rabatt, ohne Pfand */
  goodsCents: number;
  savingsCents: number;
  depositCents: number;
  shippingCents: number;
  /** Zahlbetrag je Lieferung inklusive Pfand, Versand und MwSt. */
  totalCents: number;
  taxCents: number;
  nextDelivery: Date;
}

export function subscriptionTerms(
  snapshot: AmountsSnapshot,
  shippingRates: ShippingRateRule[],
  depositTaxRateBp: number,
  now: Date = new Date(),
): SubscriptionTerms[] {
  return snapshot.lines
    .filter((l): l is SnapshotLine & { subscription: NonNullable<SnapshotLine["subscription"]> } =>
      Boolean(l.subscription),
    )
    .map((l) => {
      const price = subscriptionDeliveryPrice({
        line: {
          variantId: l.variantId,
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.subscription.listUnitPriceCents,
          unitDepositCents: l.unitDepositCents,
          taxRateBp: l.taxRateBp,
          weightGrams: l.weightGrams,
        },
        discountBp: l.subscription.discountBp,
        shippingRates,
        depositTaxRateBp,
        now,
      });
      return {
        variantId: l.variantId,
        productTitle: l.productTitle,
        description: l.description,
        quantity: l.quantity,
        intervalWeeks: l.subscription.intervalWeeks,
        discountBp: l.subscription.discountBp,
        goodsCents: price.goodsCents,
        savingsCents: price.savingsCents,
        depositCents: price.depositCents,
        shippingCents: price.shippingCents,
        totalCents: price.totalCents,
        taxCents: price.totals.taxCents,
        nextDelivery: firstNextOrderAt(now, l.subscription.intervalWeeks),
      };
    });
}
