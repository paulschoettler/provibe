"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveAddress } from "@/lib/auth/account-actions";
import type { SavedAddress } from "@/lib/auth/account-data";
import { INITIAL_FORM_STATE } from "@/lib/auth/form-state";
import { ADDRESS_COUNTRIES } from "@/lib/auth/validation";
import { SubmitButton } from "./SubmitButton";
import { BTN_OUTLINE, CARD_FLAT, Checkbox, Field, LINK_PLUM, Notice } from "./ui";

/** Adresse anlegen oder bearbeiten (Server Action mit Zod, funktioniert ohne JavaScript). */
export function AddressForm({ address }: { address?: SavedAddress }) {
  const [state, action] = useActionState(saveAddress, INITIAL_FORM_STATE);
  const v = (key: string, fallback: string | null | undefined) =>
    state.values?.[key] ?? fallback ?? "";
  const e = state.fieldErrors ?? {};
  const country = v("countryCode", address?.countryCode ?? "DE");

  return (
    <section className={`${CARD_FLAT} p-5 sm:p-6`} aria-labelledby="adresse-form-titel">
      <h2 id="adresse-form-titel" className="text-[20px] leading-[1.2] font-medium">
        {address ? "Adresse bearbeiten" : "Neue Adresse"}
      </h2>
      <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        {state.status === "error" ? (
          <Notice tone="error" role="alert" className="sm:col-span-2">
            {state.message}
          </Notice>
        ) : null}
        <input type="hidden" name="id" value={address?.id ?? ""} />
        <Field
          idPrefix="ad"
          name="firstName"
          label="Vorname"
          autoComplete="given-name"
          required
          defaultValue={v("firstName", address?.firstName)}
          error={e.firstName}
        />
        <Field
          idPrefix="ad"
          name="lastName"
          label="Nachname"
          autoComplete="family-name"
          required
          defaultValue={v("lastName", address?.lastName)}
          error={e.lastName}
        />
        <Field
          idPrefix="ad"
          name="company"
          label="Firma"
          autoComplete="organization"
          defaultValue={v("company", address?.company)}
          error={e.company}
          className="sm:col-span-2"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 sm:col-span-2">
          <Field
            idPrefix="ad"
            name="street"
            label="Straße"
            autoComplete="address-line1"
            required
            defaultValue={v("street", address?.street)}
            error={e.street}
          />
          <Field
            idPrefix="ad"
            name="houseNumber"
            label="Hausnummer"
            required
            defaultValue={v("houseNumber", address?.houseNumber)}
            error={e.houseNumber}
          />
        </div>
        <Field
          idPrefix="ad"
          name="addressAddition"
          label="Adresszusatz"
          autoComplete="address-line2"
          defaultValue={v("addressAddition", address?.addressAddition)}
          error={e.addressAddition}
          hint="Zum Beispiel c/o, Hinterhaus oder Packstation"
          className="sm:col-span-2"
        />
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 sm:col-span-2">
          <Field
            idPrefix="ad"
            name="postalCode"
            label="PLZ"
            autoComplete="postal-code"
            inputMode="numeric"
            required
            defaultValue={v("postalCode", address?.postalCode)}
            error={e.postalCode}
          />
          <Field
            idPrefix="ad"
            name="city"
            label="Ort"
            autoComplete="address-level2"
            required
            defaultValue={v("city", address?.city)}
            error={e.city}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ad-countryCode" className="text-[14px] leading-[1.4] font-bold">
            Land
          </label>
          <select
            id="ad-countryCode"
            name="countryCode"
            defaultValue={country}
            className="pv-acc-input"
            autoComplete="country"
          >
            {Object.entries(ADDRESS_COUNTRIES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-[13px] leading-[1.4]">Wir liefern aktuell nur nach Deutschland.</p>
        </div>
        <Field
          idPrefix="ad"
          name="phone"
          label="Telefon"
          type="tel"
          autoComplete="tel"
          defaultValue={v("phone", address?.phone)}
          error={e.phone}
          hint="Nur für Rückfragen zur Zustellung"
        />
        <Field
          idPrefix="ad"
          name="label"
          label="Bezeichnung"
          defaultValue={v("label", address?.label)}
          error={e.label}
          hint="Zum Beispiel Zuhause oder Büro"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Checkbox
            idPrefix="ad"
            name="isDefaultShipping"
            label="Als Standard-Lieferadresse verwenden"
            defaultChecked={address?.isDefaultShipping}
          />
          <Checkbox
            idPrefix="ad"
            name="isDefaultBilling"
            label="Als Standard-Rechnungsadresse verwenden"
            defaultChecked={address?.isDefaultBilling}
          />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <SubmitButton className="btn-primary" pendingLabel="Wird gespeichert …">
            Adresse speichern
          </SubmitButton>
          <Link
            href="/account/adressen"
            className={address ? BTN_OUTLINE : `${LINK_PLUM} text-[14px]`}
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </section>
  );
}

export default AddressForm;
