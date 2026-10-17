import type { ReactNode } from "react";
import { FieldError, FieldLabel, describedBy } from "./parts";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name: string;
  label: ReactNode;
  options: SelectOption[];
  id?: string;
  /** Platzhalter als erste, leere Option */
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

/**
 * Auswahlfeld nach Figma (Baustein 21:177). Bewusst ein natives <select>: funktioniert
 * ohne JavaScript, mit Tastatur und Screenreader und öffnet auf dem Handy den System-Picker.
 * Der geschlossene Zustand folgt Figma (52 px, Radius 14, Pfeil rechts); die geöffnete
 * Liste zeichnet das Betriebssystem.
 */
export function Select({
  name,
  label,
  options,
  id,
  placeholder = "Bitte wählen",
  required,
  optional,
  defaultValue,
  error,
  hint,
  className = "",
}: SelectProps) {
  const fieldId = id ?? `feld-${name}`;
  return (
    <div className={`pv-form-field ${className}`}>
      <FieldLabel htmlFor={fieldId} optional={optional}>
        {label}
      </FieldLabel>
      <div className="pv-select-wrap">
        <select
          id={fieldId}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, Boolean(error), Boolean(hint))}
          className="pv-input pv-select"
        >
          <option value="" disabled={required}>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pv-select-icon"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="var(--pv-wildberry)"
            strokeWidth="1.66667"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {hint ? (
        <p id={`${fieldId}-hinweis`} className="pv-form-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${fieldId}-fehler`} message={error} />
    </div>
  );
}

export default Select;
