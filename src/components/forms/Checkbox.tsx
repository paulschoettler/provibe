import type { ReactNode } from "react";

export interface CheckboxProps {
  name: string;
  /** Text neben dem Kästchen; das ganze Feld ist Klickfläche (min. 44 px hoch) */
  children: ReactNode;
  id?: string;
  value?: string;
  defaultChecked?: boolean;
  required?: boolean;
  /** Fehlertext-id, wenn eine Gruppe den Fehler trägt */
  describedById?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Checkbox nach Figma (Baustein 21:203): Kästchen 24 px, Radius 6, aus mit Rahmen
 * Aubergine 60 %, an in Magenta mit weißem Haken. Natives input, nie vorangekreuzt,
 * solange der Aufrufer es nicht ausdrücklich will.
 */
export function Checkbox({
  name,
  children,
  id,
  value = "on",
  defaultChecked,
  required,
  describedById,
  invalid,
  className = "",
}: CheckboxProps) {
  const fieldId = id ?? `feld-${name}-${value}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  return (
    <label htmlFor={fieldId} className={`pv-checkbox ${className}`}>
      <input
        id={fieldId}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        aria-describedby={describedById}
        aria-invalid={invalid ? true : undefined}
        className="pv-checkbox-input"
      />
      <span className="pv-checkbox-text">{children}</span>
    </label>
  );
}

export default Checkbox;
