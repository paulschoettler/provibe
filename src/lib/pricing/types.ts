import type { Cents } from "@/lib/money";

export type DiscountKind = "percentage" | "fixed_amount" | "free_shipping";

export interface DiscountRule {
  code: string;
  kind: DiscountKind;
  /** percentage: Basispunkte (1000 = 10 %), fixed_amount: Cent, free_shipping: ignoriert */
  value: number;
  minSubtotalCents: Cents;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  usageCount: number;
  usageLimitPerCustomer?: number | null;
  customerUsageCount?: number;
  isActive: boolean;
  /** Einschränkung auf Produkte: undefined = ganze Bestellung, Liste = nur diese Produkte (leer = keines) */
  productIds?: string[];
}

export interface PricedLine {
  variantId: string;
  productId: string;
  quantity: number;
  /** Bruttopreis je Stück (Variante), ohne Pfand */
  unitPriceCents: Cents;
  /** Pfand je Stück (Variante), 0 wenn keins */
  unitDepositCents: Cents;
  taxRateBp: number;
  /** Gewicht je Stück in Gramm (Variante inkl. Verpackung) */
  weightGrams: number;
}

export interface ShippingRateRule {
  id: string;
  name: string;
  priceCents: Cents;
  freeAboveSubtotalCents?: Cents | null;
  minSubtotalCents: Cents;
  maxSubtotalCents?: Cents | null;
  minWeightGrams: number;
  maxWeightGrams?: number | null;
  taxRateBp: number;
  deliveryTimeText?: string | null;
}

export interface TaxLine {
  rateBp: number;
  /** Bruttobetrag, auf den sich die Steuer bezieht */
  grossCents: Cents;
  taxCents: Cents;
}

export interface LineTotals extends PricedLine {
  /** quantity × unitPriceCents */
  grossCents: Cents;
  depositCents: Cents;
  discountCents: Cents;
  /** grossCents + depositCents − discountCents */
  lineTotalCents: Cents;
}

export interface CartTotals {
  lines: LineTotals[];
  /** Warenwert ohne Pfand, vor Rabatt */
  subtotalCents: Cents;
  discountCents: Cents;
  discountCode: string | null;
  discountReason: DiscountRejection | null;
  /** Warenwert nach Rabatt, ohne Pfand (Basis für Versandkostenfreigrenze) */
  discountedSubtotalCents: Cents;
  depositCents: Cents;
  shippingCents: Cents;
  shippingRate: ShippingRateRule | null;
  shippingFree: boolean;
  /** Fehlbetrag bis zur Versandkostenfreigrenze, 0 wenn erreicht */
  amountToFreeShippingCents: Cents;
  taxLines: TaxLine[];
  taxCents: Cents;
  totalCents: Cents;
  totalWeightGrams: number;
}

export type DiscountRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "usage_limit_reached"
  | "customer_limit_reached"
  | "min_subtotal_not_reached"
  | "not_applicable";
