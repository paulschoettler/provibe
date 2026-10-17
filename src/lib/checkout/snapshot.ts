import { depositPerItemCents } from "@/lib/cart/mapping";
import { formatEur } from "@/lib/money";
import {
  calculateBasePrice,
  calculateCartTotals,
  formatBasePrice,
  type CartTotals,
  type DiscountRule,
  type PricedLine,
  type ShippingRateRule,
} from "@/lib/pricing";
import { DELIVERY_TIME_TEXT } from "./delivery";
import type {
  AmountsSnapshot,
  CheckoutRawLine,
  ComponentSnapshot,
  SnapshotLine,
  StoredAddress,
} from "./types";

/**
 * Reine Rechen- und Mapping-Logik des Checkouts, ohne Datenbank (testbar in snapshot.test.ts).
 * Alle Summen kommen aus calculateCartTotals, hier wird nur zusammengesetzt und umbenannt.
 */

export interface SnapshotInput {
  lines: CheckoutRawLine[];
  discount: (DiscountRule & { id: string }) | null;
  /** Versandtarife, aus denen gewählt wird. Mit gewählter Versandart genau ein Eintrag. */
  shippingRates: ShippingRateRule[];
  depositTaxRateBp: number;
  now?: Date;
}

export interface SnapshotResult {
  snapshot: AmountsSnapshot;
  totals: CartTotals;
}

/** "3–5 Werktage" aus der Datenbank wird zu "3 bis 5 Werktage" (keine Gedankenstriche im Text). */
export function normalizeDeliveryText(text: string | null | undefined): string {
  if (!text) return DELIVERY_TIME_TEXT;
  return text.replace(/\s*[–—-]\s*/g, " bis ");
}

/** Zweite Zeile einer Position: "9 Dosen à 0,33 l", bei Bundles der Untertitel. */
export function lineDescription(line: CheckoutRawLine): string {
  if (line.productKind === "bundle") return line.productSubtitle ?? line.variantTitle;
  if (line.unitCount > 1 && line.netContentPerUnit && line.basePriceMeasure === "l") {
    const content = line.netContentPerUnit.toLocaleString("de-DE", { maximumFractionDigits: 3 });
    return `${line.unitCount} Dosen à ${content} l`;
  }
  return line.variantTitle;
}

export function buildAmountsSnapshot(input: SnapshotInput): SnapshotResult {
  const now = input.now ?? new Date();

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
    discount: input.discount,
    shippingRates: input.shippingRates,
    depositTaxRateBp: input.depositTaxRateBp,
    now,
  });

  const lines: SnapshotLine[] = input.lines.map((l, i) => {
    const p = priced[i];
    const t = totals.lines[i];
    const effectiveDepositPerUnit = p.unitDepositCents === 0 ? 0 : l.depositCentsPerUnit;
    const basePrice = calculateBasePrice({
      priceCents: l.priceCents,
      depositCentsPerUnit: effectiveDepositPerUnit,
      unitCount: l.unitCount,
      netContentPerUnit: l.netContentPerUnit,
      measure: l.basePriceMeasure,
    });
    return {
      variantId: l.variantId,
      productId: l.productId,
      productHandle: l.productHandle,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
      description: lineDescription(l),
      sku: l.sku,
      imageUrl: l.imageUrl,
      quantity: l.quantity,
      unitCount: l.unitCount,
      unitPriceCents: p.unitPriceCents,
      unitDepositCents: p.unitDepositCents,
      displayTotalCents: t.grossCents + t.depositCents,
      discountCents: t.discountCents,
      lineTotalCents: t.lineTotalCents,
      taxClass: l.taxClass,
      taxRateBp: l.taxRateBp,
      weightGrams: l.weightGrams,
      basePriceText: formatBasePrice(basePrice),
      depositCans: p.unitDepositCents > 0 ? l.depositCansPerItem * l.quantity : 0,
      components: l.components,
    };
  });

  const depositRates = new Set(
    input.lines.filter((l, i) => priced[i].unitDepositCents > 0).map((l) => l.depositCentsPerCan),
  );
  const rate = totals.shippingRate;
  const discountApplied = totals.discountCode ? input.discount : null;

  const snapshot: AmountsSnapshot = {
    version: 1,
    computedAt: now.toISOString(),
    currency: "EUR",
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    discountCode: discountApplied?.code ?? null,
    discountCodeId: discountApplied?.id ?? null,
    discountFreeShipping: discountApplied?.kind === "free_shipping",
    discountedSubtotalCents: totals.discountedSubtotalCents,
    depositCents: totals.depositCents,
    depositCans: lines.reduce((s, l) => s + l.depositCans, 0),
    depositCentsPerCan: depositRates.size === 1 ? [...depositRates][0] : null,
    shipping: rate
      ? {
          id: rate.id,
          name: rate.name,
          priceCents: totals.shippingCents,
          listPriceCents: rate.priceCents,
          freeAboveSubtotalCents: rate.freeAboveSubtotalCents ?? null,
          deliveryTimeText: normalizeDeliveryText(rate.deliveryTimeText),
          taxRateBp: rate.taxRateBp,
        }
      : null,
    shippingCents: totals.shippingCents,
    shippingFree: totals.shippingFree,
    amountToFreeShippingCents: totals.amountToFreeShippingCents,
    taxLines: totals.taxLines,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    totalWeightGrams: totals.totalWeightGrams,
  };

  return { snapshot, totals };
}

/** Beschriftung der Pfandzeile: "Pfand (15 Dosen à 0,25 €)" oder schlicht "Pfand". */
export function depositLabel(snapshot: AmountsSnapshot): string {
  if (snapshot.depositCans > 0 && snapshot.depositCentsPerCan) {
    const cans = snapshot.depositCans === 1 ? "1 Dose" : `${snapshot.depositCans} Dosen`;
    return `Pfand (${cans} à ${formatEur(snapshot.depositCentsPerCan)})`;
  }
  return "Pfand";
}

/** Bestellposition für order_items, mit vollständigem Preis-Snapshot. */
export interface OrderItemInsert {
  order_id: string;
  variant_id: string;
  product_id: string;
  product_handle: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  image_path: string | null;
  quantity: number;
  unit_count: number;
  unit_price_cents: number;
  unit_deposit_cents: number;
  discount_cents: number;
  tax_class: string;
  tax_rate_bp: number;
  line_total_cents: number;
  weight_grams: number;
  base_price_text: string;
  components: ComponentSnapshot[] | null;
  position: number;
}

export function buildOrderItems(snapshot: AmountsSnapshot, orderId: string): OrderItemInsert[] {
  return snapshot.lines.map((l, position) => ({
    order_id: orderId,
    variant_id: l.variantId,
    product_id: l.productId,
    product_handle: l.productHandle,
    product_title: l.productTitle,
    variant_title: l.variantTitle,
    sku: l.sku,
    image_path: l.imageUrl,
    quantity: l.quantity,
    unit_count: l.unitCount,
    unit_price_cents: l.unitPriceCents,
    unit_deposit_cents: l.unitDepositCents,
    discount_cents: l.discountCents,
    tax_class: l.taxClass,
    tax_rate_bp: l.taxRateBp,
    line_total_cents: l.lineTotalCents,
    weight_grams: l.weightGrams * l.quantity,
    base_price_text: l.basePriceText,
    components: l.components,
    position,
  }));
}

/** Steuerzeilen im Format von orders.tax_lines. */
export function orderTaxLines(snapshot: AmountsSnapshot) {
  return snapshot.taxLines.map((t) => ({
    rate_bp: t.rateBp,
    taxable_cents: t.grossCents,
    tax_cents: t.taxCents,
  }));
}

/** Einzeilige Adresse: "Paul Muster, Musterstraße 12, 10115 Berlin, Deutschland" */
export function formatAddressLine(a: StoredAddress): string {
  const street = [a.street, a.house_number].filter(Boolean).join(" ");
  return [
    [a.first_name, a.last_name].join(" "),
    a.company,
    street,
    a.address_addition,
    `${a.postal_code} ${a.city}`,
    "Deutschland",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Mehrzeilige Adresse für Bestätigungsseite und Mails. */
export function formatAddressLines(a: StoredAddress): string[] {
  const street = [a.street, a.house_number].filter(Boolean).join(" ");
  return [
    [a.first_name, a.last_name].join(" "),
    a.company ?? "",
    street,
    a.address_addition ?? "",
    `${a.postal_code} ${a.city}`,
    "Deutschland",
  ].filter((s) => s.length > 0);
}

/**
 * "Musterstraße 12a" in Straße und Hausnummer trennen. Die Hausnummer ist der letzte Block,
 * der mit einer Ziffer beginnt (auch "12-14", "3 b"). Ohne Ziffer bleibt alles in street.
 */
export function splitStreet(input: string): { street: string; houseNumber: string | null } {
  const value = input.trim().replace(/\s+/g, " ");
  const match = /^(.*?\D)\s*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/.exec(value);
  if (!match || match[1].trim().length === 0) return { street: value, houseNumber: null };
  return { street: match[1].trim().replace(/,$/, ""), houseNumber: match[2].replace(/\s+/g, "") };
}
