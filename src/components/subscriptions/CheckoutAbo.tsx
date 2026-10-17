import type { Route } from "next";
import Link from "next/link";
import { formatEur } from "@/lib/money";
import { formatDay } from "@/lib/subscriptions/schedule";
import type { SubscriptionTerms } from "@/lib/subscriptions/terms";

/**
 * Abo im Checkout (Figma 60:240 mobil, 60:472 Desktop). Server-Komponenten ohne Hooks.
 *
 * SubscriptionTermsBlock: alle Pflichtangaben unmittelbar vor "Zahlungspflichtig abonnieren"
 * (§ 312j BGB, Plan B): Intervall, Preis je Lieferung inklusive MwSt. und Pfand, Versand, erste
 * Lieferung jetzt, nächste am Datum, Laufzeit, Kündigung, Hinweis auf Preisänderungen.
 * AccountRequiredBlock: Konto-Pflicht beim Abo (Magic Link an die Bestell-E-Mail).
 */

function percent(bp: number): string {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

function AboIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 9h13l-3-3M20 15H7l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SubscriptionTermsBlock({
  terms,
  siteHost,
}: {
  terms: SubscriptionTerms[];
  siteHost: string;
}) {
  if (terms.length === 0) return null;
  const rates = new Set(terms.map((t) => t.discountBp));
  return (
    <section className="pv-abo-terms" aria-labelledby="dein-abo-titel">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dein-abo-titel" className="flex items-center gap-2 text-[20px] font-medium">
          <AboIcon className="text-pv-wildberry size-6" />
          {terms.length === 1 ? "Dein Abo" : "Deine Abos"}
        </h2>
        {rates.size === 1 ? (
          <span className="bg-pv-lime-raspberry border-pv-wildberry rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-bold">
            {percent([...rates][0])} Rabatt
          </span>
        ) : null}
      </div>
      {terms.map((t) => (
        <dl key={t.variantId} className="pv-abo-terms__list">
          {terms.length > 1 ? (
            <div className="col-span-2 pt-1 text-[15px] font-bold">{t.productTitle}</div>
          ) : null}
          <dt>Lieferintervall</dt>
          <dd>alle {t.intervalWeeks} Wochen</dd>
          <dt>Preis je Lieferung</dt>
          <dd>
            {formatEur(t.totalCents)} inkl. MwSt., davon {formatEur(t.depositCents)} Pfand und{" "}
            {t.shippingCents > 0 ? `${formatEur(t.shippingCents)} Versand` : "kostenloser Versand"}
            <span className="block text-[13px] font-normal">
              Warenwert {formatEur(t.goodsCents)} nach {percent(t.discountBp)} Abo-Rabatt
            </span>
          </dd>
          <dt>Erste Lieferung</dt>
          <dd>jetzt, mit dieser Bestellung</dd>
          <dt>Nächste Lieferung</dt>
          <dd>
            am {formatDay(t.nextDelivery)}, danach alle {t.intervalWeeks} Wochen
          </dd>
          <dt>Laufzeit</dt>
          <dd>unbefristet, keine Mindestlaufzeit</dd>
          <dt>Kündigung</dt>
          <dd>
            jederzeit zum nächsten Liefertermin, im Konto oder ohne Login unter {siteHost}
            /abo-kuendigen
          </dd>
        </dl>
      ))}
      <p className="text-pv-wildberry text-[13px] leading-[1.5]">
        Preisänderungen kündigen wir dir mindestens 4 Wochen vorher per E-Mail an. Bis dahin kannst
        du kündigen.
      </p>
    </section>
  );
}

export function AccountRequiredBlock({ email, loggedIn }: { email: string; loggedIn: boolean }) {
  return (
    <section
      aria-labelledby="h-konto"
      className="bg-pv-cream flex flex-col gap-2 rounded-[18px] px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="h-konto" className="text-[15px] font-medium">
          Dein Kundenkonto
        </h2>
        <span className="bg-pv-lime-raspberry border-pv-wildberry rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-bold">
          Pflicht beim Abo
        </span>
      </div>
      {loggedIn ? (
        <p className="text-[14px] leading-[1.45]">
          Dein Abo landet in deinem Konto ({email}). Dort änderst, pausierst oder kündigst du es
          jederzeit.
        </p>
      ) : (
        <>
          <p className="text-[14px] leading-[1.45]">
            Für dein Abo legen wir mit {email} ein Konto an. Du meldest dich per Magic Link an, ganz
            ohne Passwort, und änderst, pausierst oder kündigst dort jederzeit.
          </p>
          <p className="text-[14px]">
            Du hast schon ein Konto?{" "}
            <Link
              href={"/account/login?next=/checkout/zahlung" as Route}
              className="text-pv-wildberry font-bold underline underline-offset-2"
            >
              Anmelden
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
