"use client";

import { useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/fields";
import { generateDiscountCode } from "@/lib/admin/discounts/rules";

/**
 * Rabattcode mit "Code generieren" (zufällig, ohne verwechselbare Zeichen). Ohne JavaScript
 * fehlt der Button; ein leeres Feld lässt der Server beim Speichern einen Code erzeugen.
 */
function noop() {
  return () => {};
}

export function CodeField({
  defaultValue,
  disabled,
}: {
  defaultValue: string;
  disabled?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Field
        name="code"
        label="Rabattcode"
        defaultValue={defaultValue}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        maxLength={32}
        className="flex-1"
        placeholder="SOMMER10"
        hint="3 bis 32 Zeichen: Buchstaben, Ziffern, Binde- und Unterstrich. Groß und klein ist egal. Leer lassen erzeugt einen Code."
      />
      {hydrated && !disabled ? (
        <Button
          variant="secondary"
          className="sm:mt-[26px]"
          onClick={() => {
            const input = ref.current?.querySelector<HTMLInputElement>('input[name="code"]');
            if (!input) return;
            input.value = generateDiscountCode("PV");
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
          }}
        >
          Code generieren
        </Button>
      ) : null}
    </div>
  );
}
