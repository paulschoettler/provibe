import type { HTMLInputTypeAttribute, ReactNode } from "react";
import { FieldError, FieldLabel, describedBy } from "./parts";

export interface FieldProps {
  /** Name im FormData, zugleich Grundlage für die id */
  name: string;
  label: ReactNode;
  id?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  /** Zeigt "(optional)" hinter dem Label */
  optional?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "search" | "url" | "decimal" | "none";
  defaultValue?: string;
  maxLength?: number;
  /** Fehlertext; setzt aria-invalid und den Fehlerrahmen */
  error?: string;
  /** Hilfetext unter dem Feld */
  hint?: ReactNode;
  className?: string;
}

/**
 * Formularfeld nach Figma (Baustein 21:146): Label 14/500, Eingabe 52 px, Radius 14,
 * Rahmen 1,5 px Aubergine 28 %, Fokus Plum mit Pink-Light-Ring, Fehler Magenta-Rahmen
 * mit Icon und Text in Berry (H9). Server-tauglich, kein Client-Code.
 */
export function Field({
  name,
  label,
  id,
  type = "text",
  placeholder,
  required,
  optional,
  autoComplete,
  inputMode,
  defaultValue,
  maxLength,
  error,
  hint,
  className = "",
}: FieldProps) {
  const fieldId = id ?? `feld-${name}`;
  return (
    <div className={`pv-form-field ${className}`}>
      <FieldLabel htmlFor={fieldId} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={fieldId}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(error), Boolean(hint))}
        className="pv-input"
      />
      {hint ? (
        <p id={`${fieldId}-hinweis`} className="pv-form-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${fieldId}-fehler`} message={error} />
    </div>
  );
}

export default Field;
