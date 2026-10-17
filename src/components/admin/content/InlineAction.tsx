"use client";

import type { ReactNode } from "react";
import { ActionForm, ActionFormMessage, type FormAction } from "@/components/admin/ui/ActionForm";
import type { ButtonVariant } from "@/components/admin/ui/Button";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import type { IconName } from "@/components/admin/ui/Icon";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { cx } from "@/components/admin/ui/cx";

/**
 * Kleine Aktion als eigenes Formular (Schalten, Verschieben, Löschen) mit versteckten Feldern.
 * Funktioniert ohne JavaScript. Mit confirm öffnet sich vorher ein Dialog (Löschen, Ablehnen),
 * children landen dann im Dialog (zum Beispiel ein Pflichtfeld für den Grund).
 */
export function InlineAction({
  action,
  fields,
  label,
  srLabel,
  variant = "secondary",
  size = "sm",
  icon,
  confirm,
  children,
  className,
  disabled,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  /** Zusätzlicher Text für Screenreader, zum Beispiel "Hero nach oben" */
  srLabel?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: IconName;
  confirm?: { title: string; description?: ReactNode; confirmLabel: string; danger?: boolean };
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const hidden = Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));
  if (confirm) {
    return (
      <Dialog
        title={confirm.title}
        description={confirm.description}
        size="sm"
        trigger={{ label, variant, icon, className }}
      >
        <ActionForm action={action} closeDialogOnSuccess hideMessage>
          {hidden}
          <DialogBody>
            <ActionFormMessage />
            {children}
          </DialogBody>
          <DialogFooter>
            <DialogClose />
            <SubmitButton variant={confirm.danger ? "danger" : "primary"} disabled={disabled}>
              {confirm.confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </ActionForm>
      </Dialog>
    );
  }
  return (
    <ActionForm action={action} hideMessage className={cx("inline-flex flex-col gap-1", className)}>
      {hidden}
      <SubmitButton
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        aria-label={srLabel}
        title={srLabel}
      >
        {label}
      </SubmitButton>
      <ActionFormMessage className="text-[12px]" />
    </ActionForm>
  );
}
