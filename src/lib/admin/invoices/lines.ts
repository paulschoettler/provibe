import type { InvoiceLine } from "@/lib/integrations/invoicing/types";

/**
 * Rechnungspositionen aus dem Bestell-Snapshot (order_items und orders), gleiche Aufteilung wie
 * der Checkout (src/lib/checkout/post-order.ts, createInvoiceForOrder): Warenpositionen brutto
 * ohne Pfand, Pfand je Steuersatz als eigene Position, Rabatt je Steuersatz negativ, Versand als
 * Dienstleistung. Reine Funktion; der Test prüft, dass die Summe exakt orders.total_cents ergibt.
 */

export interface InvoiceItemSnapshot {
  product_title: string;
  variant_title: string | null;
  quantity: number;
  unit_price_cents: number;
  unit_deposit_cents: number;
  discount_cents: number;
  tax_rate_bp: number;
}

export interface InvoiceOrderSnapshot {
  shippingCents: number;
  shippingName: string | null;
  discountCode: string | null;
  depositLabel: string;
  /** Steuersatz der Versandkosten; Standard wie Checkout: erste Steuerzeile oder 19 % */
  shippingTaxRateBp: number;
}

export function buildInvoiceLines(
  items: InvoiceItemSnapshot[],
  order: InvoiceOrderSnapshot,
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const discountByRate = new Map<number, number>();
  const depositByRate = new Map<number, number>();
  for (const i of items) {
    lines.push({
      name: i.product_title,
      description: i.variant_title ?? undefined,
      quantity: i.quantity,
      unitGrossCents: i.unit_price_cents,
      taxRateBp: i.tax_rate_bp,
      type: "material",
    });
    if (i.discount_cents > 0) {
      discountByRate.set(
        i.tax_rate_bp,
        (discountByRate.get(i.tax_rate_bp) ?? 0) + i.discount_cents,
      );
    }
    if (i.unit_deposit_cents > 0) {
      depositByRate.set(
        i.tax_rate_bp,
        (depositByRate.get(i.tax_rate_bp) ?? 0) + i.unit_deposit_cents * i.quantity,
      );
    }
  }
  for (const [rate, cents] of depositByRate) {
    lines.push({
      name: order.depositLabel,
      quantity: 1,
      unitGrossCents: cents,
      taxRateBp: rate,
      type: "custom",
    });
  }
  for (const [rate, cents] of discountByRate) {
    lines.push({
      name: `Rabatt${order.discountCode ? ` (${order.discountCode})` : ""}`,
      quantity: 1,
      unitGrossCents: -cents,
      taxRateBp: rate,
      type: "custom",
    });
  }
  if (order.shippingCents > 0) {
    lines.push({
      name: `Versand${order.shippingName ? ` (${order.shippingName})` : ""}`,
      quantity: 1,
      unitGrossCents: order.shippingCents,
      taxRateBp: order.shippingTaxRateBp,
      type: "service",
    });
  }
  return lines;
}

export function invoiceLinesTotal(lines: InvoiceLine[]): number {
  return lines.reduce((s, l) => s + l.quantity * l.unitGrossCents, 0);
}

/** Zahlungsbedingung: Online bezahlt oder Kauf auf Rechnung (manuelle Bestellung). */
export function paymentTermsLabel(input: {
  paymentProvider: string;
  paymentStatus: string;
}): string {
  if (input.paymentProvider === "manual" && input.paymentStatus !== "paid") {
    return "Zahlbar innerhalb von 14 Tagen ohne Abzug";
  }
  return "Bereits bezahlt";
}
