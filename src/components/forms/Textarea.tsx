import type { ReactNode } from "react";
import { FieldError, FieldLabel, describedBy } from "./parts";

export interface TextareaProps {
  name: string;
  label: ReactNode;
  id?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string;
  maxLength?: number;
  rows?: number;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

/** Mehrzeiliges Feld nach Figma (Baustein 21:187): Höhe 140 px, Radius 14, Innenabstand 16/14. */
export function Textarea({
  name,
  label,
  id,
  placeholder,
  required,
  optional,
  defaultValue,
  maxLength,
  rows = 5,
  error,
  hint,
  className = "",
}: TextareaProps) {
  const fieldId = id ?? `feld-${name}`;
  return (
    <div className={`pv-form-field ${className}`}>
      <FieldLabel htmlFor={fieldId} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={fieldId}
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(error), Boolean(hint))}
        className="pv-input pv-textarea"
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

export default Textarea;
