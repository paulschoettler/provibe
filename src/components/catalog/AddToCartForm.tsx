"use client";

import { useId, useState, useTransition } from "react";
import { useCart } from "@/components/cart/cart-context";
import { addToCartForm } from "@/lib/cart/actions";

/**
 * Warenkorb-Button als echtes Formular (Progressive Enhancement):
 * - Ohne JavaScript schickt das Formular variantId und Menge an die Server Action addToCartForm
 *   und landet auf /cart (redirectTo "/cart/", siehe Hinweis unten).
 * - Mit JavaScript fängt onSubmit ab und ruft useCart().addLine auf, der Drawer öffnet sich.
 * Preise schickt der Client nie, nur die Varianten-ID und die Menge.
 *
 * Hinweis redirectTo: finishForm in src/lib/cart/actions leitet nur weiter, wenn das Ziel nicht
 * genau "/cart" ist. "/cart/" führt per Weiterleitung auf /cart, sodass Kundinnen ohne
 * JavaScript ihren Warenkorb sehen (Vorschlag für eine sauberere Lösung im Paketbericht).
 */
export function AddToCartForm({
  variantId,
  quantity = 1,
  label,
  ariaLabel,
  className = "",
  buttonClassName = "",
  icon,
  disabled = false,
}: {
  variantId: string;
  quantity?: number;
  label: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const { addLine } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  return (
    <form
      action={addToCartForm}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addLine(variantId, quantity);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="redirectTo" value="/cart/" />
      <button
        type="submit"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-describedby={error ? errorId : undefined}
        aria-busy={isPending || undefined}
        disabled={disabled || isPending}
      >
        {icon}
        <span className="pvc-btn-label">{label}</span>
      </button>
      {error ? (
        <p id={errorId} role="alert" className="pvc-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export default AddToCartForm;
