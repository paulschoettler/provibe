"use client";

import { useCart } from "@/components/cart/cart-context";
import { CartIcon } from "./icons";

/**
 * Warenkorb-Icon im Header. Öffnet den Warenkorb-Drawer und zeigt die Anzahl der Artikel.
 * Der Zähler kommt aus dem CartContext (Implementierung liegt im Warenkorb-Arbeitspaket).
 */
export function CartIconButton() {
  const { cart, open } = useCart();
  const count = cart.itemCount;

  return (
    <button
      type="button"
      onClick={open}
      className="pv-header-icon relative"
      aria-label={`Warenkorb, ${count} ${count === 1 ? "Artikel" : "Artikel"}`}
    >
      <CartIcon className="h-6 w-6" />
      {count > 0 ? (
        <span className="pv-cart-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

export default CartIconButton;
