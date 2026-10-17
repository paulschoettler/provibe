import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import {
  CardIcon,
  ChevronLeftIcon,
  DocIcon,
  DownloadIcon,
  ExternalIcon,
  PinIcon,
  TruckIcon,
  UndoIcon,
} from "@/components/account/icons";
import {
  AddressLines,
  OrderLineItem,
  SummaryRow,
  itemCountText,
} from "@/components/account/OrderParts";
import { StatusStepper } from "@/components/account/StatusStepper";
import { BTN_OUTLINE, Badge, CARD, CARD_FLAT, LINK_PLUM, Notice } from "@/components/account/ui";
import { getOrderByNumber } from "@/lib/auth/account-data";
import {
  deliveryWindowText,
  formatDate,
  formatWeekdayDate,
  isClosedWithoutDelivery,
  orderSteps,
  paymentBadge,
  paymentMethodLabel,
  statusBadge,
} from "@/lib/auth/order-status";
import { requireCustomer } from "@/lib/auth/session";
import { formatEur } from "@/lib/money";

/** Sendungsnummer in Vierergruppen, wie auf dem DHL-Label (nur Anzeige) */
function formatTrackingNumber(value: string | null): string {
  if (!value) return "";
  return /^\d{12,}$/.test(value) ? value.replace(/(\d{4})(?=\d)/g, "$1 ") : value;
}

/**
 * /account/bestellungen/[nummer]: Bestelldetail (Figma 35:11362 mobil, 35:11646 Desktop).
 * Positionen, Summen mit Pfand und MwSt., Adressen, Zahlart, Tracking, Rechnung, Widerruf.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ nummer: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { nummer } = await params;
  const number = decodeURIComponent(nummer);
  return {
    title: `Bestellung ${number}`,
    description: "Status, Tracking, Rechnung und Widerruf zu deiner provibe Bestellung.",
    alternates: { canonical: `/account/bestellungen/${encodeURIComponent(number)}` },
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({ params }: Params) {
  const { nummer } = await params;
  const number = decodeURIComponent(nummer);
  await requireCustomer(`/account/bestellungen/${encodeURIComponent(number)}`);
  const order = await getOrderByNumber(number);
  if (!order) notFound();

  const badge = statusBadge(order);
  const payBadge = paymentBadge(order.paymentStatus);
  const closed = isClosedWithoutDelivery(order);
  const shipment = order.shipments.find((s) => s.trackingNumber) ?? null;
  const window = deliveryWindowText(order);
  const taxText = order.taxLines.length
    ? order.taxLines.map((t) => `${formatEur(t.taxCents)} MwSt. (${t.rateBp / 100} %)`).join(", ")
    : `${formatEur(order.taxCents)} MwSt.`;
  const withdrawalHref =
    `/pages/widerruf-formular?bestellung=${encodeURIComponent(order.number)}` as Route;
  const invoiceHref = `/account/bestellungen/${encodeURIComponent(order.number)}/rechnung`;

  const actions = (
    <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
      {order.invoiceAvailable ? (
        <a href={invoiceHref} className={BTN_OUTLINE} download>
          <DownloadIcon className="size-[18px]" />
          Rechnung herunterladen (PDF)
        </a>
      ) : (
        <a
          href={invoiceHref}
          className={`${BTN_OUTLINE} opacity-80`}
          aria-describedby="rechnung-hinweis"
        >
          <DownloadIcon className="size-[18px]" />
          Rechnung herunterladen (PDF)
        </a>
      )}
      <Link href={withdrawalHref} className={BTN_OUTLINE}>
        <UndoIcon className="size-[18px]" />
        Widerruf erklären
      </Link>
    </div>
  );

  return (
    <AccountShell active="bestellungen">
      <Link
        href="/account/bestellungen"
        className={`${LINK_PLUM} inline-flex min-h-11 items-center gap-1 text-[14px]`}
      >
        <ChevronLeftIcon className="size-4" />
        Alle Bestellungen
      </Link>

      <h1 className="headline text-pv-wildberry mt-2 text-[40px] lg:text-[56px] xl:text-[64px]">
        Bestellung <span className="whitespace-nowrap">{order.number}</span>
      </h1>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col items-start gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <p className="text-[14px] leading-[1.4]">
            vom {formatWeekdayDate(order.placedAt)} · {itemCountText(order.itemCount)} ·{" "}
            {formatEur(order.totalCents)}
          </p>
        </div>
        <div className="hidden lg:block">{actions}</div>
      </div>

      {/* Status und Tracking */}
      <section
        className={`${CARD} mt-6 flex flex-col gap-5 p-5 sm:p-6`}
        aria-label="Status und Sendung"
      >
        {closed ? (
          <p className="text-[15px] leading-[1.5]">
            {order.status === "cancelled"
              ? "Diese Bestellung wurde storniert. Eine bereits bezahlte Summe erstatten wir auf dein Zahlungsmittel."
              : "Diese Bestellung wurde erstattet."}
          </p>
        ) : (
          <StatusStepper steps={orderSteps(order)} className="lg:px-16" />
        )}
        {shipment || window ? (
          <div className="border-pv-ui-hairline flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center">
            <span className="bg-pv-cream text-pv-wildberry flex size-9 shrink-0 items-center justify-center rounded-full">
              <TruckIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              {shipment ? (
                <>
                  <p className="text-[13px] leading-[1.4]">
                    {shipment.carrier.toUpperCase()} Sendungsnummer
                  </p>
                  <p className="text-[18px] leading-[1.3] font-bold break-all">
                    {formatTrackingNumber(shipment.trackingNumber)}
                  </p>
                </>
              ) : (
                <p className="text-[15px] leading-[1.4] font-bold">Noch nicht versendet</p>
              )}
              {window ? (
                <p className="text-[13px] leading-[1.4]">Zustellung voraussichtlich {window}</p>
              ) : null}
            </div>
            {shipment?.trackingUrl ? (
              <a
                href={shipment.trackingUrl}
                className={BTN_OUTLINE}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalIcon className="size-[18px]" />
                Bei {shipment.carrier.toUpperCase()} verfolgen
                <span className="sr-only">(öffnet in einem neuen Tab)</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        {/* Artikel und Summen */}
        <section className={`${CARD_FLAT} p-5 sm:p-6`} aria-labelledby="artikel-titel">
          <div className="flex items-baseline justify-between">
            <h2 id="artikel-titel" className="text-[20px] leading-[1.2] font-medium">
              Artikel
            </h2>
            <span className="text-[13px]">{itemCountText(order.itemCount)}</span>
          </div>
          <ul className="mt-3">
            {order.items.map((item) => (
              <OrderLineItem key={item.id} item={item} />
            ))}
          </ul>
          <dl className="border-pv-ui-hairline mt-3 flex flex-col gap-3 border-t pt-4">
            <SummaryRow label="Zwischensumme (ohne Pfand)" value={formatEur(order.subtotalCents)} />
            {order.discountCents > 0 ? (
              <SummaryRow
                label={order.discountCode ? `Rabatt (${order.discountCode})` : "Rabatt"}
                value={`−${formatEur(order.discountCents)}`}
              />
            ) : null}
            {order.depositCents > 0 ? (
              <SummaryRow label="Pfand" value={formatEur(order.depositCents)} />
            ) : null}
            <SummaryRow
              label={`Versand${order.shippingName ? ` (${order.shippingName})` : ""}`}
              value={
                order.shippingCents === 0 ? (
                  <Badge tone="butter">kostenlos</Badge>
                ) : (
                  formatEur(order.shippingCents)
                )
              }
            />
          </dl>
          <dl className="border-pv-ui-hairline mt-4 border-t pt-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <dt className="text-[16px] font-bold">Gesamt</dt>
                <dd className="text-[12px] leading-[1.4]">
                  Zahlbetrag inkl. Pfand und MwSt. (darin {taxText})
                </dd>
              </div>
              <dd className="text-[28px] leading-none font-bold whitespace-nowrap">
                {formatEur(order.totalCents)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Adressen und Zahlart */}
        <div className="flex flex-col gap-4">
          <section className={`${CARD_FLAT} p-5`} aria-labelledby="liefer-titel">
            <h2 id="liefer-titel" className="flex items-center gap-2 text-[16px] font-medium">
              <PinIcon className="size-5" />
              Lieferadresse
            </h2>
            <div className="mt-2">
              {order.shippingAddress ? (
                <AddressLines address={order.shippingAddress} />
              ) : (
                <p className="text-[14px]">Keine Angabe</p>
              )}
            </div>
          </section>
          <section className={`${CARD_FLAT} p-5`} aria-labelledby="rechnung-titel">
            <h2 id="rechnung-titel" className="flex items-center gap-2 text-[16px] font-medium">
              <DocIcon className="size-5" />
              Rechnungsadresse
            </h2>
            <div className="mt-2">
              {order.billingAddress ? (
                <AddressLines address={order.billingAddress} />
              ) : order.shippingAddress ? (
                <p className="text-[14px] leading-[1.6]">Wie Lieferadresse</p>
              ) : (
                <p className="text-[14px]">Keine Angabe</p>
              )}
            </div>
          </section>
          <section className={`${CARD_FLAT} p-5`} aria-labelledby="zahlart-titel">
            <h2
              id="zahlart-titel"
              className="flex flex-wrap items-center gap-2 text-[16px] font-medium"
            >
              <CardIcon className="size-5" />
              Zahlart
              <Badge tone={payBadge.tone}>{payBadge.label}</Badge>
            </h2>
            <p className="mt-2 text-[14px] leading-[1.6]">
              {paymentMethodLabel(order.paymentMethodType)}
              {order.paidAt ? (
                <>
                  <br />
                  bezahlt am {formatDate(order.paidAt)}
                </>
              ) : null}
            </p>
          </section>
        </div>
      </div>

      <div className="mt-6 lg:hidden">{actions}</div>
      {order.invoiceAvailable ? null : (
        <p id="rechnung-hinweis" className="mt-3 text-[13px] leading-[1.5]">
          Die Rechnung erstellen wir nach der Zahlung, sie kommt zusätzlich per E-Mail.
        </p>
      )}

      <Notice tone="info" title="Widerrufsfrist: 14 Tage" className="mt-6">
        Du kannst diese Bestellung binnen 14 Tagen ohne Angabe von Gründen widerrufen. Die Frist
        beginnt an dem Tag, an dem du die Ware erhalten hast. Alle Details in der{" "}
        <Link href={"/pages/ruckgabe-und-wiederrufsbelehrung" as Route} className={LINK_PLUM}>
          Widerrufsbelehrung
        </Link>
        .
      </Notice>
    </AccountShell>
  );
}
