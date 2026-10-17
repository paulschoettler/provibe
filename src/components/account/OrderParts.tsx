import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type {
  AddressView,
  OrderDetail,
  OrderItemView,
  OrderSummary,
} from "@/lib/auth/account-data";
import {
  formatDate,
  isClosedWithoutDelivery,
  orderSteps,
  statusBadge,
  statusSentence,
} from "@/lib/auth/order-status";
import { ADDRESS_COUNTRIES } from "@/lib/auth/validation";
import { formatEur } from "@/lib/money";
import { ChevronRightIcon, ExternalIcon, TruckIcon } from "./icons";
import { StatusStepper } from "./StatusStepper";
import { BTN_OUTLINE, Badge, CARD, LINK_PLUM } from "./ui";

export function orderHref(number: string): Route {
  return `/account/bestellungen/${encodeURIComponent(number)}` as Route;
}

export function itemCountText(n: number): string {
  return `${n} ${n === 1 ? "Artikel" : "Artikel"}`;
}

/** Kleine Produktbilder (Figma: 52 px, Rosa-Fläche, Radius 12) */
export function OrderThumbs({ thumbs }: { thumbs: OrderSummary["thumbs"] }) {
  if (thumbs.length === 0) return null;
  return (
    <ul className="flex gap-2" aria-label="Artikel">
      {thumbs.map((t, i) => (
        <li
          key={`${t.src}-${i}`}
          className="bg-pink-light relative size-[52px] overflow-hidden rounded-[12px]"
        >
          <Image src={t.src} alt={t.alt} fill sizes="52px" className="object-contain p-1" />
        </li>
      ))}
    </ul>
  );
}

/** Karte "Deine letzte Bestellung" (Figma 35:9796) */
export function LastOrderCard({
  order,
}: {
  order: OrderSummary & Partial<Pick<OrderDetail, "shipments">>;
}) {
  const badge = statusBadge(order);
  const tracking = order.shipments?.find((s) => s.trackingUrl);
  const closed = isClosedWithoutDelivery(order);
  return (
    <article
      className={`${CARD} flex flex-col gap-5 p-5 sm:p-6`}
      aria-labelledby={`bestellung-${order.id}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] leading-[1.4]">Letzte Bestellung</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`bestellung-${order.id}`} className="text-[24px] leading-[1.15] font-semibold">
              {order.number}
            </h3>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <p className="text-[14px] leading-[1.4]">
            vom {formatDate(order.placedAt)} · {itemCountText(order.itemCount)} ·{" "}
            {formatEur(order.totalCents)}
          </p>
        </div>
        <OrderThumbs thumbs={order.thumbs} />
      </div>

      {closed ? null : <StatusStepper steps={orderSteps(order)} className="sm:px-6" />}

      <p className="bg-cream flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[14px] leading-[1.45]">
        <TruckIcon className="mt-px size-5" />
        <span>{statusSentence(order)}</span>
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {tracking?.trackingUrl ? (
          <a
            href={tracking.trackingUrl}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sendung verfolgen
            <ExternalIcon className="size-[18px]" />
            <span className="sr-only">(öffnet die DHL-Seite in einem neuen Tab)</span>
          </a>
        ) : null}
        <Link
          href={orderHref(order.number)}
          className={`${LINK_PLUM} inline-flex min-h-11 items-center gap-1 text-[14px]`}
        >
          Details ansehen
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
    </article>
  );
}

/** Zeile in der Bestellliste */
export function OrderRow({ order }: { order: OrderSummary }) {
  const badge = statusBadge(order);
  return (
    <li>
      <Link
        href={orderHref(order.number)}
        className={`${CARD} hover:bg-cream-3 flex items-center gap-4 p-4 transition-colors sm:p-5`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] leading-[1.2] font-semibold">{order.number}</span>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          <span className="text-[14px] leading-[1.4]">
            vom {formatDate(order.placedAt)} · {itemCountText(order.itemCount)} ·{" "}
            {formatEur(order.totalCents)}
          </span>
        </div>
        <div className="hidden sm:block">
          <OrderThumbs thumbs={order.thumbs} />
        </div>
        <ChevronRightIcon className="text-plum size-5" />
        <span className="sr-only">Details zur Bestellung {order.number}</span>
      </Link>
    </li>
  );
}

/** Bestellposition (Figma 26:1330) */
export function OrderLineItem({ item }: { item: OrderItemView }) {
  const depositText =
    item.unitDepositCents > 0
      ? ` · inkl. ${formatEur(item.unitDepositCents * item.quantity)} Pfand`
      : "";
  return (
    <li className="flex items-start gap-3 py-2">
      <div className="bg-pink-light relative size-[52px] shrink-0 overflow-hidden rounded-[12px]">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="52px"
            className="object-contain p-1"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[15px] leading-[1.35] font-semibold">{item.title}</p>
        {item.variantTitle ? (
          <p className="text-[13px] leading-[1.4]">{item.variantTitle}</p>
        ) : null}
        <p className="text-[13px] leading-[1.4]">
          Menge {item.quantity}
          {depositText}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <p className="text-[15px] leading-[1.35] font-semibold whitespace-nowrap">
          {formatEur(item.lineTotalCents)}
        </p>
        {item.basePriceText ? (
          <p className="text-[12px] leading-[1.4] whitespace-nowrap">{item.basePriceText}</p>
        ) : null}
      </div>
    </li>
  );
}

/** Zusammenfassungszeile (Figma 26:1329) */
export function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${strong ? "text-[16px] font-semibold" : "text-[15px]"}`}
    >
      <dt>{label}</dt>
      <dd className="text-right whitespace-nowrap">{value}</dd>
    </div>
  );
}

export function AddressLines({ address }: { address: AddressView }) {
  const country =
    ADDRESS_COUNTRIES[address.countryCode as keyof typeof ADDRESS_COUNTRIES] ?? address.countryCode;
  return (
    <address className="text-[14px] leading-[1.6] not-italic">
      {[address.firstName, address.lastName].filter(Boolean).join(" ")}
      <br />
      {address.company ? (
        <>
          {address.company}
          <br />
        </>
      ) : null}
      {[address.street, address.houseNumber].filter(Boolean).join(" ")}
      <br />
      {address.addressAddition ? (
        <>
          {address.addressAddition}
          <br />
        </>
      ) : null}
      {address.postalCode} {address.city}
      <br />
      {country}
    </address>
  );
}
