import type { Route } from "next";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { removeCartLineForm, updateCartLineForm } from "@/lib/cart/actions";
import { getCart } from "@/lib/cart/server";
import type { CartLineView } from "@/lib/cart/types";
import { MAX_LINE_QUANTITY } from "@/lib/cart/types";
import { CartSummary, DepositNote, FreeShippingHint } from "@/components/cart/cart-parts";
import { formatEur } from "@/lib/money";

/** Hilfsfunktion für die typisierten Routen von Next: /checkout und /collections gibt es noch nicht. */
const ROUTE = (path: string) => path as Route;

/**
 * Warenkorb als eigene Seite. Läuft vollständig ohne JavaScript: Mengenänderung und Entfernen
 * gehen über Formulare mit Server Actions. Der Drawer ist nur die schnellere Variante davon.
 * Dynamisch, weil der Warenkorb am httpOnly-Cookie hängt.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warenkorb",
  robots: { index: false, follow: false },
};

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const [cart, params] = await Promise.all([getCart(), searchParams]);
  const totals = cart.totals;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="headline text-[32px] sm:text-[40px]">Warenkorb</h1>

      {params.fehler ? (
        <p
          role="alert"
          className="bg-magenta/10 text-berry rounded-card mt-4 px-4 py-3 text-[15px]"
        >
          {params.fehler}
        </p>
      ) : null}

      {cart.lines.length === 0 || !totals ? (
        <div className="mt-8">
          <p className="text-[18px]">Dein Warenkorb ist leer.</p>
          <Link href={ROUTE("/collections/all")} className="btn-primary mt-5">
            Sorten entdecken
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
          <ul className="border-aubergine/10 border-t">
            {cart.lines.map((line) => (
              <CartPageLine key={line.id} line={line} />
            ))}
          </ul>

          <aside className="bg-cream-2 rounded-card space-y-4 p-5 lg:sticky lg:top-6">
            <h2 className="text-[18px] font-semibold">Zusammenfassung</h2>
            <FreeShippingHint totals={totals} />
            <CartSummary totals={totals} />
            <Link href={ROUTE("/checkout")} className="btn-primary w-full">
              Zur Kasse
            </Link>
            <Link href={ROUTE("/collections/all")} className="btn-secondary w-full">
              Weiter einkaufen
            </Link>
            <p className="text-aubergine/60 text-[13px]">
              Preise inklusive Mehrwertsteuer. Versandkosten und Lieferzeit siehst du oben, Pfand
              wird getrennt ausgewiesen.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}

function CartPageLine({ line }: { line: CartLineView }) {
  return (
    <li className="border-aubergine/10 flex gap-4 border-b py-5">
      <Link
        href={ROUTE(line.productUrl)}
        className="bg-cream-2 rounded-card shrink-0 overflow-hidden"
        aria-hidden={line.imageUrl ? undefined : true}
        tabIndex={line.imageUrl ? undefined : -1}
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
          <span className="block h-24 w-[72px]" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={ROUTE(line.productUrl)} className="text-[17px] font-semibold">
              {line.productTitle}
            </Link>
            <p className="text-aubergine/70 text-[15px]">{line.variantTitle}</p>
            <p className="text-aubergine/60 text-[13px]">
              {`Einzelpreis ${formatEur(line.unitPriceCents)}${
                line.unitDepositCents > 0 ? ` zzgl. ${formatEur(line.unitDepositCents)} Pfand` : ""
              }, Grundpreis: ${line.basePriceText}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[17px] font-semibold">{formatEur(line.lineGoodsCents)}</p>
            <DepositNote lineDepositCents={line.lineDepositCents} />
          </div>
        </div>

        <form action={updateCartLineForm} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="lineId" value={line.id} />
          <div className="border-aubergine/15 flex items-center rounded-full border">
            <button
              type="submit"
              name="quantity"
              value={line.quantity - 1}
              aria-label={`Menge verringern für ${line.productTitle}, ${line.variantTitle}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] leading-none"
            >
              −
            </button>
            <span className="w-10 text-center text-[15px] font-semibold">{line.quantity}</span>
            <button
              type="submit"
              name="quantity"
              value={Math.min(line.quantity + 1, MAX_LINE_QUANTITY)}
              disabled={line.quantity >= MAX_LINE_QUANTITY}
              aria-label={`Menge erhöhen für ${line.productTitle}, ${line.variantTitle}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] leading-none disabled:opacity-50"
            >
              +
            </button>
          </div>
          <button
            type="submit"
            formAction={removeCartLineForm}
            className="text-aubergine/70 text-[14px] underline underline-offset-4"
          >
            Entfernen
          </button>
        </form>
      </div>
    </li>
  );
}
