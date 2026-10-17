import {
  calculateBasePrice,
  calculateCartTotals,
  formatBasePrice,
  type PricedLine,
  type ShippingRateRule,
  type UnitMeasure,
} from "@/lib/pricing";
import type { CartLineView, CartView } from "./types";
import { EMPTY_CART } from "./types";

/**
 * Rohzeile aus der Datenbank, bereits zusammengesetzt aus cart_items, product_variants,
 * products und product_translations. Diese Datei enthält keine Datenbankzugriffe, damit die
 * Rechenlogik ohne Supabase testbar bleibt (siehe mapping.test.ts).
 *
 * Wichtig: priceCents ist der Bruttopreis der Variante INKLUSIVE Pfand. Der Pfandanteil wird
 * hier herausgerechnet, weil Pfand nach PAngV § 7 getrennt auszuweisen und nicht in den
 * Grundpreis einzurechnen ist (gleiche Annahme wie in calculateBasePrice). Angezeigt werden
 * lineGoodsCents (ohne Pfand) und lineDepositCents getrennt, nie lineTotalCents (H22).
 */
export interface CartRawLine {
  /** cart_items.id */
  id: string;
  variantId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  unitCount: number;
  quantity: number;
  /** product_variants.price_cents, brutto, inklusive Pfand */
  priceCents: number;
  /** Pfand je Einheit (Dose). Bei Bundles die Summe des Pfands der Komponenten. */
  depositCentsPerUnit: number;
  netContentPerUnit: number | null;
  basePriceMeasure: UnitMeasure;
  taxRateBp: number;
  /** Gewicht je Stück inklusive Verpackung, in Gramm */
  weightGrams: number;
  imageUrl: string | null;
  productUrl: string;
}

export interface BuildCartViewInput {
  cartId: string | null;
  updatedAt: string | null;
  lines: CartRawLine[];
  shippingRates: ShippingRateRule[];
  /** Steuersatz auf das Pfand, Standard 19 % */
  depositTaxRateBp?: number;
}

/** Pfand je Stück, defensiv begrenzt: Pfand kann nie über dem Verkaufspreis liegen. */
export function depositPerItemCents(line: {
  priceCents: number;
  depositCentsPerUnit: number;
  unitCount: number;
}): number {
  const deposit = Math.max(0, Math.round(line.depositCentsPerUnit)) * line.unitCount;
  return deposit > line.priceCents ? 0 : deposit;
}

/** Baut aus Rohzeilen und Versandtarifen die vollständige Warenkorbsicht mit allen Summen. */
export function buildCartView(input: BuildCartViewInput): CartView {
  if (input.lines.length === 0) {
    return { ...EMPTY_CART, id: input.cartId, updatedAt: input.updatedAt };
  }

  const priced: PricedLine[] = input.lines.map((l) => {
    const unitDepositCents = depositPerItemCents(l);
    return {
      variantId: l.variantId,
      productId: l.productId,
      quantity: l.quantity,
      unitPriceCents: l.priceCents - unitDepositCents,
      unitDepositCents,
      taxRateBp: l.taxRateBp,
      weightGrams: l.weightGrams,
    };
  });

  const totals = calculateCartTotals({
    lines: priced,
    // Rabattcodes folgen in einer späteren Phase (Warenkorb-Phase: kein Rabatt)
    discount: null,
    shippingRates: input.shippingRates,
    depositTaxRateBp: input.depositTaxRateBp,
  });

  const lines: CartLineView[] = input.lines.map((l, i) => {
    const priceLine = priced[i];
    // Wenn das Pfand defensiv auf 0 begrenzt wurde, rechnet auch der Grundpreis ohne Pfand.
    const effectiveDepositPerUnit = priceLine.unitDepositCents === 0 ? 0 : l.depositCentsPerUnit;
    const basePrice = calculateBasePrice({
      priceCents: l.priceCents,
      depositCentsPerUnit: effectiveDepositPerUnit,
      unitCount: l.unitCount,
      netContentPerUnit: l.netContentPerUnit,
      measure: l.basePriceMeasure,
    });
    return {
      id: l.id,
      variantId: l.variantId,
      productHandle: l.productHandle,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
      unitCount: l.unitCount,
      quantity: l.quantity,
      unitPriceCents: priceLine.unitPriceCents,
      unitDepositCents: priceLine.unitDepositCents,
      lineTotalCents: totals.lines[i].lineTotalCents,
      lineGoodsCents: totals.lines[i].grossCents,
      lineDepositCents: totals.lines[i].depositCents,
      imageUrl: l.imageUrl,
      productUrl: l.productUrl,
      basePriceText: formatBasePrice(basePrice),
    };
  });

  return {
    id: input.cartId,
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    totals,
    updatedAt: input.updatedAt,
  };
}
