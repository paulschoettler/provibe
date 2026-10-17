"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Absende-Button (Button/Primär, 48 px, Pill). Während die Server Action läuft, zeigt er
 * einen Wartetext und ist gesperrt, damit niemand doppelt absendet. Ohne JavaScript
 * ist er ein ganz normaler Submit-Button.
 */
export function SubmitButton({
  children,
  pendingLabel = "Moment …",
  name,
  value,
  variant = "primary",
  className = "",
  formNoValidate,
}: {
  children: ReactNode;
  pendingLabel?: string;
  name?: string;
  value?: string;
  variant?: "primary" | "secondary";
  className?: string;
  formNoValidate?: boolean;
}) {
  const { pending, data } = useFormStatus();
  // Bei mehreren Buttons im Formular nur den gedrückten als wartend zeigen
  const isThis = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      formNoValidate={formNoValidate}
      className={`${variant === "primary" ? "pv-btn-primary" : "pv-btn-secondary"} ${className}`}
    >
      {isThis ? pendingLabel : children}
    </button>
  );
}

export default SubmitButton;
