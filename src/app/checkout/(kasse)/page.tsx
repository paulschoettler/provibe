import type { Metadata, Route } from "next";
import Link from "next/link";
import { DetailsForm, type ShippingOption } from "@/components/checkout/DetailsForm";
import { DiscountForm } from "@/components/checkout/DiscountForm";
import {
  CheckoutProgress,
  CheckoutTitle,
  MobileSummary,
  Notice,
  OrderSummary,
  PaymentBadges,
} from "@/components/checkout/parts";
import { DISCOUNT_MESSAGES } from "@/lib/checkout/discount";
import { loadCheckoutState, readAddress } from "@/lib/checkout/session";
import { buildAmountsSnapshot, normalizeDeliveryText } from "@/lib/checkout/snapshot";
import { formatEur } from "@/lib/money";
import { buildCheckoutEvent, emitTrackingEvent } from "@/lib/tracking/events";

/** Hängt am Warenkorb-Cookie und an der Checkout-Session, deshalb dynamisch. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse: Adresse und Versand",
  description: "Kontakt, Lieferadresse und Versandart für deine provibe Bestellung.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const [state, params] = await Promise.all([loadCheckoutState(), searchParams]);

  if (!state) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-16 lg:py-24">
        <CheckoutTitle title="Dein Warenkorb ist leer." />
        <p className="mt-4 text-[17px] leading-[1.5]">
          Leg zuerst etwas in den Warenkorb, dann geht es hier weiter.
        </p>
        <Link href={"/collections/all" as Route} className="btn-primary mt-8">
          Sorten entdecken
        </Link>
      </main>
    );
  }

  const { snapshot, session, cart } = state;
  await emitTrackingEvent(
    buildCheckoutEvent("begin_checkout", `begin_checkout_${cart.id}`, {
      items: snapshot.lines.map((l) => ({
        id: l.sku ?? l.variantId,
        title: l.productTitle,
        variant: l.variantTitle,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
      })),
      valueCents: snapshot.discountedSubtotalCents,
      coupon: snapshot.discountCode,
    }),
  );

  // Versandkarten: Preis je Tarif für genau diesen Warenkorb (Grenze kostenloser Versand)
  const shippingOptions: ShippingOption[] = state.shippingRates.map((rate) => {
    const priced = buildAmountsSnapshot({
      lines: cart.lines,
      discount: state.discount,
      shippingRates: [rate],
      depositTaxRateBp: state.depositTaxRateBp,
    }).snapshot;
    return {
      id: rate.id,
      name: rate.name,
      deliveryText: normalizeDeliveryText(rate.deliveryTimeText),
      listPriceText: formatEur(rate.priceCents),
      priceText: priced.shippingFree ? "kostenlos" : formatEur(priced.shippingCents),
      freeAboveText: rate.freeAboveSubtotalCents
        ? `kostenlos ab ${formatEur(rate.freeAboveSubtotalCents).replace(",00", "")}`
        : null,
    };
  });

  const ship = readAddress(session?.shipping_address);
  const bill = readAddress(session?.billing_address);
  const street = (a: typeof ship) =>
    a ? [a.street, a.house_number].filter(Boolean).join(" ") : "";
  const defaults: Record<string, string> = {
    email: session?.email ?? cart.email ?? "",
    firstName: ship?.first_name ?? "",
    lastName: ship?.last_name ?? "",
    street: street(ship),
    addressAddition: ship?.address_addition ?? "",
    postalCode: ship?.postal_code ?? "",
    city: ship?.city ?? "",
    phone: session?.phone ?? "",
    shippingRateId: session?.shipping_rate_id ?? "",
    billingDifferent: bill ? "on" : "",
    billingFirstName: bill?.first_name ?? "",
    billingLastName: bill?.last_name ?? "",
    billingStreet: street(bill),
    billingAddressAddition: bill?.address_addition ?? "",
    billingPostalCode: bill?.postal_code ?? "",
    billingCity: bill?.city ?? "",
  };

  const rejection = state.discountRejection ? DISCOUNT_MESSAGES[state.discountRejection] : null;
  const appliedCode = state.discount?.code ?? null;

  return (
    <main className="co-page">
      <MobileSummary snapshot={snapshot}>
        <DiscountForm idPrefix="mobil-oben" appliedCode={appliedCode} rejection={rejection} />
      </MobileSummary>

      <div className="relative overflow-hidden">
        <div className="co-blob co-blob--pink" aria-hidden="true" />
        <div className="co-blob co-blob--butter hidden lg:block" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-7 px-4 pt-6 pb-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-[60px] lg:px-[120px] lg:pt-12 lg:pb-16">
          <div className="flex min-w-0 flex-col gap-7">
            <CheckoutProgress step={1} />
            <CheckoutTitle title="Wohin geht dein Vibe?" />
            {params.fehler ? (
              <Notice tone="error" title="Bitte prüf deine Angaben">
                {params.fehler.slice(0, 200)}
              </Notice>
            ) : null}
            <DetailsForm
              defaults={defaults}
              shippingOptions={shippingOptions}
              selectedRateId={state.selectedRate?.id ?? null}
              discountSlot={
                <div className="lg:hidden">
                  <DiscountForm idPrefix="mobil" appliedCode={appliedCode} rejection={rejection} />
                </div>
              }
            />
          </div>

          <aside className="hidden lg:block">
            <div className="bg-pv-cream shadow-card sticky top-6 rounded-[22px] p-6">
              <OrderSummary snapshot={snapshot} title="Deine Bestellung">
                <hr className="border-pv-ui-hairline" />
                <DiscountForm idPrefix="desktop" appliedCode={appliedCode} rejection={rejection} />
                <PaymentBadges />
              </OrderSummary>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
