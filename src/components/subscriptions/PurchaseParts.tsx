import type { ReactNode } from "react";
import { SiteLink } from "@/components/layout/SiteLink";
import { formatEur } from "@/lib/money";
import type { SubscriptionVariantOffer } from "@/lib/subscriptions/offer";

/**
 * Bausteine der Kaufart in der Kaufbox (Figma 58:4 mobil, 58:391 Desktop, Standard 58:350).
 * Ohne eigene Hooks: Zustand hält ProductPurchase. Ohne JavaScript funktionieren die Radios als
 * normales Formular, das Intervall klappt per CSS (:has) auf. Preise ohne Pfand als Hauptpreis,
 * Pfand getrennt (H22), Grundpreis ohne Pfand (PAngV).
 */

function percent(bp: number): string {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

/** "YYYY-MM-DD" plus Wochen als "14.11.2026", deterministisch (kein Date.now, keine Zeitzone). */
export function addWeeksToDay(day: string, weeks: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + weeks * 7, 12));
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

export function PurchaseTypeChoice({
  uid,
  value,
  onChange,
  onceGoodsCents,
  onceBasePriceText,
  offer,
  children,
}: {
  uid: string;
  value: "once" | "abo";
  onChange: (value: "once" | "abo") => void;
  onceGoodsCents: number;
  onceBasePriceText: string | null;
  offer: SubscriptionVariantOffer;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="float-left mb-2.5 text-[16px] leading-6 font-bold">Kaufart</legend>
      <p
        className="text-pv-wildberry float-right mb-2.5 text-[14px] leading-6 font-medium"
        aria-live="polite"
      >
        Gewählt: {value === "abo" ? "Abo" : "Einmal kaufen"}
      </p>
      <div className="clear-both flex flex-col gap-3">
        <label className="pv-abo-choice">
          <input
            type="radio"
            name="purchaseType"
            value="once"
            checked={value === "once"}
            onChange={() => onChange("once")}
            className="co-radio"
            id={`${uid}-einmal`}
          />
          <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
            <span className="text-[16px] font-bold">Einmal kaufen</span>
            <span className="text-pv-wildberry text-[13px]">Einmalige Lieferung, kein Vertrag</span>
          </span>
          <span className="flex shrink-0 flex-col items-end leading-[1.35]">
            <span className="text-[16px] font-bold">{formatEur(onceGoodsCents)}</span>
            {onceBasePriceText ? (
              <span className="text-pv-wildberry text-[12px]">{onceBasePriceText}</span>
            ) : null}
          </span>
        </label>

        <div className="pv-abo-choice pv-abo-choice--abo">
          <label className="flex w-full items-center gap-3.5" htmlFor={`${uid}-abo`}>
            <input
              type="radio"
              name="purchaseType"
              value="abo"
              checked={value === "abo"}
              onChange={() => onChange("abo")}
              className="co-radio"
              id={`${uid}-abo`}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-[1.35]">
              <span className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
                Im Abo sparen
                <span className="pv-abo-badge">{percent(offer.discountBp)} sparen</span>
              </span>
              <span className="text-pv-wildberry text-[13px]">
                Lieferung im Rhythmus deiner Wahl
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end leading-[1.35]">
              <span className="text-pv-wildberry text-[16px] font-bold">
                {formatEur(offer.goodsCents)}
              </span>
              <span className="text-pv-wildberry text-[12px]">{offer.basePriceText}</span>
            </span>
          </label>
          <div className="pv-abo-panel">{children}</div>
        </div>
      </div>
    </fieldset>
  );
}

export function SubscriptionIntervalPicker({
  uid,
  intervals,
  defaultInterval,
  value,
  onChange,
  today,
}: {
  uid: string;
  intervals: number[];
  defaultInterval: number;
  value: number;
  onChange: (weeks: number) => void;
  today: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <fieldset>
        <legend className="mb-2 text-[14px] font-bold">Liefern alle</legend>
        <div className="grid grid-cols-4 gap-2">
          {intervals.map((weeks) => (
            <div key={weeks}>
              <input
                id={`${uid}-iv-${weeks}`}
                type="radio"
                name="intervalWeeks"
                value={weeks}
                checked={value === weeks}
                onChange={() => onChange(weeks)}
                className="peer sr-only"
              />
              <label htmlFor={`${uid}-iv-${weeks}`} className="pv-abo-interval">
                {weeks} Wochen
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <p className="text-pv-wildberry text-[13px] leading-[1.45]">
        Standard: alle {defaultInterval} Wochen. Erste Lieferung jetzt, die nächste am{" "}
        <span aria-live="polite">{addWeeksToDay(today, value)}</span>.
      </p>
      <p className="pv-abo-flex">
        <svg viewBox="0 0 24 24" className="text-pv-wildberry size-4 shrink-0" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Jederzeit pausieren oder kündigen
      </p>
    </div>
  );
}

export function AboPriceBlock({
  offer,
  unitCount,
  depositPerUnitCents,
  shippingPriceCents,
  freeShippingFromCents,
}: {
  offer: SubscriptionVariantOffer;
  unitCount: number;
  depositPerUnitCents: number;
  shippingPriceCents: number | null;
  freeShippingFromCents: number | null;
}) {
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className="flex flex-wrap items-end gap-x-3">
        <span className="text-[40px] leading-none font-bold tracking-[-0.01em] lg:text-[44px]">
          {formatEur(offer.goodsCents)}
        </span>
        <span className="text-pv-wildberry pb-0.5 text-[17px] font-medium">
          je Lieferung · {unitCount} Dosen
        </span>
      </p>
      {offer.depositCents > 0 ? (
        <p className="text-[15px] leading-[1.45] font-medium">
          zzgl. {formatEur(offer.depositCents)} Pfand ({unitCount} ×{" "}
          {formatEur(depositPerUnitCents)})
        </p>
      ) : null}
      <p className="text-[15px] leading-[1.45]">
        statt {formatEur(offer.listGoodsCents)} beim Einmalkauf, du sparst{" "}
        {formatEur(offer.savingsCents)} je Lieferung
      </p>
      <p className="text-[15px] leading-[1.45] font-medium">
        Grundpreis {offer.basePriceText} (ohne Pfand)
      </p>
      <p className="text-[15px] leading-[1.45]">
        inkl. MwSt., zzgl.{" "}
        <SiteLink href="/pages/versand" className="underline underline-offset-2">
          {shippingPriceCents !== null
            ? `${formatEur(shippingPriceCents)} Versand`
            : "Versandkosten"}
        </SiteLink>
        {freeShippingFromCents !== null
          ? ` (ab ${formatEur(freeShippingFromCents)} versandkostenfrei)`
          : ""}
      </p>
    </div>
  );
}

export function SubscriptionNote() {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-[1.45]">
      <svg
        viewBox="0 0 24 24"
        className="text-pv-wildberry mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      >
        <path
          d="M4 9h13l-3-3M20 15H7l3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        Für das Abo legen wir beim Bezahlen dein Kundenkonto an (Magic Link, ohne Passwort).
        Abo-Bedingungen in den{" "}
        <SiteLink
          href="/pages/allgemeine-geschaftsbedingungen"
          className="underline underline-offset-2"
        >
          AGB
        </SiteLink>
        .
      </span>
    </p>
  );
}
