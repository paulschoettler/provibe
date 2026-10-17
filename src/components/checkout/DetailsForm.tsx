"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";
import { saveDetailsAction } from "@/lib/checkout/actions";
import { INITIAL_FORM_STATE } from "@/lib/checkout/types";
import { Checkbox, Field } from "./fields";
import { AlertIcon, LockIcon, TruckIcon } from "./icons";

export interface ShippingOption {
  id: string;
  name: string;
  deliveryText: string;
  listPriceText: string;
  /** Preis für den aktuellen Warenkorb: "kostenlos" oder Betrag */
  priceText: string;
  freeAboveText: string | null;
}

/**
 * Schritt 1: Kontakt, Lieferadresse, optionale Rechnungsadresse, Versandart (Figma 26:3899,
 * 26:4184). Ohne JavaScript ein normales Formular mit Redirect auf Schritt 2, mit JavaScript
 * bleiben Eingaben und Fehlermeldungen ohne Neuladen stehen. Die Rechnungsadresse klappt per
 * CSS (:has) auf, auch ohne JavaScript.
 */
export function DetailsForm({
  defaults,
  shippingOptions,
  selectedRateId,
  discountSlot,
}: {
  defaults: Record<string, string>;
  shippingOptions: ShippingOption[];
  selectedRateId: string | null;
  discountSlot?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveDetailsAction, INITIAL_FORM_STATE);
  const v = state.values ?? defaults;
  const e = state.fieldErrors ?? {};
  const billingChecked = (state.values?.billingDifferent ?? defaults.billingDifferent) === "on";
  const rateId = v.shippingRateId || selectedRateId || shippingOptions[0]?.id;

  return (
    <>
      <form id="checkout-details" action={action} noValidate className="flex flex-col gap-7">
        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="border-magenta bg-pink-light/60 text-berry flex items-center gap-2 rounded-[18px] border-2 px-4 py-3 text-[15px] font-semibold"
          >
            <AlertIcon className="h-5 w-5" />
            {state.message}
          </p>
        ) : null}

        <section className="flex flex-col gap-3" aria-labelledby="h-kontakt">
          <div className="flex items-center justify-between">
            <h2 id="h-kontakt" className="text-[20px] leading-[1.2] font-semibold">
              Kontakt
            </h2>
            <Link
              href={"/account/login?next=/checkout" as Route}
              className="text-plum flex h-11 items-center text-[14px] font-semibold underline underline-offset-4"
            >
              Schon ein Konto? Anmelden
            </Link>
          </div>
          <Field
            name="email"
            type="email"
            label="E-Mail"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={v.email}
            hint="Für Bestellbestätigung"
            error={e.email}
          />
        </section>

        <fieldset className="flex flex-col gap-3.5">
          <legend className="mb-3.5 text-[20px] leading-[1.2] font-semibold">Lieferadresse</legend>
          <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-3">
            <Field
              name="firstName"
              label="Vorname"
              autoComplete="shipping given-name"
              required
              defaultValue={v.firstName}
              error={e.firstName}
            />
            <Field
              name="lastName"
              label="Nachname"
              autoComplete="shipping family-name"
              required
              defaultValue={v.lastName}
              error={e.lastName}
            />
          </div>
          <Field
            name="street"
            label="Straße und Hausnummer"
            autoComplete="shipping street-address"
            required
            defaultValue={v.street}
            error={e.street}
          />
          <Field
            name="addressAddition"
            label="Adresszusatz"
            optional
            placeholder="z. B. Hinterhaus, 2. OG"
            autoComplete="shipping address-line2"
            defaultValue={v.addressAddition}
            error={e.addressAddition}
          />
          <div className="flex gap-3">
            <Field
              name="postalCode"
              label="PLZ"
              className="w-[116px] shrink-0 lg:w-[122px]"
              autoComplete="shipping postal-code"
              inputMode="numeric"
              maxLength={5}
              required
              defaultValue={v.postalCode}
              error={e.postalCode}
            />
            <Field
              name="city"
              label="Ort"
              className="min-w-0 flex-1"
              autoComplete="shipping address-level2"
              required
              defaultValue={v.city}
              error={e.city}
            />
          </div>
          <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-3">
            <Field
              name="country"
              label="Land"
              readOnlyDisplay="Deutschland"
              hint="Wir liefern aktuell nur innerhalb Deutschlands."
            />
            <Field
              name="phone"
              type="tel"
              label="Telefon"
              optional
              autoComplete="shipping tel"
              inputMode="tel"
              defaultValue={v.phone}
              hint="Nur für Rückfragen zur Zustellung."
              error={e.phone}
            />
          </div>

          <div className="co-billing">
            <Checkbox
              name="billingDifferent"
              label="Rechnungsadresse weicht ab"
              defaultChecked={billingChecked}
            />
            <div className="co-billing__fields mt-2 flex flex-col gap-3.5">
              <p className="text-[17px] font-semibold">Rechnungsadresse</p>
              <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-3">
                <Field
                  name="billingFirstName"
                  label="Vorname"
                  autoComplete="billing given-name"
                  defaultValue={v.billingFirstName}
                  error={e.billingFirstName}
                />
                <Field
                  name="billingLastName"
                  label="Nachname"
                  autoComplete="billing family-name"
                  defaultValue={v.billingLastName}
                  error={e.billingLastName}
                />
              </div>
              <Field
                name="billingStreet"
                label="Straße und Hausnummer"
                autoComplete="billing street-address"
                defaultValue={v.billingStreet}
                error={e.billingStreet}
              />
              <Field
                name="billingAddressAddition"
                label="Adresszusatz"
                optional
                autoComplete="billing address-line2"
                defaultValue={v.billingAddressAddition}
                error={e.billingAddressAddition}
              />
              <div className="flex gap-3">
                <Field
                  name="billingPostalCode"
                  label="PLZ"
                  className="w-[116px] shrink-0 lg:w-[122px]"
                  autoComplete="billing postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  defaultValue={v.billingPostalCode}
                  error={e.billingPostalCode}
                />
                <Field
                  name="billingCity"
                  label="Ort"
                  className="min-w-0 flex-1"
                  autoComplete="billing address-level2"
                  defaultValue={v.billingCity}
                  error={e.billingCity}
                />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[20px] leading-[1.2] font-semibold">Versand</legend>
          {shippingOptions.map((opt) => (
            <label key={opt.id} className="co-choice">
              <input
                type="radio"
                name="shippingRateId"
                value={opt.id}
                defaultChecked={opt.id === rateId}
                className="co-radio"
              />
              <TruckIcon className="h-[22px] w-[22px]" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-[3px] leading-[1.4]">
                <span className="text-[16px] font-semibold">{opt.name}</span>
                <span className="text-[14px]">
                  {opt.deliveryText} · {opt.listPriceText}
                </span>
                {opt.freeAboveText ? (
                  <span className="bg-butter border-aubergine rounded-full border-[1.5px] px-2.5 py-[3px] text-[12px] font-semibold">
                    {opt.freeAboveText}
                  </span>
                ) : null}
              </span>
              <span className="text-[16px] font-semibold whitespace-nowrap">{opt.priceText}</span>
            </label>
          ))}
          {e.shippingRateId ? (
            <p className="text-berry text-[13px] font-semibold">{e.shippingRateId}</p>
          ) : null}
        </fieldset>

        {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
        <div className="pv-honeypot" aria-hidden="true">
          <label htmlFor="f-website">Website</label>
          <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </form>

      {discountSlot}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <button
          type="submit"
          form="checkout-details"
          disabled={pending}
          className="btn-primary h-[52px] w-full lg:w-[280px]"
        >
          {pending ? "Einen Moment …" : "Weiter zur Zahlung"}
        </button>
        <p className="flex items-center gap-2 text-[13px] leading-[1.4] lg:max-w-[260px]">
          <LockIcon className="h-4 w-4" />
          Im nächsten Schritt wählst du die Zahlart und prüfst alles noch einmal.
        </p>
      </div>
    </>
  );
}
