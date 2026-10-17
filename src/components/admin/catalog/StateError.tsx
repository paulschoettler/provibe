"use client";

import { useEffect, useRef } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Icon } from "@/components/admin/ui/Icon";

/**
 * Fehler eines Sammelfelds aus dem Ergebnis der Server Action (zum Beispiel "variants" oder
 * "components.<id>"), das keinem einzelnen Eingabefeld gehört. Optional mehrere Namen.
 */
export function StateError({
  names,
  box,
  prefix,
}: {
  names: string[];
  /** als Hinweisbox statt Textzeile */
  box?: boolean;
  /** alle Fehler, deren Feldname so beginnt (zum Beispiel "lmiv.nutrition") */
  prefix?: string;
}) {
  const state = useActionFormState();
  const fe = state.fieldErrors ?? {};
  const messages = [
    ...names.map((n) => fe[n]).filter(Boolean),
    ...(prefix
      ? Object.entries(fe)
          .filter(([k]) => k.startsWith(prefix) && !names.includes(k))
          .map(([, v]) => v)
      : []),
  ];
  const unique = [...new Set(messages)];
  if (!unique.length) return null;
  if (box)
    return (
      <FormMessage tone="error" className="mb-0">
        {unique.join(" ")}
      </FormMessage>
    );
  return (
    <p className="text-admin-rot flex items-start gap-1 text-[12px]" role="alert">
      <Icon name="warnung" size={14} />
      {unique.join(" ")}
    </p>
  );
}

/**
 * Erfolgsmeldung mit Hinweisen (ActionState.message bei status ok), zum Beispiel fehlende Gewichte.
 * Nach einem Fehler springt der Fokus aufs erste fehlerhafte Feld. Dass die Speichern-Leiste nach
 * einem Fehler sichtbar bleibt, regelt die SaveBar selbst (wartet auf das Erfolgsereignis).
 */
export function StateNotice() {
  const state = useActionFormState();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    const form = ref.current?.closest("form");
    if (!form) return;
    const t = setTimeout(() => {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <>
      <span ref={ref} hidden />
      {state.status === "ok" && state.message ? (
        <FormMessage tone="warning" className="mb-4">
          Gespeichert. Hinweise: {state.message}
        </FormMessage>
      ) : null}
    </>
  );
}
