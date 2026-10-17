import Image from "next/image";
import { formatEur } from "@/lib/money";
import { lineAmounts } from "@/lib/checkout/order-view";
import { depositLabel, subscriptionSavingsCents } from "@/lib/checkout/snapshot";
import type { AmountsSnapshot, SnapshotLine } from "@/lib/checkout/types";
import { AlertIcon, BagIcon, CheckIcon, ChevronDownIcon, InfoIcon } from "./icons";

/**
 * Darstellungsbausteine der Kasse ohne Hooks (Server- und Client-tauglich): Fortschritt,
 * Titel, Bestellposition, Zusammenfassung, Hinweisboxen. Figma-Bausteine 26:1003 ff.
 */

export function CheckoutProgress({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2.5" aria-label="Fortschritt der Bestellung">
      <li className="flex items-center gap-2" aria-current={step === 1 ? "step" : undefined}>
        <span className="bg-magenta border-magenta flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] text-[14px] leading-none font-bold text-white">
          {step === 2 ? <CheckIcon className="h-4 w-4" /> : "1"}
        </span>
        <span className={`text-[15px] ${step === 1 ? "font-semibold" : ""}`}>
          Adresse{step === 2 ? <span className="sr-only"> (erledigt)</span> : null}
        </span>
      </li>
      <li
        aria-hidden="true"
        className={`h-0.5 w-10 ${step === 2 ? "bg-magenta" : "bg-aubergine/30"}`}
      />
      <li className="flex items-center gap-2" aria-current={step === 2 ? "step" : undefined}>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] text-[14px] leading-none font-bold ${
            step === 2 ? "bg-magenta border-magenta text-white" : "bg-cream border-aubergine/40"
          }`}
        >
          2
        </span>
        <span className={`text-[15px] ${step === 2 ? "font-semibold" : ""}`}>Zahlung</span>
      </li>
    </ol>
  );
}

export function CheckoutTitle({ title, eyebrow = "Kasse" }: { title: string; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="co-eyebrow">{eyebrow}</p>
      <h1 className="text-wine text-[40px] leading-[1.08] font-semibold tracking-[-0.01em] lg:text-[56px] lg:leading-[1.05]">
        {title}
      </h1>
    </div>
  );
}

/**
 * Bestellposition: Zeilenpreis ohne Pfand (Menge × Preis), das Pfand getrennt daneben
 * (§ 7 PAngV, Entscheidung H22). Erst "Gesamt" rechnet das Pfand in den Zahlbetrag ein.
 */
export function OrderLine({ line }: { line: SnapshotLine }) {
  const isBundle = line.components !== null;
  const { goodsCents, depositCents } = lineAmounts(line);
  return (
    <li className="flex items-center gap-3">
      <div className="bg-pink-light flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]">
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productTitle}
            width={56}
            height={56}
            className={`h-14 w-14 ${isBundle ? "rounded-[10px] object-cover" : "object-contain"}`}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 leading-[1.4]">
        <p className="text-[15px] font-semibold">
          {line.productTitle}
          {line.subscription ? " im Abo" : ""}
        </p>
        <p className="text-[13px]">{line.description}</p>
        <p className="text-[13px]">
          Menge {line.quantity}
          {depositCents > 0 ? ` · zzgl. ${formatEur(depositCents)} Pfand` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right leading-[1.4] whitespace-nowrap">
        <p className="text-[15px] font-semibold">{formatEur(goodsCents)}</p>
        {line.basePriceText && !line.basePriceText.endsWith("Stück") ? (
          <p className="text-[12px]">
            <span className="sr-only">Grundpreis </span>
            {line.basePriceText.replace(" / ", "/")}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-[15px] leading-[1.4]">
      <dt className="min-w-0 flex-1">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap">{children}</dd>
    </div>
  );
}

export function FreePill({ children = "kostenlos" }: { children?: React.ReactNode }) {
  return (
    <span className="bg-butter border-aubergine inline-flex rounded-full border-[1.5px] px-2.5 py-0.5 text-[13px] leading-[1.4] font-semibold">
      {children}
    </span>
  );
}

/**
 * Bestellübersicht mit allen Angaben nach § 312j BGB: Produkte, Mengen, Preise ohne Pfand, Pfand
 * als eigene Zeile, Versand, Lieferzeit, Gesamt (Zahlbetrag inklusive Pfand und ausgewiesener MwSt.).
 */
export function OrderSummary({
  snapshot,
  title,
  showDelivery = false,
  headingLevel = "h2",
  children,
}: {
  snapshot: AmountsSnapshot;
  title?: string;
  showDelivery?: boolean;
  headingLevel?: "h2" | "h3";
  children?: React.ReactNode;
}) {
  const Heading = headingLevel;
  // Abo-Positionen (Paket Abo): Rabatt als eigene Zeile zeigen, die Summen bleiben unverändert
  const aboSavings = subscriptionSavingsCents(snapshot);
  const aboRates = new Set(
    snapshot.lines.flatMap((l) => (l.subscription ? [l.subscription.discountBp] : [])),
  );
  const aboPercent =
    aboRates.size === 1
      ? `${([...aboRates][0] / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`
      : "";
  const shippingLabel = `Versand${snapshot.shipping ? ` (${snapshot.shipping.name})` : ""}`;
  const taxText = snapshot.taxLines
    .map(
      (t) =>
        `${formatEur(t.taxCents)} MwSt.${snapshot.taxLines.length > 1 ? ` (${t.rateBp / 100} %)` : ""}`,
    )
    .join(", ");
  return (
    <div className="flex flex-col gap-3.5">
      {title ? (
        <div className="flex items-center justify-between leading-[1.4]">
          <Heading className="text-[20px] font-semibold">{title}</Heading>
          <p className="text-[14px]">
            {snapshot.itemCount} {snapshot.itemCount === 1 ? "Artikel" : "Artikel"}
          </p>
        </div>
      ) : null}
      <ul className="flex flex-col gap-3.5" aria-label="Artikel">
        {snapshot.lines.map((line) => (
          <OrderLine
            key={`${line.variantId}:${line.subscription ? "abo" : "einmal"}`}
            line={line}
          />
        ))}
      </ul>
      <hr className="border-aubergine/20" />
      <dl className="flex flex-col gap-2">
        {aboSavings > 0 ? (
          <>
            <Row label="Warenwert (ohne Pfand)">
              {formatEur(snapshot.subtotalCents + aboSavings)}
            </Row>
            <Row label={`Abo-Rabatt${aboPercent ? ` ${aboPercent}` : ""} (nur auf den Warenwert)`}>
              <span className="text-plum font-semibold">−{formatEur(aboSavings)}</span>
            </Row>
          </>
        ) : (
          <Row label="Zwischensumme (ohne Pfand)">{formatEur(snapshot.subtotalCents)}</Row>
        )}
        {snapshot.discountCents > 0 ? (
          <Row label={`Rabatt${snapshot.discountCode ? ` (${snapshot.discountCode})` : ""}`}>
            <span className="text-plum font-semibold">−{formatEur(snapshot.discountCents)}</span>
          </Row>
        ) : null}
        {snapshot.depositCents > 0 ? (
          <Row label={depositLabel(snapshot)}>{formatEur(snapshot.depositCents)}</Row>
        ) : null}
        <Row label={shippingLabel}>
          {snapshot.shipping === null ? (
            "wird berechnet"
          ) : snapshot.shippingFree ? (
            <FreePill />
          ) : (
            formatEur(snapshot.shippingCents)
          )}
        </Row>
        {showDelivery ? (
          <Row label="Lieferzeit">{snapshot.shipping?.deliveryTimeText ?? "3 bis 5 Werktage"}</Row>
        ) : null}
      </dl>
      <hr className="border-aubergine/20" />
      <div className="flex items-end justify-between py-1">
        <div className="leading-[1.4]">
          <p className="text-[18px] font-semibold">Gesamt</p>
          <p className="text-[13px]">
            Zahlbetrag inkl. Pfand und MwSt. (darin{" "}
            {taxText || `${formatEur(snapshot.taxCents)} MwSt.`})
          </p>
        </div>
        <p className="text-[24px] leading-[1.2] font-bold">{formatEur(snapshot.totalCents)}</p>
      </div>
      {children}
    </div>
  );
}

/** Mobil eingeklappte Bestellübersicht (Figma 26:3914 und 26:4087), ohne JS über details. */
export function MobileSummary({
  snapshot,
  children,
}: {
  snapshot: AmountsSnapshot;
  children?: React.ReactNode;
}) {
  return (
    <details className="co-mobile-summary bg-pink-light lg:hidden">
      <summary className="flex h-14 cursor-pointer list-none items-center gap-2 px-4">
        <BagIcon className="h-5 w-5" />
        <span className="text-plum text-[15px] font-semibold underline underline-offset-4">
          <span className="co-when-closed">Bestellübersicht anzeigen</span>
          <span className="co-when-open">Bestellübersicht ausblenden</span>
        </span>
        <ChevronDownIcon className="co-summary-chevron h-[18px] w-[18px]" />
        <span className="ml-auto text-[18px] font-bold">{formatEur(snapshot.totalCents)}</span>
      </summary>
      <div className="px-4 pt-2 pb-6">
        <OrderSummary snapshot={snapshot} headingLevel="h2">
          {children}
        </OrderSummary>
      </div>
    </details>
  );
}

/** Hinweisbox (Figma 26:1311): Info in Butter, Fehler mit Magenta-Rahmen und Berry-Text (H9). */
export function Notice({
  tone = "info",
  title,
  children,
  id,
}: {
  tone?: "info" | "error";
  title: string;
  children?: React.ReactNode;
  id?: string;
}) {
  const isError = tone === "error";
  return (
    <div
      id={id}
      role={isError ? "alert" : undefined}
      className={`flex items-start gap-3 rounded-[18px] p-4 ${
        isError
          ? "border-magenta bg-pink-light/60 text-berry border-2"
          : "bg-butter border-aubergine border-[1.5px]"
      }`}
    >
      {isError ? <AlertIcon className="mt-0.5 h-6 w-6" /> : <InfoIcon className="mt-0.5 h-6 w-6" />}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[1.4] font-semibold">{title}</p>
        {children ? <div className="text-[14px] leading-[1.45]">{children}</div> : null}
      </div>
    </div>
  );
}

export function PaymentBadges() {
  return (
    <div>
      <p className="text-[13px]">Sicher bezahlen mit</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {["Karte", "Apple Pay", "Google Pay", "PayPal", "Klarna"].map((m) => (
          <li
            key={m}
            className="border-aubergine/40 rounded-full border bg-white/60 px-2.5 py-1 text-[12px] font-semibold"
          >
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
