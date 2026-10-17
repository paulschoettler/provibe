"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

/**
 * Absende-Button für Formulare mit Server Action: während des Absendens gesperrt
 * und mit aria-busy, optional mit eigenem Text ("Wird gespeichert …").
 */
export function SubmitButton({
  pendingLabel,
  children,
  variant = "primary",
  disabled,
  ...rest
}: Omit<ButtonProps, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
