"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatEur } from "@/lib/money";
import type { CartLineView } from "@/lib/cart/types";
import { MAX_LINE_QUANTITY } from "@/lib/cart/types";
import { useCart } from "./cart-context";
import { useCartError } from "./CartProvider";
import { CartSummary, DepositNote, FreeShippingHint, SubscriptionLineNote } from "./cart-parts";

/** Hilfsfunktion für die typisierten Routen von Next: /checkout und /collections gibt es noch nicht. */
const ROUTE = (path: string) => path as Route;

/**
 * Warenkorb-Drawer: Erweiterung für Besucher mit JavaScript. Alle Inhalte stehen auch ohne
 * JavaScript unter /cart. Der Drawer rendert nichts, solange er geschlossen ist.
 */
export function CartDrawer() {
  const { cart, isOpen, close, pending, updateLine, removeLine } = useCart();
  const error = useCartError();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Einfahren erst nach dem ersten Frame, damit die Bewegung sichtbar ist
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      setShown(false);
    };
  }, [isOpen]);

  // Escape schließt, Tab bleibt im Panel (Fokus-Falle)
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;
  const totals = cart.totals;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Warenkorb schließen"
        onClick={close}
        className={`bg-pv-ui-overlay absolute inset-0 h-full w-full cursor-default transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        data-lenis-prevent
        className={`bg-pv-cream absolute inset-y-0 right-0 flex w-full flex-col shadow-[0_24px_50px_var(--pv-ui-shadow-strong)] transition-transform duration-300 ease-out sm:w-[420px] ${shown ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="border-pv-ui-hairline flex items-center justify-between border-b px-4 py-3">
          <h2 id="cart-drawer-title" className="headline text-[22px]">
            Dein Warenkorb
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Warenkorb schließen"
            className="text-pv-wildberry flex h-11 w-11 items-center justify-center rounded-full"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {error ? (
          <p role="alert" className="bg-pv-ui-error-bg text-pv-ui-error px-4 py-2 text-[14px]">
            {error}
          </p>
        ) : null}

        {cart.lines.length === 0 || !totals ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-[17px] font-medium">Dein Warenkorb ist leer.</p>
            <Link href={ROUTE("/collections/all")} className="btn-primary" onClick={close}>
              Sorten entdecken
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-4 py-2">
              {cart.lines.map((line) => (
                <DrawerLine
                  key={line.id}
                  line={line}
                  pending={pending}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                />
              ))}
            </ul>

            <div className="border-pv-ui-hairline space-y-3 border-t px-4 py-4">
              <FreeShippingHint totals={totals} />
              <CartSummary totals={totals} />
              <div className="flex flex-col gap-2">
                <Link href={ROUTE("/checkout")} className="btn-primary w-full">
                  Zur Kasse
                </Link>
                <button type="button" onClick={close} className="btn-secondary w-full">
                  Weiter einkaufen
                </button>
              </div>
              <p className="text-pv-wildberry text-center text-[13px]">
                <Link href={ROUTE("/cart")} className="link-underline text-[13px]" onClick={close}>
                  Warenkorb als Seite öffnen
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DrawerLine({
  line,
  pending,
  onUpdate,
  onRemove,
}: {
  line: CartLineView;
  pending: boolean;
  onUpdate: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}) {
  return (
    <li className="border-pv-ui-hairline flex gap-3 border-b py-4 last:border-b-0">
      <Link
        href={ROUTE(line.productUrl)}
        className="bg-pv-cream rounded-card shrink-0 overflow-hidden"
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productTitle}
            width={72}
            height={96}
            className="h-24 w-[72px] object-contain"
          />
        ) : (
          <span className="block h-24 w-[72px]" aria-hidden="true" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={ROUTE(line.productUrl)} className="block truncate text-[16px] font-bold">
              {line.productTitle}
            </Link>
            <p className="text-pv-wildberry text-[14px]">{line.variantTitle}</p>
            <SubscriptionLineNote subscription={line.subscription} quantity={line.quantity} />
          </div>
          <p className="shrink-0 text-[16px] font-bold">{formatEur(line.lineGoodsCents)}</p>
        </div>

        <DepositNote lineDepositCents={line.lineDepositCents} />
        <p className="text-pv-wildberry text-[13px]">Grundpreis: {line.basePriceText}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="border-pv-ui-hairline flex items-center rounded-full border">
            <button
              type="button"
              disabled={pending}
              aria-label={`Menge verringern für ${line.productTitle}, ${line.variantTitle}`}
              onClick={() => onUpdate(line.id, line.quantity - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] leading-none disabled:opacity-50"
            >
              −
            </button>
            <span aria-live="polite" className="w-8 text-center text-[15px] font-bold">
              {line.quantity}
            </span>
            <button
              type="button"
              disabled={pending || line.quantity >= MAX_LINE_QUANTITY}
              aria-label={`Menge erhöhen für ${line.productTitle}, ${line.variantTitle}`}
              onClick={() => onUpdate(line.id, line.quantity + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] leading-none disabled:opacity-50"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onRemove(line.id)}
            className="text-pv-wildberry text-[14px] underline underline-offset-4 disabled:opacity-50"
          >
            Entfernen
          </button>
        </div>
      </div>
    </li>
  );
}
