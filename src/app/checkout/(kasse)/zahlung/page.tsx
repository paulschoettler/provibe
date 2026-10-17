import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TruckIcon } from "@/components/checkout/icons";
import { PaymentForm } from "@/components/checkout/PaymentForm";
import { CheckoutProgress, CheckoutTitle, Notice, OrderSummary } from "@/components/checkout/parts";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { preparePayment } from "@/lib/checkout/payment";
import { loadCheckoutState, readAddress } from "@/lib/checkout/session";
import { formatAddressLine } from "@/lib/checkout/snapshot";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse: Zahlung und Übersicht",
  description: "Zahlart wählen und Bestellung prüfen.",
  alternates: { canonical: "/checkout/zahlung" },
  robots: { index: false, follow: false },
};

const SERVER_ERRORS: Record<string, { title: string; text: string }> = {
  "3ds": {
    title: "Zahlung nicht bestätigt",
    text: "Die Bestätigung bei deiner Bank wurde abgebrochen. Es wurde nichts abgebucht. Versuch es noch einmal oder wähl eine andere Zahlart.",
  },
  geaendert: {
    title: "Deine Bestellung wurde aktualisiert",
    text: "Seit dem Laden der Seite hat sich etwas an Warenkorb, Rabatt oder Versand geändert. Bitte prüf die Übersicht und bestell dann erneut.",
  },
};

/**
 * Schritt 2. Beim Aufruf rechnet der Server die Beträge neu, reserviert den Bestand und legt den
 * PaymentIntent an (preparePayment, idempotent). Ohne gespeicherte Adresse geht es zurück zu Schritt 1.
 */
export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const [state, params] = await Promise.all([loadCheckoutState(), searchParams]);
  if (!state) redirect("/cart" as Route);
  if (!state.session?.shipping_address || !state.session.email) redirect("/checkout" as Route);

  const prepared = await preparePayment(state);
  if (!prepared.ok) {
    if (prepared.reason === "insufficient_stock") {
      redirect(`/cart?fehler=${encodeURIComponent(prepared.message)}` as Route);
    }
    redirect(`/checkout?fehler=${encodeURIComponent(prepared.message)}` as Route);
  }

  const { snapshot, session } = prepared;
  const address = readAddress(session.shipping_address)!;
  const shipping = snapshot.shipping;
  const mode = serverEnv().APP_INTEGRATIONS;

  const intro = (
    <>
      <CheckoutProgress step={2} />
      <CheckoutTitle title="Wie willst du zahlen?" />
      <section
        aria-labelledby="h-lieferung"
        className="bg-cream-2 flex flex-col gap-1 rounded-[18px] px-4 py-3.5"
      >
        <div className="flex items-center justify-between">
          <h2 id="h-lieferung" className="text-[15px] font-semibold">
            Lieferung an
          </h2>
          <Link
            href={"/checkout" as Route}
            prefetch={false}
            className="text-plum flex h-8 items-center text-[14px] font-semibold underline underline-offset-4"
          >
            Ändern<span className="sr-only"> (Adresse und Versand)</span>
          </Link>
        </div>
        <p className="text-[14px] leading-[1.4]">{formatAddressLine(address)}</p>
        <p className="text-[14px] leading-[1.4]">{session.email}</p>
        {shipping ? (
          <p className="flex items-center gap-2 pt-1.5 text-[14px]">
            <TruckIcon className="h-[18px] w-[18px]" />
            {shipping.name}, {shipping.deliveryTimeText},{" "}
            {snapshot.shippingFree ? "kostenlos" : formatEur(snapshot.shippingCents)}
          </p>
        ) : null}
      </section>
    </>
  );

  const stale = params.fehler === "geaendert" || params.fehler === "3ds";
  return (
    <main className="co-page relative overflow-hidden">
      <div className="co-blob co-blob--pink" aria-hidden="true" />
      <div className="co-blob co-blob--butter-left hidden lg:block" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1280px] px-4 pt-6 pb-10 lg:px-[120px] lg:pt-12 lg:pb-16">
        {params.fehler && !stale ? (
          <div className="mb-6">
            <Notice tone="error" title="Das hat nicht geklappt">
              {params.fehler.slice(0, 200)}
            </Notice>
          </div>
        ) : null}
        <PaymentForm
          mode={mode}
          publishableKey={publicEnv.stripePublishableKey}
          clientSecret={mode === "live" ? prepared.clientSecret : ""}
          shownTotal={snapshot.totalCents}
          serverError={stale ? SERVER_ERRORS[params.fehler!] : null}
          intro={intro}
          summary={<OrderSummary snapshot={snapshot} title="Bestellung prüfen" showDelivery />}
        />
      </div>
    </main>
  );
}
