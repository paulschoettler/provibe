"use client";

import { createContext, useContext } from "react";
import { EMPTY_CART, type CartActionResult, type CartView } from "@/lib/cart/types";

/**
 * Vertrag zwischen Warenkorb (Provider, Drawer) und den Aufrufern (Header-Icon,
 * Warenkorb-Button im Hero, Sortenkarten). Die Implementierung liegt in CartProvider.tsx.
 */
export interface CartContextValue {
  cart: CartView;
  /** Drawer geöffnet */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Eine Server Action läuft gerade */
  pending: boolean;
  /** Legt eine Variante in den Warenkorb und öffnet den Drawer bei Erfolg (optional als Abo) */
  addLine: (
    variantId: string,
    quantity?: number,
    options?: { subscriptionIntervalWeeks?: number | null },
  ) => Promise<CartActionResult>;
  updateLine: (lineId: string, quantity: number) => Promise<CartActionResult>;
  removeLine: (lineId: string) => Promise<CartActionResult>;
}

const noop = async (): Promise<CartActionResult> => ({ ok: false, error: "Warenkorb nicht verfügbar", cart: EMPTY_CART });

export const CartContext = createContext<CartContextValue>({
  cart: EMPTY_CART,
  isOpen: false,
  open: () => {},
  close: () => {},
  pending: false,
  addLine: noop,
  updateLine: noop,
  removeLine: noop,
});

export function useCart(): CartContextValue {
  return useContext(CartContext);
}
