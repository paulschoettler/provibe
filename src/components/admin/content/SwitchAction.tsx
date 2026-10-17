"use client";

import { useFormStatus } from "react-dom";
import { ActionForm, ActionFormMessage, type FormAction } from "@/components/admin/ui/ActionForm";
import { cx } from "@/components/admin/ui/cx";

/**
 * Schalter als eigenes Formular (Modul ein/aus, Zone aktiv, Weiterleitung aktiv): ein Klick
 * schickt den neuen Zustand. Ohne JavaScript ein normaler Absende-Button in Schalter-Optik.
 */
export function SwitchAction({
  action,
  fields,
  checked,
  label,
  disabled,
  stateName = "enabled",
}: {
  action: FormAction;
  fields: Record<string, string>;
  checked: boolean;
  /** Beschriftung für Screenreader, zum Beispiel "Hero anzeigen" */
  label: string;
  disabled?: boolean;
  stateName?: string;
}) {
  return (
    <ActionForm action={action} hideMessage className="inline-flex flex-col items-end gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name={stateName} value={checked ? "0" : "1"} />
      <SwitchButton checked={checked} label={label} disabled={disabled} />
      <ActionFormMessage className="max-w-[240px] text-[12px]" />
    </ActionForm>
  );
}

function SwitchButton({
  checked,
  label,
  disabled,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      className="flex min-h-11 min-w-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cx(
          "relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-admin-akzent" : "bg-admin-rahmen-stark",
          pending && "opacity-70",
        )}
      >
        <span
          className={cx(
            "absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
