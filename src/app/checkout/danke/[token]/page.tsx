import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmationNewsletter } from "@/components/checkout/ConfirmationNewsletter";
import { CalendarIcon, PackageIcon, TruckIcon, UserPlusIcon } from "@/components/checkout/icons";
import { FreePill, Notice } from "@/components/checkout/parts";
import { SiteShell } from "@/components/layout/SiteShell";
import { WaveDivider } from "@/components/layout/WaveDivider";
import { deliveryWindow, formatDeliveryWindow, formatGermanDate } from "@/lib/checkout/delivery";
import { lineAmounts, type OrderView } from "@/lib/checkout/order-view";
import { loadOrderView } from "@/lib/checkout/orders";
import { findSessionById } from "@/lib/checkout/session";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import { formatEur } from "@/lib/money";

/**
 * Bestellbestätigung. Der Token ist die ID der Checkout-Session (UUID v4 aus gen_random_uuid,
 * 122 Bit Zufall, nicht erratbar). Dynamisch und nie im Index; kein Referrer, damit der Link
 * nicht an Dritte weitergegeben wird.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Danke für deine Bestellung",
  description: "Deine Bestellung bei provibe ist eingegangen.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ThankYouPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await findSessionById(token);
  if (!session) notFound();

  const order = session.order_id ? await loadOrderView(session.order_id) : null;

  if (!order) {
    const failed = session.status === "failed" || session.status === "expired";
    return (
      <SiteShell>
        {/* Mit echtem Stripe kommt die Bestellung über den Webhook, meist binnen Sekunden */}
        {!failed ? <meta httpEquiv="refresh" content="4" /> : null}
        <section className="mx-auto max-w-[720px] px-4 py-16 lg:py-24">
          <p className="co-eyebrow">{failed ? "Zahlung" : "Einen Moment"}</p>
          <h1 className="text-wine mt-3 text-[40px] leading-[1.08] font-semibold">
            {failed ? "Die Zahlung hat nicht geklappt." : "Wir bestätigen gerade deine Zahlung."}
          </h1>
          <p className="mt-4 text-[17px] leading-[1.5]">
            {failed
              ? "Es wurde nichts abgebucht. Du kannst es mit einer anderen Zahlart noch einmal versuchen."
              : "Das dauert meist nur ein paar Sekunden. Die Seite aktualisiert sich von selbst, die Bestätigung kommt zusätzlich per E-Mail."}
          </p>
          {failed ? (
            <Link href={"/checkout/zahlung" as Route} prefetch={false} className="btn-primary mt-8">
              Zurück zur Zahlung
            </Link>
          ) : null}
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <ThankYouHero order={order} />
      <div className="bg-cream relative -mt-px">
        <WaveDivider shape="soft" fill="var(--color-cream)" position="top" />
        <div className="relative z-[2] mx-auto grid max-w-[1280px] gap-5 px-4 pt-1 pb-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-10 lg:px-[120px] lg:pb-20">
          <div className="flex min-w-0 flex-col gap-5">
            <OrderFacts order={order} />
            <Notice title={`Bestellbestätigung per E-Mail an ${order.email}`}>
              Ist unterwegs. Nichts angekommen? Schau kurz in den Spam-Ordner.
            </Notice>
            <OrderCard order={order} />
            <DeliveryCard order={order} />
            <div className="hidden flex-wrap gap-3 lg:flex">
              <Buttons orderNumber={order.orderNumber} />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <AccountCard email={order.email} />
            <ConfirmationNewsletter email={order.email} />
            <div className="flex flex-col gap-3 lg:hidden">
              <Buttons orderNumber={order.orderNumber} />
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function ThankYouHero({ order }: { order: OrderView }) {
  return (
    <section className="co-thanks-hero relative overflow-hidden">
      <div className="co-thanks-blob" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col items-start gap-[18px] px-4 pt-7 pb-[72px] lg:min-h-[400px] lg:px-[120px] lg:pt-[72px] lg:pb-[110px]">
        <p className="co-eyebrow">Bestellung eingegangen</p>
        <h1 className="co-sticker-headline">Danke, dein Vibe ist unterwegs!</h1>
        <p className="border-aubergine bg-cream rounded-full border-2 px-3.5 py-1.5 text-[14px] font-semibold lg:hidden">
          Bestellung {order.orderNumber}
        </p>
        <p className="hidden max-w-[520px] text-[17px] leading-[1.5] lg:block">
          Bestellung {order.orderNumber}. Wir packen schon, die Bestätigung ist per E-Mail
          unterwegs.
        </p>
      </div>
      <div className="co-thanks-cans" aria-hidden="true">
        <Image
          src="/images/cans/peach.webp"
          alt=""
          width={300}
          height={560}
          className="co-thanks-can co-thanks-can--left"
        />
        <Image
          src="/images/cans/wildberry.webp"
          alt=""
          width={300}
          height={560}
          className="co-thanks-can co-thanks-can--mid"
          priority
        />
        <Image
          src="/images/cans/raspberry-lime.webp"
          alt=""
          width={300}
          height={560}
          className="co-thanks-can co-thanks-can--right"
        />
        <span className="co-thanks-sticker">
          <strong>15 g</strong>
          <span>Protein</span>
        </span>
      </div>
    </section>
  );
}

function OrderFacts({ order }: { order: OrderView }) {
  const window = deliveryWindow(new Date(order.placedAt));
  return (
    <section
      aria-label="Bestelldaten"
      className="bg-cream-2 flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8 lg:gap-y-3 lg:px-6"
    >
      <div className="leading-[1.2]">
        <p className="text-[13px] leading-[1.4]">Bestellnummer</p>
        <p className="text-[24px] font-bold whitespace-nowrap">{order.orderNumber}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <CalendarIcon className="h-[22px] w-[22px]" />
        <div className="leading-[1.4]">
          <p className="text-[13px]">Bestellt am</p>
          <p className="text-[15px] font-semibold whitespace-nowrap">
            {formatGermanDate(window.orderDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <TruckIcon className="h-[22px] w-[22px]" />
        <div className="leading-[1.4]">
          <p className="text-[13px]">Zustellung voraussichtlich</p>
          <p className="text-[15px] font-semibold whitespace-nowrap">
            {formatDeliveryWindow(window)}
          </p>
        </div>
      </div>
    </section>
  );
}

function OrderCard({ order }: { order: OrderView }) {
  const taxText = order.taxLines.map((t) => `${formatEur(t.taxCents)} MwSt.`).join(", ");
  return (
    <section
      aria-labelledby="h-bestellung"
      className="bg-cream-2 flex flex-col gap-3.5 rounded-[22px] p-[18px] lg:p-6"
    >
      <div className="flex items-center justify-between">
        <h2 id="h-bestellung" className="text-[20px] font-semibold">
          Deine Bestellung
        </h2>
        <p className="text-[14px]">{order.itemCount} Artikel</p>
      </div>
      <ul className="flex flex-col gap-3.5">
        {order.items.map((item, i) => {
          const amounts = lineAmounts(item);
          return (
            <li key={`${item.title}-${i}`} className="flex items-center gap-3">
              <div className="bg-pink-light flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={56}
                    height={56}
                    className={`h-14 w-14 ${item.imageUrl.endsWith(".jpg") ? "rounded-[10px] object-cover" : "object-contain"}`}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 leading-[1.4]">
                <p className="text-[15px] font-semibold">{item.title}</p>
                <p className="text-[13px]">{item.description}</p>
                <p className="text-[13px]">
                  Menge {item.quantity}
                  {amounts.depositCents > 0
                    ? ` · zzgl. ${formatEur(amounts.depositCents)} Pfand`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-right leading-[1.4]">
                <p className="text-[15px] font-semibold">{formatEur(amounts.goodsCents)}</p>
                {item.basePriceText && !item.basePriceText.endsWith("Stück") ? (
                  <p className="text-[12px]">{item.basePriceText.replace(" / ", "/")}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <hr className="border-aubergine/20" />
      <dl className="flex flex-col gap-2 text-[15px]">
        <div className="flex justify-between">
          <dt>Zwischensumme (ohne Pfand)</dt>
          <dd>{formatEur(order.subtotalCents)}</dd>
        </div>
        {order.discountCents > 0 ? (
          <div className="flex justify-between">
            <dt>Rabatt{order.discountCode ? ` (${order.discountCode})` : ""}</dt>
            <dd className="text-plum font-semibold">−{formatEur(order.discountCents)}</dd>
          </div>
        ) : null}
        {order.depositCents > 0 ? (
          <div className="flex justify-between">
            <dt>{order.depositLabel}</dt>
            <dd>{formatEur(order.depositCents)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <dt>Versand ({order.shippingName})</dt>
          <dd>{order.shippingFree ? <FreePill /> : formatEur(order.shippingCents)}</dd>
        </div>
      </dl>
      <hr className="border-aubergine/20" />
      <div className="flex items-end justify-between">
        <div className="leading-[1.4]">
          <p className="text-[18px] font-semibold">Gesamt</p>
          <p className="text-[13px]">
            Zahlbetrag inkl. Pfand und MwSt. (darin{" "}
            {taxText || `${formatEur(order.taxCents)} MwSt.`})
          </p>
        </div>
        <p className="text-[24px] leading-[1.2] font-bold">{formatEur(order.totalCents)}</p>
      </div>
    </section>
  );
}

function DeliveryCard({ order }: { order: OrderView }) {
  return (
    <section
      aria-label="Lieferung und Zahlung"
      className="bg-cream-2 grid gap-4 rounded-[22px] p-[18px] lg:grid-cols-3 lg:p-6"
    >
      <div>
        <h2 className="text-[15px] font-semibold">Lieferadresse</h2>
        <address className="mt-1 text-[14px] leading-[1.5] not-italic">
          {formatAddressLines(order.shippingAddress).map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </div>
      <div>
        <h2 className="text-[15px] font-semibold">Rechnungsadresse</h2>
        <address className="mt-1 text-[14px] leading-[1.5] not-italic">
          {order.billingAddress
            ? formatAddressLines(order.billingAddress).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))
            : "wie Lieferadresse"}
        </address>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">Zahlart</h2>
          {order.paymentStatus === "paid" ? (
            <span className="bg-butter border-aubergine rounded-full border-[1.5px] px-2.5 py-0.5 text-[12px] font-semibold">
              Bezahlt
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[14px] leading-[1.5]">{order.paymentLabel}</p>
      </div>
    </section>
  );
}

function AccountCard({ email }: { email: string }) {
  const href = `/account/login?next=${encodeURIComponent("/account")}&email=${encodeURIComponent(email)}`;
  return (
    <section
      aria-labelledby="h-konto"
      className="border-aubergine bg-cream flex flex-col gap-3.5 rounded-[26px] border-2 p-[22px] shadow-[0_6px_12px_rgba(74,46,56,0.22)]"
    >
      <span className="bg-pink-light flex h-12 w-12 items-center justify-center rounded-full">
        <UserPlusIcon className="h-6 w-6" />
      </span>
      <h2 id="h-konto" className="text-[20px] leading-[1.2] font-semibold">
        Konto anlegen, ein Klick
      </h2>
      <p className="text-[14px] leading-[1.5]">
        Wir schicken dir einen Magic Link an {email}. Kein Passwort nötig, diese Bestellung ist dann
        schon drin.
      </p>
      <Link href={href as Route} className="btn-primary w-full">
        Konto anlegen
      </Link>
    </section>
  );
}

function Buttons({ orderNumber }: { orderNumber: string }) {
  return (
    <>
      <Link href={"/collections/all" as Route} className="btn-primary h-[52px] lg:w-[250px]">
        Weiter einkaufen
      </Link>
      <Link
        href={`/account/bestellungen/${orderNumber}` as Route}
        className="border-aubergine bg-cream flex h-[52px] items-center justify-center gap-2 rounded-full border-2 px-[22px] text-[15px] font-semibold lg:w-[230px]"
      >
        <PackageIcon className="h-[18px] w-[18px]" />
        Bestellung ansehen
      </Link>
    </>
  );
}
