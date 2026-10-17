"use client";

import { useState, useSyncExternalStore } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { CheckboxBox, inputClasses } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";
import { useCheckedState } from "./StateCheckbox";

/**
 * Auswahlliste mit Checkboxen (Produkte oder Kollektionen) für Rabatt-Geltungsbereich,
 * Kollektionszuordnung und "Produkte hinzufügen". Mit JavaScript gibt es ein Suchfeld, das die
 * Liste filtert; ohne JavaScript ist die ganze Liste sichtbar. Fehler kommen über errorName.
 */
export interface PickerOption {
  value: string;
  label: string;
  meta?: string;
  imageUrl?: string | null;
  disabled?: boolean;
}

function noop() {
  return () => {};
}

export function PickerList({
  name,
  options,
  selected,
  legend,
  errorName,
  disabled,
  emptyText = "Keine Einträge.",
  searchPlaceholder = "Suchen",
  maxHeight = 280,
}: {
  name: string;
  options: PickerOption[];
  selected: string[];
  legend: string;
  errorName?: string;
  disabled?: boolean;
  emptyText?: string;
  searchPlaceholder?: string;
  maxHeight?: number;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const state = useActionFormState();
  const [q, setQ] = useState("");
  const error = errorName ? state.fieldErrors?.[errorName] : undefined;
  const needle = q.trim().toLowerCase();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-[13px] font-medium">{legend}</legend>
      {hydrated && options.length > 6 ? (
        <label className="relative">
          <span className="sr-only">{searchPlaceholder}</span>
          <span className="text-admin-text-2 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <Icon name="suche" size={16} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className={inputClasses(false, "pl-9")}
          />
        </label>
      ) : null}
      {options.length === 0 ? (
        <p className="text-admin-text-2 text-[13px]">{emptyText}</p>
      ) : (
        <ul
          className="rounded-admin-feld border-admin-rahmen divide-admin-rahmen divide-y overflow-y-auto border"
          style={{ maxHeight }}
        >
          {options.map((o) => (
            <PickerRow
              key={o.value}
              name={name}
              option={o}
              initial={selected.includes(o.value)}
              disabled={disabled || o.disabled}
              hidden={
                Boolean(needle) && !`${o.label} ${o.meta ?? ""}`.toLowerCase().includes(needle)
              }
            />
          ))}
        </ul>
      )}
      {error ? (
        <p className="text-admin-rot flex items-start gap-1 text-[12px]" role="alert">
          <Icon name="warnung" size={14} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function PickerRow({
  name,
  option,
  initial,
  disabled,
  hidden,
}: {
  name: string;
  option: PickerOption;
  initial: boolean;
  disabled?: boolean;
  hidden: boolean;
}) {
  const checked = useCheckedState(name, option.value, initial);
  return (
    <li className={hidden ? "hidden" : undefined}>
      <label className="hover:bg-admin-flaeche flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
        <CheckboxBox
          name={name}
          value={option.value}
          defaultChecked={checked}
          disabled={disabled}
        />
        {option.imageUrl !== undefined ? (
          <span className="rounded-admin-feld bg-admin-flaeche flex size-9 shrink-0 items-center justify-center overflow-hidden">
            {option.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={option.imageUrl}
                alt=""
                className="size-full object-contain"
                loading="lazy"
              />
            ) : (
              <Icon name="bild" size={16} />
            )}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{option.label}</span>
          {option.meta ? (
            <span className="text-admin-text-2 block truncate text-[12px]">{option.meta}</span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
