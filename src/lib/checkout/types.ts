import type { TaxLine } from "@/lib/pricing";

/**
 * Typen des Checkouts. Beträge immer in Cent, berechnet ausschließlich auf dem Server über
 * calculateCartTotals (src/lib/pricing). Adressen werden in snake_case gespeichert, gleiche
 * Schlüssel wie customer_addresses, damit Konto, Backoffice und DHL sie direkt lesen können.
 */

export const CHECKOUT_COUNTRY = "DE" as const;

/** Adresse, wie sie in checkout_sessions und orders (jsonb) liegt. */
export interface StoredAddress {
  first_name: string;
  last_name: string;
  company: string | null;
  /** Straße ohne Hausnummer (DHL braucht beides getrennt) */
  street: string;
  house_number: string | null;
  address_addition: string | null;
  postal_code: string;
  city: string;
  country_code: typeof CHECKOUT_COUNTRY;
  phone: string | null;
}

/** Bundle-Komponente als Snapshot (für Rechnung, Lieferschein, Bestandsabzug). */
export interface ComponentSnapshot {
  variant_id: string;
  sku: string | null;
  title: string;
  quantity: number;
}

/**
 * Rohzeile des Warenkorbs für den Checkout, zusammengesetzt aus cart_items, product_variants,
 * products und product_translations. Wie in src/lib/cart/mapping.ts ist priceCents der
 * Bruttopreis INKLUSIVE Pfand.
 */
export interface CheckoutRawLine {
  cartItemId: string;
  variantId: string;
  productId: string;
  productHandle: string;
  productKind: string;
  productTitle: string;
  productSubtitle: string | null;
  variantTitle: string;
  sku: string | null;
  unitCount: number;
  quantity: number;
  priceCents: number;
  /** Pfand je Einheit der Variante (bei Bundles: Pfand aller enthaltenen Dosen je Bundle) */
  depositCentsPerUnit: number;
  /** Pfand je Dose, für die Zeile "Pfand (15 Dosen à 0,25 €)"; 0 ohne Pfand */
  depositCentsPerCan: number;
  /** Anzahl pfandpflichtiger Dosen je Stück */
  depositCansPerItem: number;
  netContentPerUnit: number | null;
  basePriceMeasure: "l" | "kg" | "piece";
  taxClass: string;
  taxRateBp: number;
  weightGrams: number;
  imageUrl: string | null;
  components: ComponentSnapshot[] | null;
}

/** Position im Betrags-Snapshot (checkout_sessions.amounts.lines). */
export interface SnapshotLine {
  variantId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  /** Zweite Zeile in der Übersicht, z.B. "9 Dosen à 0,33 l" */
  description: string;
  sku: string | null;
  imageUrl: string | null;
  quantity: number;
  unitCount: number;
  /** Bruttopreis je Stück ohne Pfand */
  unitPriceCents: number;
  unitDepositCents: number;
  /** Anzeigepreis der Position vor Rabatt: Menge × (Preis + Pfand) */
  displayTotalCents: number;
  discountCents: number;
  /** Menge × (Preis + Pfand) − Rabatt */
  lineTotalCents: number;
  taxClass: string;
  taxRateBp: number;
  weightGrams: number;
  /** Grundpreis nach PAngV, z.B. "8,03 € / l" */
  basePriceText: string;
  depositCans: number;
  components: ComponentSnapshot[] | null;
}

export interface SnapshotShipping {
  id: string;
  name: string;
  priceCents: number;
  /** Listenpreis des Tarifs, auch wenn der Versand kostenlos ist */
  listPriceCents: number;
  freeAboveSubtotalCents: number | null;
  deliveryTimeText: string;
  taxRateBp: number;
}

/** Serverseitig berechneter Betrags-Snapshot, gespeichert in checkout_sessions.amounts. */
export interface AmountsSnapshot {
  version: 1;
  computedAt: string;
  currency: "EUR";
  lines: SnapshotLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  discountCode: string | null;
  discountCodeId: string | null;
  discountFreeShipping: boolean;
  discountedSubtotalCents: number;
  depositCents: number;
  depositCans: number;
  /** null, wenn die Dosen unterschiedliches Pfand tragen */
  depositCentsPerCan: number | null;
  shipping: SnapshotShipping | null;
  shippingCents: number;
  shippingFree: boolean;
  amountToFreeShippingCents: number;
  taxLines: TaxLine[];
  taxCents: number;
  totalCents: number;
  totalWeightGrams: number;
}

export type PaymentMethodChoice = "card" | "apple_pay" | "google_pay" | "paypal" | "klarna";

export const PAYMENT_METHODS: {
  id: PaymentMethodChoice;
  title: string;
  subtitle: string;
  /** Stripe payment_method_type für die Bestellung */
  stripeType: string;
}[] = [
  {
    id: "card",
    title: "Karte",
    subtitle: "Visa, Mastercard, Maestro, American Express",
    stripeType: "card",
  },
  { id: "apple_pay", title: "Apple Pay", subtitle: "Weiter mit Apple Pay", stripeType: "card" },
  { id: "google_pay", title: "Google Pay", subtitle: "Weiter mit Google Pay", stripeType: "card" },
  {
    id: "paypal",
    title: "PayPal",
    subtitle: "Du wirst zu PayPal weitergeleitet",
    stripeType: "paypal",
  },
  {
    id: "klarna",
    title: "Klarna",
    subtitle: "Du wirst zu Klarna weitergeleitet",
    stripeType: "klarna",
  },
];

/** Zustand der Formulare in useActionState. values hält die Eingaben für den Neuaufbau ohne JS. */
export interface FormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
