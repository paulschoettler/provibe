"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { addToCart, readCart, removeCartLine, updateCartLine } from "@/lib/cart/actions";
import {
  trackAddToCart,
  trackQuantityChange,
  trackRemoveFromCart,
  trackViewCart,
} from "@/components/tracking/cart-events";
import type { CartActionResult, CartView } from "@/lib/cart/types";
import { CartContext, type CartContextValue } from "./cart-context";

/** Letzte Fehlermeldung einer Warenkorb-Aktion, für die Anzeige im Drawer. */
const CartErrorContext = createContext<string | null>(null);

export function useCartError(): string | null {
  return useContext(CartErrorContext);
}

/**
 * Hält den serverseitig berechneten Warenkorb im Client und ruft die Server Actions auf.
 * Der Client kennt keine Preise: jede Antwort ersetzt den Zustand vollständig durch das,
 * was der Server gerechnet hat. Ohne JavaScript übernimmt die Seite /cart mit Formularen.
 */
export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartView;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartView>(initialCart);
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const localUpdate = useRef(0);
  const hydrated = useRef(false);

  // Wenn das Layout statisch bleibt (initialCart ohne id), den echten Stand einmal nachladen
  useEffect(() => {
    if (hydrated.current || initialCart.id) return;
    hydrated.current = true;
    startTransition(async () => {
      const fresh = await readCart();
      if (!fresh.id) return;
      setCart((current) => (current.id ? current : fresh));
    });
  }, [initialCart.id]);

  // Frischere Serverdaten übernehmen (z.B. nach einer Navigation), ältere ignorieren
  useEffect(() => {
    setCart((current) => {
      if (Date.now() - localUpdate.current < 2000) return current;
      if (!current.id) return initialCart;
      if (!initialCart.id) return current;
      const a = initialCart.updatedAt ?? "";
      const b = current.updatedAt ?? "";
      return a >= b ? initialCart : current;
    });
  }, [initialCart]);

  const open = useCallback(() => {
    setIsOpen(true);
    trackViewCart(cart);
  }, [cart]);
  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  // Body-Scroll sperren, solange der Drawer offen ist (Lenis läuft auf Desktop, siehe globals.css)
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.classList.add("lenis-stopped");
    return () => {
      document.body.style.overflow = previous;
      root.classList.remove("lenis-stopped");
    };
  }, [isOpen]);

  const run = useCallback(
    (action: () => Promise<CartActionResult>, openOnSuccess: boolean) =>
      new Promise<CartActionResult>((resolve) => {
        startTransition(async () => {
          const result = await action();
          localUpdate.current = Date.now();
          setCart(result.cart);
          setError(result.ok ? null : result.error);
          // Auch bei einem Fehler öffnen, sonst bliebe die Meldung unsichtbar
          if (openOnSuccess) setIsOpen(true);
          resolve(result);
        });
      }),
    [],
  );

  const addLine = useCallback(
    (variantId: string, quantity = 1, options?: { subscriptionIntervalWeeks?: number | null }) =>
      run(() => addToCart(variantId, quantity, options ?? {}), true).then((result) => {
        if (result.ok) trackAddToCart(result.cart, variantId, quantity);
        return result;
      }),
    [run],
  );

  const updateLine = useCallback(
    (lineId: string, quantity: number) => {
      const before = cart.lines.find((l) => l.id === lineId);
      // Optimistisch: die Menge sofort anzeigen, der Server liefert gleich die echten Summen
      setCart((current) => ({
        ...current,
        lines: current.lines.map((l) => (l.id === lineId ? { ...l, quantity } : l)),
      }));
      return run(() => updateCartLine(lineId, quantity), false).then((result) => {
        if (result.ok) trackQuantityChange(before, quantity);
        return result;
      });
    },
    [run, cart],
  );

  const removeLine = useCallback(
    (lineId: string) => {
      const before = cart.lines.find((l) => l.id === lineId);
      setCart((current) => ({
        ...current,
        lines: current.lines.filter((l) => l.id !== lineId),
      }));
      return run(() => removeCartLine(lineId), false).then((result) => {
        if (result.ok) trackRemoveFromCart(before);
        return result;
      });
    },
    [run, cart],
  );

  const value = useMemo<CartContextValue>(
    () => ({ cart, isOpen, open, close, pending, addLine, updateLine, removeLine }),
    [cart, isOpen, open, close, pending, addLine, updateLine, removeLine],
  );

  return (
    <CartContext.Provider value={value}>
      <CartErrorContext.Provider value={error}>{children}</CartErrorContext.Provider>
    </CartContext.Provider>
  );
}
