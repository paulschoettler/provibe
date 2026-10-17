import type { TaxLine } from "@/lib/pricing";
import type { StoredAddress } from "./types";

/**
 * Darstellungsform einer Bestellung für Bestätigungsseite und Mails. Wird serverseitig aus
 * orders, order_items, order_events und dem Session-Snapshot zusammengesetzt (orders.ts).
 */
export interface OrderViewItem {
  title: string;
  description: string;
  quantity: number;
  /** Menge × (Preis + Pfand), vor Rabatt */
  displayTotalCents: number;
  unitPriceCents: number;
  unitDepositCents: number;
  basePriceText: string | null;
  imageUrl: string | null;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  email: string;
  placedAt: string;
  paidAt: string | null;
  paymentStatus: string;
  paymentLabel: string;
  items: OrderViewItem[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  depositCents: number;
  depositLabel: string;
  shippingCents: number;
  shippingName: string;
  shippingFree: boolean;
  deliveryTimeText: string;
  taxLines: TaxLine[];
  taxCents: number;
  totalCents: number;
  shippingAddress: StoredAddress;
  billingAddress: StoredAddress | null;
  legalVersionIds: string[];
  isTest: boolean;
  marketingOptIn: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  card: "Karte",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  paypal: "PayPal",
  klarna: "Klarna",
  sepa_debit: "SEPA-Lastschrift",
  link: "Link",
};

/** "Karte, Visa endet auf 4242", "PayPal", ... */
export function paymentLabel(details: {
  method?: string | null;
  brand?: string | null;
  last4?: string | null;
}): string {
  const method = details.method ?? "card";
  const base = METHOD_LABELS[method] ?? method;
  if (method === "card" && details.last4) {
    return `${base}, ${details.brand ?? "Karte"} endet auf ${details.last4}`;
  }
  return base;
}
