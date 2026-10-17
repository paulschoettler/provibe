import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BTN_OUTLINE, CARD, LINK_PLUM } from "@/components/account/ui";
import { formatEur } from "@/lib/money";
import type { SubscriptionCardView } from "@/lib/subscriptions/data";
import { formatDay } from "@/lib/subscriptions/schedule";
import { SUBSCRIPTION_STATUS_LABEL, type SubscriptionStatus } from "@/lib/subscriptions/types";

/**
 * Darstellungsbausteine des Abo-Portals (Figma 62:451 / 62:666 Übersicht, 66:627 / 66:1168
 * Detail, 66:893 / 66:1461 Zahlung fehlgeschlagen). Ohne Hooks, Server-tauglich.
 */

export const ABO_BG_BY_HANDLE: Record<string, string> = {
  wildberry: "bg-pv-cream",
  "raspberry-lime": "bg-pv-cream",
  peach: "bg-pv-peach",
};

export function StatusBadge({ status, label }: { status: SubscriptionStatus; label?: string }) {
  const tone =
    status === "active"
      ? "border-pv-wildberry bg-pv-cream text-pv-wildberry"
      : status === "past_due"
        ? "border-pv-wildberry bg-pv-wildberry text-pv-white"
        : status === "paused"
          ? "border-pv-wildberry bg-pv-cream text-pv-wildberry"
          : "border-pv-wildberry bg-pv-cream text-pv-wildberry";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-px text-[12px] leading-[1.5] font-bold whitespace-nowrap ${tone}`}
    >
      <span
        className={`size-1.5 rounded-full ${status === "past_due" ? "bg-pv-white" : status === "active" ? "bg-pv-wildberry" : "bg-pv-ui-gray-500"}`}
        aria-hidden="true"
      />
      {label ?? SUBSCRIPTION_STATUS_LABEL[status]}
    </span>
  );
}

export function CanImage({
  src,
  alt,
  handle,
  size = "md",
}: {
  src: string | null;
  alt: string;
  handle: string;
  size?: "sm" | "md";
}) {
  const box =
    size === "sm" ? "size-16 rounded-[14px]" : "size-[84px] rounded-[18px] lg:size-[106px]";
  return (
    <div
      className={`${ABO_BG_BY_HANDLE[handle] ?? "bg-pv-cream"} flex shrink-0 items-center justify-center overflow-hidden ${box}`}
    >
      {src ? (
        <Image
          style={{ width: "auto" }}
          src={src}
          alt={alt}
          width={80}
          height={120}
          className={
            size === "sm"
              ? "h-14 w-auto object-contain"
              : "h-[76px] w-auto object-contain lg:h-[96px]"
          }
        />
      ) : (
        <span className="flex items-end" role="img" aria-label={alt}>
          {["wildberry", "raspberry-lime", "peach"].map((h, i) => (
            <Image
              style={{ width: "auto" }}
              key={h}
              src={`/images/cans/${h}.webp`}
              alt=""
              width={40}
              height={64}
              className={`${size === "sm" ? "h-11" : "h-[60px] lg:h-[76px]"} w-auto object-contain ${i > 0 ? "-ml-3" : ""}`}
            />
          ))}
        </span>
      )}
    </div>
  );
}

function deliveryLine(card: SubscriptionCardView): {
  label: string;
  value: string;
  alert: boolean;
} {
  if (card.status === "past_due") {
    return {
      label: "Zahlung offen seit",
      value: card.pastDueSince ? formatDay(card.pastDueSince) : "",
      alert: true,
    };
  }
  if (card.status === "paused") {
    return card.pauseReason === "payment_failed"
      ? { label: "Pausiert", value: "Zahlung offen", alert: true }
      : {
          label: "Pausiert bis",
          value: card.pausedUntil ? formatDay(card.pausedUntil) : "",
          alert: false,
        };
  }
  if (card.status === "cancelled") {
    return {
      label: "Gekündigt zum",
      value: card.cancelEffectiveAt ? formatDay(card.cancelEffectiveAt) : "",
      alert: false,
    };
  }
  return {
    label: "Nächste Lieferung",
    value: card.nextDelivery ? formatDay(card.nextDelivery) : "",
    alert: false,
  };
}

export function packLabel(
  card: Pick<SubscriptionCardView, "variantTitle" | "quantity" | "intervalWeeks">,
): string {
  const pack = card.quantity > 1 ? `${card.quantity} × ${card.variantTitle}` : card.variantTitle;
  return `${pack} · alle ${card.intervalWeeks} Wochen`;
}

export function priceNote(
  card: Pick<SubscriptionCardView, "depositCents" | "shippingCents">,
): string {
  return card.shippingCents > 0
    ? `je Lieferung inkl. ${formatEur(card.depositCents)} Pfand und ${formatEur(card.shippingCents)} Versand`
    : `je Lieferung inkl. ${formatEur(card.depositCents)} Pfand, versandkostenfrei`;
}

/** Karte in der Übersicht /account/abo (Figma 62:666). */
export function SubscriptionListCard({ card }: { card: SubscriptionCardView }) {
  const line = deliveryLine(card);
  const detail = `/account/abo/${card.id}` as Route;
  const paymentOpen =
    card.status === "past_due" ||
    (card.status === "paused" && card.pauseReason === "payment_failed");
  return (
    <article
      className={`${CARD} grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-4 lg:grid-cols-[auto_1.3fr_0.8fr_1fr_auto] lg:gap-x-6 lg:p-5`}
    >
      <CanImage src={card.imageUrl} alt={card.productTitle} handle={card.productHandle} />
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-2 text-[20px] leading-[1.2] font-medium lg:text-[22px]">
          <Link href={detail} className="hover:underline">
            {card.productTitle}
          </Link>
          <StatusBadge status={card.status} />
        </h2>
        <p className="mt-1 text-[14px]">{packLabel(card)}</p>
        <p className="text-pv-wildberry text-[12px]">{card.number}</p>
      </div>
      <div className="col-span-2 flex justify-between gap-4 lg:col-span-1 lg:block">
        <p className="text-pv-wildberry text-[13px]">{line.label}</p>
        <p className={`text-[17px] font-bold ${line.alert ? "text-pv-wildberry" : ""}`}>
          {line.value}
          {card.skipNext && card.status === "active" ? (
            <span className="text-pv-wildberry block text-[12px] font-normal">
              eine Lieferung übersprungen
            </span>
          ) : null}
        </p>
      </div>
      <div className="col-span-2 flex items-baseline justify-between gap-4 lg:col-span-1 lg:block">
        <p className="text-[17px] font-bold">{formatEur(card.totalCents)}</p>
        <p className="text-pv-wildberry text-right text-[12px] leading-[1.35] lg:text-left">
          {priceNote(card)}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 lg:col-span-1 lg:flex-col lg:items-end">
        {paymentOpen ? (
          <Link href={`${detail}?dialog=zahlungsmittel` as Route} className="btn-primary">
            Zahlung aktualisieren
          </Link>
        ) : (
          <Link href={detail} className={BTN_OUTLINE}>
            {card.status === "cancelled" ? "Ansehen" : "Verwalten"}
          </Link>
        )}
        {card.status === "active" && !card.skipNext ? (
          <Link
            href={`${detail}?dialog=ueberspringen` as Route}
            className={`${LINK_PLUM} text-[14px]`}
          >
            Nächste überspringen
          </Link>
        ) : card.status === "paused" && card.pauseReason !== "payment_failed" ? (
          <Link
            href={`${detail}?dialog=fortsetzen` as Route}
            className={`${LINK_PLUM} text-[14px]`}
          >
            Jetzt fortsetzen
          </Link>
        ) : paymentOpen ? (
          <Link href={detail} className={`${LINK_PLUM} text-[14px]`}>
            Details
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function SectionCard({
  title,
  action,
  children,
  id,
  tone = "default",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  tone?: "default" | "outline";
}) {
  const headingId = id ? `${id}-titel` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={
        tone === "outline"
          ? "rounded-card border-pv-wildberry flex flex-col gap-3 border-[1.5px] p-5"
          : `${CARD} flex flex-col gap-3 p-5`
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-[20px] leading-[1.2] font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
