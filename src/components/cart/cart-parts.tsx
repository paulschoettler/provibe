import type { CartTotals } from "@/lib/pricing";
import { formatEur } from "@/lib/money";

/**
 * Gemeinsame Darstellung für Drawer und Seite /cart. Diese Datei enthält bewusst keine Hooks
 * und kein "use client", damit sie sowohl in der Server-Komponente als auch im Drawer läuft.
 * Alle Beträge kommen fertig gerechnet aus src/lib/pricing.
 */

export function FreeShippingHint({ totals }: { totals: CartTotals }) {
  const threshold = totals.shippingRate?.freeAboveSubtotalCents ?? null;
  if (totals.shippingFree) {
    return <p className="text-success text-[14px] font-semibold">Dein Versand ist kostenlos.</p>;
  }
  if (!threshold || totals.amountToFreeShippingCents <= 0) return null;
  const progress = Math.min(100, Math.round((totals.discountedSubtotalCents / threshold) * 100));
  return (
    <div>
      <p className="text-aubergine/80 text-[14px]">
        Noch{" "}
        <strong className="font-semibold">{formatEur(totals.amountToFreeShippingCents)}</strong> bis
        zum kostenlosen Versand
      </p>
      <div
        className="bg-aubergine/10 mt-2 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Fortschritt bis zum kostenlosen Versand"
      >
        <div
          className="bg-magenta h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <dl className="text-[15px]">
      <Row label="Zwischensumme" value={formatEur(totals.subtotalCents)} />
      {totals.depositCents > 0 && <Row label="Pfand" value={formatEur(totals.depositCents)} />}
      <Row
        label="Versand"
        value={
          totals.shippingRate === null
            ? "wird im Checkout berechnet"
            : totals.shippingFree
              ? "Kostenlos"
              : formatEur(totals.shippingCents)
        }
        hint={totals.shippingRate?.name ?? undefined}
      />
      <div className="border-aubergine/15 mt-3 flex items-baseline justify-between border-t pt-3">
        <dt className="text-[17px] font-semibold">Gesamt</dt>
        <dd className="text-[19px] font-semibold">{formatEur(totals.totalCents)}</dd>
      </div>
      <p className="text-aubergine/60 mt-1 text-[13px]">
        inkl. {formatEur(totals.taxCents)} MwSt.
        {totals.shippingRate === null ? ", zzgl. Versand" : ""}
      </p>
    </dl>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-aubergine/80">
        {label}
        {hint ? <span className="text-aubergine/50 ml-1 text-[13px]">({hint})</span> : null}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Pfandhinweis je Position, getrennt vom Preis (PAngV § 7). */
export function DepositNote({
  quantity,
  unitDepositCents,
}: {
  quantity: number;
  unitDepositCents: number;
}) {
  if (unitDepositCents <= 0) return null;
  return (
    <p className="text-aubergine/60 text-[13px]">
      inkl. {formatEur(quantity * unitDepositCents)} Pfand
    </p>
  );
}
