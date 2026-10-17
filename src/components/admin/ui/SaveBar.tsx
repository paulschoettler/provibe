"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { ACTION_FORM_ATTRIBUTE, ACTION_RESULT_EVENT } from "./ActionForm";
import { Icon } from "./Icon";
import { cx } from "./cx";

/**
 * Sticky Speichern-Leiste nach Figma (26:5219): Aubergine, "Ungespeicherte Änderungen",
 * Verwerfen und Speichern. Gehört zu einem Formular über formId (auch außerhalb des <form>).
 * Erscheint, sobald im Formular etwas geändert wurde; ohne JavaScript ist sie immer sichtbar.
 * Innerhalb des Formulars platziert zeigt der Speichern-Button den Sende-Zustand.
 *
 * Bei einem ActionForm bleibt die Leiste nach dem Absenden sichtbar, bis die Action Erfolg meldet
 * (ACTION_RESULT_EVENT mit status "ok"). Das automatische Zurücksetzen durch React nach der
 * Action blendet sie nicht aus; nach einem Fehler bleibt sie stehen. Bei anderen Formularen
 * verschwindet sie wie bisher beim Absenden.
 */
export function SaveBar({
  formId,
  saveLabel = "Speichern",
  discardLabel = "Verwerfen",
  message = "Ungespeicherte Änderungen",
  alwaysVisible,
}: {
  formId: string;
  saveLabel?: string;
  discardLabel?: string;
  message?: string;
  /** Immer zeigen (zum Beispiel bei neuen Datensätzen) */
  alwaysVisible?: boolean;
}) {
  // false im Server-HTML (Leiste sichtbar, ohne JavaScript nutzbar), true nach der Hydration
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [dirty, setDirty] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const waitsForResult = form.hasAttribute(ACTION_FORM_ATTRIBUTE);
    // Zwischen Absenden und Ergebnis: Das Zurücksetzen kommt von React, nicht von "Verwerfen"
    let awaiting = false;
    const onChange = () => setDirty(true);
    const onReset = () => {
      if (!awaiting) setDirty(false);
    };
    const onSubmit = () => {
      if (waitsForResult) awaiting = true;
      else setDirty(false);
    };
    const onResult = (event: Event) => {
      awaiting = false;
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      if (status === "ok") setDirty(false);
    };
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    form.addEventListener("reset", onReset);
    form.addEventListener("submit", onSubmit);
    form.addEventListener(ACTION_RESULT_EVENT, onResult);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
      form.removeEventListener("reset", onReset);
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener(ACTION_RESULT_EVENT, onResult);
    };
  }, [formId]);

  const visible = alwaysVisible || !hydrated || dirty || pending;
  return (
    <div
      className={cx(
        "sticky bottom-0 z-30 -mx-4 mt-6 transition-transform md:-mx-6",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full opacity-0",
      )}
      aria-hidden={visible ? undefined : true}
    >
      <div className="bg-admin-seitenleiste text-admin-seitenleiste-text flex h-16 items-center gap-2 px-4 md:h-14 md:px-6">
        <Icon name="info" size={18} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium">
          <span className="md:hidden">Nicht gespeichert</span>
          <span className="max-md:hidden">{message}</span>
        </p>
        <button
          type="reset"
          form={formId}
          tabIndex={visible ? undefined : -1}
          className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-4 text-[14px] font-bold md:h-9"
        >
          {discardLabel}
        </button>
        <button
          type="submit"
          form={formId}
          disabled={pending}
          tabIndex={visible ? undefined : -1}
          className="rounded-admin-badge bg-admin-seitenleiste-aktiv text-admin-seitenleiste-aktiv-text hover:bg-admin-karte h-11 px-4 text-[14px] font-bold disabled:opacity-60 md:h-9"
        >
          {pending ? "Wird gespeichert …" : saveLabel}
        </button>
      </div>
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}
