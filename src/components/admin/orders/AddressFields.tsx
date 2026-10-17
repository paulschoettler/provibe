"use client";

import { useState } from "react";
import type { StoredAddress } from "@/lib/checkout/types";
import { Checkbox, Field } from "@/components/admin/ui/fields";

/**
 * Adressfelder für Bestelldetail (Adresse bearbeiten) und manuelle Bestellung. Feldnamen
 * ship_* und bill_*, die Server Actions lesen sie mit addressFrom(). Land ist fest Deutschland
 * (Checkout liefert nur nach DE).
 */
export function AddressFieldset({
  prefix,
  legend,
  value,
  withPhone = true,
}: {
  prefix: "ship" | "bill";
  legend: string;
  value?: Partial<StoredAddress> | null;
  withPhone?: boolean;
}) {
  const v = value ?? {};
  const n = (k: string) => `${prefix}_${k}`;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[14px] font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-3">
        <Field
          name={n("first_name")}
          label="Vorname"
          defaultValue={v.first_name ?? ""}
          autoComplete="off"
          required
        />
        <Field
          name={n("last_name")}
          label="Nachname"
          defaultValue={v.last_name ?? ""}
          autoComplete="off"
          required
        />
      </div>
      <Field name={n("company")} label="Firma (optional)" defaultValue={v.company ?? ""} />
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field name={n("street")} label="Straße" defaultValue={v.street ?? ""} required />
        <Field name={n("house_number")} label="Nr." defaultValue={v.house_number ?? ""} />
      </div>
      <Field
        name={n("address_addition")}
        label="Adresszusatz (optional)"
        defaultValue={v.address_addition ?? ""}
      />
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field
          name={n("postal_code")}
          label="PLZ"
          inputMode="numeric"
          maxLength={5}
          defaultValue={v.postal_code ?? ""}
          required
        />
        <Field name={n("city")} label="Ort" defaultValue={v.city ?? ""} required />
      </div>
      {withPhone ? (
        <Field
          name={n("phone")}
          label="Telefon (optional)"
          type="tel"
          defaultValue={v.phone ?? ""}
        />
      ) : null}
      <p className="text-admin-text-2 text-[12px]">Land: Deutschland</p>
    </fieldset>
  );
}

/** Liefer- und Rechnungsadresse mit "Rechnungsadresse wie Lieferadresse". */
export function AddressEditor({
  shipping,
  billing,
}: {
  shipping?: Partial<StoredAddress> | null;
  billing?: Partial<StoredAddress> | null;
}) {
  const [same, setSame] = useState(!billing);
  return (
    <div className="flex flex-col gap-4">
      <AddressFieldset prefix="ship" legend="Lieferadresse" value={shipping} />
      <Checkbox
        name="billingSame"
        label="Rechnungsadresse wie Lieferadresse"
        checked={same}
        onChange={(e) => setSame(e.target.checked)}
      />
      {same ? null : <AddressFieldset prefix="bill" legend="Rechnungsadresse" value={billing} />}
    </div>
  );
}
