import type { CartTotals } from "@/lib/pricing";

/**
 * Sicht auf den Warenkorb für Client und Server-Komponenten. Alle Beträge in Cent,
 * serverseitig berechnet (src/lib/pricing). Der Client sendet nur Varianten-IDs und Mengen.
 */
export interface CartLineView {
  /** cart_items.id */
  id: string;
  variantId: string;
  productHandle: string;
  productTitle: string;
  /** z.B. "9 Dosen" */
  variantTitle: string;
  unitCount: number;
  quantity: number;
  /** Bruttopreis je Stück ohne Pfand */
  unitPriceCents: number;
  /** Pfand je Stück (unit_count × deposit_cents_per_unit) */
  unitDepositCents: number;
  /** quantity × (unitPriceCents + unitDepositCents) − Rabatt */
  lineTotalCents: number;
  imageUrl: string | null;
  productUrl: string;
  /** Grundpreis nach PAngV, fertig formatiert, z.B. "8,79 € / l" (Pflichtangabe neben dem Preis) */
  basePriceText: string;
}

export interface CartView {
  /** null, solange noch kein Warenkorb angelegt wurde */
  id: string | null;
  lines: CartLineView[];
  /** Summe aller Mengen */
  itemCount: number;
  totals: CartTotals | null;
  updatedAt: string | null;
}

export type CartActionResult =
  | { ok: true; cart: CartView }
  | { ok: false; error: string; cart: CartView };

export const EMPTY_CART: CartView = { id: null, lines: [], itemCount: 0, totals: null, updatedAt: null };

/** Name des httpOnly-Cookies mit dem Warenkorb-Token (carts.token) */
export const CART_COOKIE = "pv_cart";
