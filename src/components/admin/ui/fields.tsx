"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useActionFormState } from "./ActionForm";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Formularbausteine nach Figma (24:3185): Label immer sichtbar über dem Feld (13 px Medium),
 * Feld 40 px (mobil 44 px), Radius 8, Fokus 2 px Magenta, Fehler 2 px Rot mit Icon und Text.
 * Innerhalb von <ActionForm> kommen Fehler und zurückgegebene Werte automatisch aus dem
 * Ergebnis der Server Action (über name). Außerhalb per error/defaultValue setzen.
 */

interface FieldBase {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Label nur für Screenreader (zum Beispiel Suchfeld mit Platzhalter) */
  hideLabel?: boolean;
  className?: string;
}

function useFieldState(name: string, error?: string, defaultValue?: unknown) {
  const state = useActionFormState();
  const err = error ?? state.fieldErrors?.[name];
  const value =
    state.status === "error" && state.values && name in state.values
      ? state.values[name]
      : defaultValue;
  return { error: err, value };
}

export const inputClasses = (invalid?: boolean, extra?: string) =>
  cx(
    "w-full min-w-0 rounded-admin-feld bg-admin-karte px-3 text-[14px] text-admin-text placeholder:text-admin-text-2 disabled:bg-admin-flaeche disabled:text-admin-text-2",
    "h-11 md:h-10",
    invalid
      ? "border-2 border-admin-rot focus-visible:border-admin-rot"
      : "border border-admin-rahmen-stark focus-visible:border-2 focus-visible:border-admin-akzent",
    "focus-visible:outline-none",
    extra,
  );

function FieldShell({
  id,
  label,
  hint,
  error,
  hideLabel,
  required,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cx("text-[13px] leading-[1.4] font-medium", hideLabel && "sr-only")}
      >
        {label}
        {required ? (
          <span className="text-admin-text-2" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      <FieldNote id={id} hint={hint} error={error} />
    </div>
  );
}

function FieldNote({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-fehler`} className="text-admin-rot flex items-start gap-1 text-[12px]">
        <span className="mt-px">
          <Icon name="warnung" size={14} />
        </span>
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hinweis`} className="text-admin-text-2 text-[12px]">
        {hint}
      </p>
    );
  }
  return null;
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return error ? `${id}-fehler` : hint ? `${id}-hinweis` : undefined;
}

/* --- Textfeld --------------------------------------------------------------------------------- */

export type FieldProps = FieldBase &
  Omit<ComponentProps<"input">, "name" | "className" | "children"> & {
    /** Inhalt vor dem Eingabetext (zum Beispiel "€" oder ein Icon) */
    prefix?: ReactNode;
    suffix?: ReactNode;
  };

export function Field({
  name,
  label,
  hint,
  error,
  hideLabel,
  className,
  id,
  defaultValue,
  prefix,
  suffix,
  required,
  ...rest
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? `f-${name}-${autoId}`;
  const s = useFieldState(name, error, defaultValue);
  const input = (
    <input
      id={fieldId}
      name={name}
      defaultValue={s.value as string | number | undefined}
      required={required}
      aria-invalid={s.error ? true : undefined}
      aria-describedby={describedBy(fieldId, hint, s.error)}
      className={
        prefix || suffix
          ? "text-admin-text placeholder:text-admin-text-2 h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          : inputClasses(Boolean(s.error))
      }
      {...rest}
    />
  );
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={s.error}
      hideLabel={hideLabel}
      required={required}
      className={className}
    >
      {prefix || suffix ? (
        <div
          className={cx(
            inputClasses(Boolean(s.error)),
            "focus-within:border-admin-akzent flex items-center gap-2 focus-within:border-2",
          )}
        >
          {prefix ? <span className="text-admin-text-2 shrink-0">{prefix}</span> : null}
          {input}
          {suffix ? <span className="text-admin-text-2 shrink-0">{suffix}</span> : null}
        </div>
      ) : (
        input
      )}
    </FieldShell>
  );
}

/* --- Auswahl ---------------------------------------------------------------------------------- */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = FieldBase &
  Omit<ComponentProps<"select">, "name" | "className" | "children"> & {
    options: SelectOption[];
    /** Erste leere Option, zum Beispiel "Alle" */
    placeholder?: string;
  };

export function Select({
  name,
  label,
  hint,
  error,
  hideLabel,
  className,
  id,
  options,
  placeholder,
  defaultValue,
  required,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? `f-${name}-${autoId}`;
  const s = useFieldState(name, error, defaultValue);
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={s.error}
      hideLabel={hideLabel}
      required={required}
      className={className}
    >
      <div className="relative">
        <select
          id={fieldId}
          name={name}
          defaultValue={s.value as string | undefined}
          required={required}
          aria-invalid={s.error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, s.error)}
          className={inputClasses(Boolean(s.error), "appearance-none pr-9")}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-admin-text-2 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
          <Icon name="chevron-unten" size={16} />
        </span>
      </div>
    </FieldShell>
  );
}

/* --- Mehrzeilig ------------------------------------------------------------------------------- */

export type TextareaProps = FieldBase &
  Omit<ComponentProps<"textarea">, "name" | "className" | "children">;

export function Textarea({
  name,
  label,
  hint,
  error,
  hideLabel,
  className,
  id,
  defaultValue,
  required,
  rows = 4,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? `f-${name}-${autoId}`;
  const s = useFieldState(name, error, defaultValue);
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={s.error}
      hideLabel={hideLabel}
      required={required}
      className={className}
    >
      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        defaultValue={s.value as string | undefined}
        required={required}
        aria-invalid={s.error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, s.error)}
        className={inputClasses(Boolean(s.error), "h-auto! py-2.5 leading-[1.5]")}
        {...rest}
      />
    </FieldShell>
  );
}

/* --- Checkbox --------------------------------------------------------------------------------- */

export type CheckboxProps = Omit<FieldBase, "label"> &
  Omit<ComponentProps<"input">, "name" | "className" | "children" | "type"> & {
    label: ReactNode;
    description?: ReactNode;
  };

/** Checkbox 18 px (Figma 24:3124), Magenta mit Haken, Fehlerzustand mit Text darunter. */
export function Checkbox({
  name,
  label,
  description,
  hint,
  error,
  hideLabel,
  className,
  id,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const fieldId = id ?? `f-${name}-${autoId}`;
  const s = useFieldState(name, error);
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label
        htmlFor={fieldId}
        className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1 md:min-h-0"
      >
        <CheckboxBox
          id={fieldId}
          name={name}
          aria-invalid={s.error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, s.error)}
          {...rest}
        />
        <span className={cx("min-w-0", hideLabel && "sr-only")}>
          <span className="block text-[14px] leading-[1.3] font-medium">{label}</span>
          {description ? (
            <span className="text-admin-text-2 mt-0.5 block text-[13px]">{description}</span>
          ) : null}
        </span>
      </label>
      <FieldNote id={fieldId} hint={hint} error={s.error} />
    </div>
  );
}

/** Nur das Kästchen (Tabellenauswahl): echtes <input type="checkbox"> mit eigener Optik. */
export function CheckboxBox({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className={cx("relative inline-flex size-[18px] shrink-0", className)}>
      <input
        type="checkbox"
        className="peer border-admin-rahmen-stark bg-admin-karte checked:border-admin-akzent checked:bg-admin-akzent indeterminate:border-admin-akzent indeterminate:bg-admin-akzent aria-invalid:border-admin-rot size-[18px] cursor-pointer appearance-none rounded-[4px] border-[1.5px]"
        {...rest}
      />
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-white peer-checked:flex">
        <Icon name="haken" size={14} />
      </span>
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center peer-indeterminate:flex">
        <span className="h-[2px] w-2 rounded-[1px] bg-white" />
      </span>
    </span>
  );
}

/* --- Schalter --------------------------------------------------------------------------------- */

export type SwitchProps = Omit<CheckboxProps, "description"> & { description?: ReactNode };

/** Schalter (Figma Einstellungen "Zwei-Faktor-Pflicht"): role="switch", als Checkbox im Formular. */
export function Switch({
  name,
  label,
  description,
  hint,
  error,
  hideLabel,
  className,
  id,
  ...rest
}: SwitchProps) {
  const autoId = useId();
  const fieldId = id ?? `f-${name}-${autoId}`;
  const s = useFieldState(name, error);
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label
        htmlFor={fieldId}
        className="flex min-h-11 cursor-pointer items-center gap-3 md:min-h-0"
      >
        <span className={cx("min-w-0 flex-1", hideLabel && "sr-only")}>
          <span className="block text-[14px] font-semibold">{label}</span>
          {description ? (
            <span className="text-admin-text-2 mt-0.5 block text-[13px]">{description}</span>
          ) : null}
        </span>
        <span className="relative inline-flex h-6 w-10 shrink-0">
          <input
            id={fieldId}
            name={name}
            type="checkbox"
            role="switch"
            aria-describedby={describedBy(fieldId, hint, s.error)}
            className="peer bg-admin-rahmen-stark checked:bg-admin-akzent h-6 w-10 cursor-pointer appearance-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            {...rest}
          />
          <span className="pointer-events-none absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
      <FieldNote id={fieldId} hint={hint} error={s.error} />
    </div>
  );
}

/* --- Radiokarten ------------------------------------------------------------------------------ */

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Auswahl als Karten (Figma Einladen-Dialog 50:3732: Rolle mit Beschreibung). */
export function RadioCards({
  name,
  legend,
  options,
  defaultValue,
  error,
  className,
}: {
  name: string;
  legend: ReactNode;
  options: RadioCardOption[];
  defaultValue?: string;
  error?: string;
  className?: string;
}) {
  const autoId = useId();
  const s = useFieldState(name, error, defaultValue);
  const groupId = `g-${name}-${autoId}`;
  return (
    <fieldset
      className={cx("flex flex-col gap-2", className)}
      aria-describedby={s.error ? `${groupId}-fehler` : undefined}
    >
      <legend className="mb-1.5 text-[13px] font-medium">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="rounded-admin-feld border-admin-rahmen-stark has-checked:border-admin-akzent has-checked:bg-admin-akzent-hell flex cursor-pointer items-start gap-3 border p-3 has-checked:border-2 has-disabled:cursor-not-allowed has-disabled:opacity-60"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            disabled={o.disabled}
            defaultChecked={s.value === o.value}
            className="border-admin-rahmen-stark bg-admin-karte checked:border-admin-akzent mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] checked:border-[5px]"
          />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{o.label}</span>
            {o.description ? (
              <span className="text-admin-text-2 mt-0.5 block text-[13px]">{o.description}</span>
            ) : null}
          </span>
        </label>
      ))}
      <FieldNote id={groupId} error={s.error} />
    </fieldset>
  );
}
