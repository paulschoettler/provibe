import type { CartLineSubscription } from "@/lib/cart/types";
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
    return <p className="text-pv-ui-success text-[14px] font-bold">Dein Versand ist kostenlos.</p>;
  }
  if (!threshold || totals.amountToFreeShippingCents <= 0) return null;
  const progress = Math.min(100, Math.round((totals.discountedSubtotalCents / threshold) * 100));
  return (
    <div>
      <p className="text-pv-wildberry text-[14px]">
        Noch <strong className="font-bold">{formatEur(totals.amountToFreeShippingCents)}</strong>{" "}
        bis zum kostenlosen Versand
      </p>
      <div
        className="bg-pv-ui-hairline mt-2 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Fortschritt bis zum kostenlosen Versand"
      >
        <div
          className="bg-pv-wildberry h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <dl className="text-[15px]">
      <Row label="Zwischensumme (ohne Pfand)" value={formatEur(totals.subtotalCents)} />
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
      <div className="border-pv-ui-hairline mt-3 flex items-baseline justify-between border-t pt-3">
        <dt className="text-[17px] font-bold">Gesamt</dt>
        <dd className="text-[19px] font-bold">{formatEur(totals.totalCents)}</dd>
      </div>
      <p className="text-pv-wildberry mt-1 text-[13px]">
        Zahlbetrag inkl. Pfand und MwSt. (darin {formatEur(totals.taxCents)} MwSt.)
        {totals.shippingRate === null ? ", zzgl. Versand" : ""}
      </p>
    </dl>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-pv-wildberry">
        {label}
        {hint ? <span className="text-pv-wildberry ml-1 text-[13px]">({hint})</span> : null}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/**
 * Pfandhinweis je Position, getrennt neben dem Zeilenpreis ohne Pfand (§ 7 PAngV, H22).
 * Erst die Summe "Gesamt" rechnet das Pfand in den Zahlbetrag ein.
 */
export function DepositNote({ lineDepositCents }: { lineDepositCents: number }) {
  if (lineDepositCents <= 0) return null;
  return <p className="text-pv-wildberry text-[13px]">zzgl. {formatEur(lineDepositCents)} Pfand</p>;
}

/**
 * Kennzeichnung einer Abo-Position (Paket Abo) in Drawer und /cart: Intervall, Rabatt und der
 * Einmalpreis zum Vergleich. Der Zeilenpreis daneben ist bereits der Preis je Lieferung.
 */
export function SubscriptionLineNote({
  subscription,
  quantity,
}: {
  subscription: CartLineSubscription | null | undefined;
  quantity: number;
}) {
  if (!subscription) return null;
  const percent = (subscription.discountBp / 100).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  });
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <span className="pv-abo-chip">
        <span aria-hidden="true">↻</span> Im Abo, alle {subscription.intervalWeeks} Wochen
      </span>
      <span className="text-pv-wildberry">
        {percent} % gespart, einmalig {formatEur(subscription.listUnitPriceCents * quantity)}
      </span>
    </p>
  );
}
