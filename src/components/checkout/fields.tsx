import type { InputHTMLAttributes } from "react";
import { AlertIcon } from "./icons";

/**
 * Formularfeld (Figma 26:1040) und Checkbox (26:1059) der Kasse. Label immer sichtbar,
 * Fehler und Hinweise per aria-describedby verknüpft, Touchziel mindestens 44 px.
 */
export function Field({
  name,
  label,
  optional,
  hint,
  error,
  className = "",
  id,
  readOnlyDisplay,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  /** Feste Anzeige statt Eingabe (zum Beispiel Land) */
  readOnlyDisplay?: string;
}) {
  const fieldId = id ?? `f-${name}`;
  const hintId = hint ? `${fieldId}-hinweis` : undefined;
  const errorId = error ? `${fieldId}-fehler` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={fieldId} className="flex items-center gap-1.5 leading-[1.4]">
        <span className="text-[14px] font-semibold">{label}</span>
        {optional ? <span className="text-plum text-[13px]">optional</span> : null}
      </label>
      {readOnlyDisplay !== undefined ? (
        <input
          id={fieldId}
          name={name}
          value={readOnlyDisplay}
          readOnly
          aria-describedby={describedBy}
          className="co-input co-input--readonly"
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="co-input"
          {...input}
        />
      )}
      {error ? (
        <p id={errorId} className="text-berry flex items-center gap-1.5 text-[13px] font-semibold">
          <AlertIcon className="h-4 w-4" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-[13px] leading-[1.4]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  name,
  label,
  extra,
  defaultChecked,
  id,
  className = "",
}: {
  name: string;
  label: string;
  extra?: string;
  defaultChecked?: boolean;
  id?: string;
  className?: string;
}) {
  const fieldId = id ?? `f-${name}`;
  return (
    <div className={`flex items-center gap-3 py-2.5 ${className}`}>
      <input
        type="checkbox"
        id={fieldId}
        name={name}
        defaultChecked={defaultChecked}
        className="co-checkbox"
        aria-describedby={extra ? `${fieldId}-zusatz` : undefined}
      />
      <div className="leading-[1.4]">
        <label htmlFor={fieldId} className="text-[15px]">
          {label}
        </label>
        {extra ? (
          <p id={`${fieldId}-zusatz`} className="text-[13px]">
            {extra}
          </p>
        ) : null}
      </div>
    </div>
  );
}
