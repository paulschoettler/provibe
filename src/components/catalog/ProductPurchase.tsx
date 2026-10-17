"use client";

import { useId, useState, useTransition } from "react";
import { SiteLink } from "@/components/layout/SiteLink";
import { useCart } from "@/components/cart/cart-context";
import { addToCartForm } from "@/lib/cart/actions";
import { MAX_LINE_QUANTITY } from "@/lib/cart/types";
import type { ProductType, VariantView } from "@/lib/catalog/products";
import { formatEur } from "@/lib/money";
import type { SubscriptionOffer } from "@/lib/subscriptions/offer";
import {
  AboPriceBlock,
  PurchaseTypeChoice,
  SubscriptionIntervalPicker,
  SubscriptionNote,
} from "@/components/subscriptions/PurchaseParts";
import { CartLineIcon, CheckIcon, ClockIcon, MinusIcon, PlusIcon } from "./icons";

/**
 * Kaufbereich der Produktseite (Figma Kaufbox 35:10452): Variantenwahl, Preisblock, Menge,
 * "In den Warenkorb".
 *
 * Progressive Enhancement: Der ganze Block ist ein Formular für die Server Action addToCartForm
 * (Radio "variantId", Zahl "quantity"). Ohne JavaScript zeigt jede Packgrößen-Pill ihren eigenen
 * Packpreis ohne Pfand, das Pfand, Preis je Dose und Grundpreis; der Preisblock zeigt die
 * Standardvariante. Pfand steht immer getrennt neben dem Preis (§ 7 PAngV, H22). Mit
 * JavaScript aktualisiert sich der Preisblock bei der Auswahl, und der Button nutzt
 * useCart().addLine (Drawer öffnet sich). Alle Beträge kommen fertig gerechnet vom Server.
 *
 * Abo (Paket Abo, Figma 58:4 / 58:391): Bei Sorten und Mixed wählt "Kaufart" zwischen "Einmal
 * kaufen" (vorgewählt) und "Im Abo sparen" mit Intervall. Das Angebot (Rabatt, Preis je
 * Lieferung, Grundpreis) rechnet der Server beim Rendern (subscription). Ohne JavaScript schickt
 * das Formular purchaseType und intervalWeeks an addToCartForm.
 */
export function ProductPurchase({
  productTitle,
  type,
  variants,
  defaultVariantId,
  optionName,
  bundleCans,
  deliveryTimeText,
  subscription = null,
}: {
  productTitle: string;
  type: ProductType;
  variants: VariantView[];
  defaultVariantId: string;
  optionName: string | null;
  /** Bundles: Anzahl Dosen und Pfand je Dose für die Pfandzeile */
  bundleCans?: { count: number; depositPerCanCents: number } | null;
  deliveryTimeText: string | null;
  /** Abo-Angebot (nur Sorten und Mixed), serverseitig berechnet; null ohne Abo */
  subscription?: SubscriptionOffer | null;
}) {
  const { addLine } = useCart();
  const [selectedId, setSelectedId] = useState(defaultVariantId);
  const [quantity, setQuantity] = useState(1);
  const [purchaseType, setPurchaseType] = useState<"once" | "abo">("once");
  const [intervalWeeks, setIntervalWeeks] = useState(subscription?.defaultInterval ?? 4);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const uid = useId();
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const isDrink = type === "sorte" || type === "mixed";
  const isSize = optionName === "Größe";
  const legend = isSize ? (type === "bundle" ? "Shirt-Größe" : "Größe") : "Packgröße";
  const aboOffer = isDrink && subscription ? (subscription.variants[selected.id] ?? null) : null;
  const isAbo = purchaseType === "abo" && aboOffer !== null;

  return (
    <form
      action={addToCartForm}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await addLine(
            selected.id,
            quantity,
            isAbo ? { subscriptionIntervalWeeks: intervalWeeks } : undefined,
          );
          setMessage(
            result.ok
              ? {
                  ok: true,
                  text: isAbo
                    ? `${productTitle} liegt als Abo im Warenkorb.`
                    : `${productTitle} liegt im Warenkorb.`,
                }
              : { ok: false, text: result.error },
          );
        });
      }}
    >
      <input type="hidden" name="redirectTo" value="/cart/" />

      {variants.length > 1 ? (
        <fieldset>
          <legend className="float-left mb-2.5 text-[16px] leading-6 font-bold">{legend}</legend>
          <p
            className="text-pv-wildberry float-right mb-2.5 text-[14px] leading-6 font-medium"
            aria-live="polite"
          >
            Gewählt: {isSize ? selected.optionValue : selected.title}
          </p>
          <div
            className={
              isSize
                ? "clear-both flex flex-wrap gap-2.5"
                : "clear-both grid grid-cols-3 gap-x-3 gap-y-3 sm:gap-x-3.5"
            }
          >
            {variants.map((v) => {
              const inputId = `${uid}-${v.id}`;
              return (
                <div key={v.id} className="relative">
                  <input
                    id={inputId}
                    type="radio"
                    name="variantId"
                    value={v.id}
                    checked={v.id === selected.id}
                    onChange={() => setSelectedId(v.id)}
                    disabled={!v.available}
                    className="peer sr-only"
                  />
                  {isSize ? (
                    <label htmlFor={inputId} className="pvc-size">
                      <span className="pvc-pack-check" aria-hidden="true">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                      {v.optionValue ?? v.title}
                      {!v.available ? <span className="sr-only"> (ausverkauft)</span> : null}
                    </label>
                  ) : (
                    <label htmlFor={inputId} className="pvc-pack">
                      <span className="pvc-pack-check" aria-hidden="true">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[15px] font-bold">{v.title}</span>
                      <span className="text-[17px] font-bold">{formatEur(v.goodsPriceCents)}</span>
                      {isDrink ? (
                        <>
                          {v.depositCents > 0 ? (
                            <span className="text-[12px]">
                              zzgl. {formatEur(v.depositCents)} Pfand
                            </span>
                          ) : null}
                          <span className="text-pv-wildberry text-[12px]">
                            {formatEur(v.perUnitCents)} je Dose
                          </span>
                          {v.basePriceText ? (
                            <span className="text-[12px]">{v.basePriceText}</span>
                          ) : null}
                        </>
                      ) : null}
                      {!v.available ? (
                        <span className="text-pv-wildberry text-[12px]">ausverkauft</span>
                      ) : null}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="variantId" value={selected.id} />
      )}

      {isDrink && subscription && aboOffer ? (
        <PurchaseTypeChoice
          uid={uid}
          value={purchaseType}
          onChange={setPurchaseType}
          onceGoodsCents={selected.goodsPriceCents}
          onceBasePriceText={selected.basePriceText}
          offer={aboOffer}
        >
          <SubscriptionIntervalPicker
            uid={uid}
            intervals={subscription.intervals}
            defaultInterval={subscription.defaultInterval}
            value={intervalWeeks}
            onChange={setIntervalWeeks}
            today={subscription.today}
          />
        </PurchaseTypeChoice>
      ) : null}

      {isAbo && aboOffer && subscription ? (
        <AboPriceBlock
          offer={aboOffer}
          unitCount={selected.unitCount}
          depositPerUnitCents={selected.depositPerUnitCents}
          shippingPriceCents={subscription.shippingPriceCents}
          freeShippingFromCents={subscription.freeShippingFromCents}
        />
      ) : null}

      {/* Preisblock: Gesamtpreis, Pfand getrennt, Grundpreis (PAngV), MwSt. und Versand */}
      <div className={isAbo ? "hidden" : "flex flex-col gap-1"} aria-live="polite">
        <p className="flex flex-wrap items-end gap-x-3">
          <span className="text-[40px] leading-none font-bold tracking-[-0.01em] lg:text-[44px]">
            {formatEur(selected.goodsPriceCents)}
          </span>
          {isDrink ? (
            <span className="text-pv-wildberry pb-0.5 text-[17px] font-medium">
              für {selected.unitCount} Dosen
            </span>
          ) : null}
        </p>
        {isDrink && selected.depositCents > 0 ? (
          <p className="text-[15px] leading-[1.45] font-medium">
            zzgl. {formatEur(selected.depositCents)} Pfand ({selected.unitCount} ×{" "}
            {formatEur(selected.depositPerUnitCents)})
          </p>
        ) : null}
        {type === "bundle" && selected.depositCents > 0 ? (
          <p className="text-[15px] leading-[1.45] font-medium">
            zzgl. {formatEur(selected.depositCents)} Pfand
            {bundleCans && bundleCans.count > 0
              ? ` (${bundleCans.count} Dosen × ${formatEur(bundleCans.depositPerCanCents)})`
              : ""}
          </p>
        ) : null}
        {type === "bundle" &&
        selected.componentsSumGoodsCents &&
        selected.componentsSumGoodsCents > selected.goodsPriceCents ? (
          <p className="text-pv-wildberry text-[17px] font-medium">
            Einzeln: {formatEur(selected.componentsSumGoodsCents)}
          </p>
        ) : null}
        {isDrink ? (
          <p className="text-[15px] leading-[1.45]">
            entspricht {formatEur(selected.perUnitCents)} je Dose zzgl. Pfand
          </p>
        ) : null}
        {selected.basePriceText ? (
          <p className="text-[15px] leading-[1.45] font-medium">
            Grundpreis {selected.basePriceText} (ohne Pfand)
          </p>
        ) : null}
        <p className="text-[15px] leading-[1.45]">
          inkl. MwSt., zzgl.{" "}
          <SiteLink href="/pages/versand" className="underline underline-offset-2">
            Versandkosten
          </SiteLink>
        </p>
        {type === "bundle" && deliveryTimeText ? (
          <p className="mt-1 flex items-center gap-2 text-[15px] font-bold">
            <ClockIcon className="text-pv-wildberry h-5 w-5" />
            Lieferzeit {deliveryTimeText}
          </p>
        ) : null}
      </div>

      {/* Menge und Warenkorb */}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-menge`} className="text-[16px] font-bold">
          Menge
        </label>
        <div className="flex items-center gap-3">
          <div className="pvc-stepper shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Menge verringern"
              aria-controls={`${uid}-menge`}
            >
              <MinusIcon />
            </button>
            <input
              id={`${uid}-menge`}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LINE_QUANTITY}
              value={quantity}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setQuantity(Number.isFinite(n) ? Math.min(MAX_LINE_QUANTITY, Math.max(1, n)) : 1);
              }}
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
              disabled={quantity >= MAX_LINE_QUANTITY}
              aria-label="Menge erhöhen"
              aria-controls={`${uid}-menge`}
            >
              <PlusIcon />
            </button>
          </div>
          <button
            type="submit"
            className="btn-primary min-w-0 flex-1 px-4"
            disabled={isPending || !selected.available}
            aria-busy={isPending || undefined}
            aria-describedby={message && !message.ok ? `${uid}-meldung` : undefined}
          >
            <CartLineIcon className="h-[18px] w-[18px] shrink-0" />
            {!selected.available ? "Ausverkauft" : isAbo ? "Abo starten" : "In den Warenkorb"}
          </button>
        </div>
        {isAbo ? <SubscriptionNote /> : null}
        {message ? (
          <p
            id={`${uid}-meldung`}
            role={message.ok ? "status" : "alert"}
            className={
              message.ok
                ? "text-pv-wildberry text-[14px] font-bold"
                : "border-pv-wildberry text-pv-wildberry bg-pv-white rounded-[14px] border-[1.5px] px-3 py-2 text-[14px]"
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default ProductPurchase;
