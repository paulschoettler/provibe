import type { CartLineView, CartView } from "@/lib/cart/types";
import { buildCartChangeEvent, buildViewCartEvent } from "@/lib/tracking/builders";
import { track } from "./track";

/**
 * Warenkorb-Events aus dem CartProvider. Beträge stammen aus der Server-Antwort (CartView),
 * nie aus Eingaben. Fehler im Tracking dürfen den Warenkorb nie stören.
 */

export function trackAddToCart(cart: CartView, variantId: string, quantity: number) {
  try {
    const line = cart.lines.find((l) => l.variantId === variantId);
    if (line) track(buildCartChangeEvent("add_to_cart", line, quantity));
  } catch {
    // Tracking ist Nebensache
  }
}

/** Mengenänderung: mehr als vorher ist add_to_cart, weniger ist remove_from_cart. */
export function trackQuantityChange(before: CartLineView | undefined, quantity: number) {
  try {
    if (!before || quantity === before.quantity) return;
    const delta = quantity - before.quantity;
    track(buildCartChangeEvent(delta > 0 ? "add_to_cart" : "remove_from_cart", before, delta));
  } catch {
    // Tracking ist Nebensache
  }
}

export function trackRemoveFromCart(line: CartLineView | undefined) {
  try {
    if (line) track(buildCartChangeEvent("remove_from_cart", line, line.quantity));
  } catch {
    // Tracking ist Nebensache
  }
}

export function trackViewCart(cart: CartView) {
  try {
    if (cart.lines.length) track(buildViewCartEvent(cart.lines));
  } catch {
    // Tracking ist Nebensache
  }
}
