"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/admin/ui/Button";
import type { IconName } from "@/components/admin/ui/Icon";

/**
 * Absende-Button mit Rückfrage (window.confirm) für Löschen, Archivieren und ähnliche Aktionen.
 * Ohne JavaScript sendet er direkt ab; die Regeln (zum Beispiel "nur ungenutzte Codes löschen")
 * prüft immer der Server. Mit form= lässt er sich außerhalb des Formulars platzieren.
 */
export function ConfirmSubmit({
  confirm,
  children,
  variant = "secondary",
  size = "md",
  icon,
  form,
  name,
  value,
  className,
  "aria-label": ariaLabel,
  disabled,
}: {
  confirm: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  form?: string;
  name?: string;
  value?: string;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      icon={icon}
      form={form}
      name={name}
      value={value}
      className={className}
      aria-label={ariaLabel}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
