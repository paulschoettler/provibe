"use client";

import type { ReactNode } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { Checkbox, CheckboxBox, Switch } from "@/components/admin/ui/fields";

/**
 * Checkbox oder Schalter, die nach einem Fehler der Server Action ihren eingegebenen Zustand
 * behalten (ActionState.values). Die Bausteine aus dem UI-Kit stellen nur Textwerte wieder her.
 * Bei Gruppen (gleicher name, mehrere value) stehen die Werte kommagetrennt in values[name].
 */
export function useCheckedState(
  name: string,
  value: string | undefined,
  initial: boolean,
): boolean {
  const state = useActionFormState();
  if (state.status === "error" && state.values) {
    const v = state.values[name];
    if (value === undefined) return name in state.values;
    return v !== undefined && v.split(",").includes(value);
  }
  return initial;
}

interface Props {
  name: string;
  value?: string;
  label: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
  form?: string;
  className?: string;
  variant?: "checkbox" | "switch" | "box";
  "aria-label"?: string;
}

export function StateCheckbox({
  name,
  value,
  label,
  description,
  hint,
  defaultChecked = false,
  disabled,
  form,
  className,
  variant = "checkbox",
  "aria-label": ariaLabel,
}: Props) {
  const checked = useCheckedState(name, value, defaultChecked);
  if (variant === "box")
    return (
      <CheckboxBox
        name={name}
        value={value}
        defaultChecked={checked}
        disabled={disabled}
        form={form}
        className={className}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      />
    );
  const C = variant === "switch" ? Switch : Checkbox;
  return (
    <C
      name={name}
      value={value}
      label={label}
      description={description}
      hint={hint}
      defaultChecked={checked}
      disabled={disabled}
      form={form}
      className={className}
    />
  );
}
