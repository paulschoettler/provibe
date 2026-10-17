"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./Icon";
import { cx } from "./cx";

/**
 * Sticky Speichern-Leiste nach Figma (26:5219): Aubergine, "Ungespeicherte Änderungen",
 * Verwerfen und Speichern. Gehört zu einem Formular über formId (auch außerhalb des <form>).
 * Erscheint, sobald im Formular etwas geändert wurde; ohne JavaScript ist sie immer sichtbar.
 * Innerhalb des Formulars platziert zeigt der Speichern-Button den Sende-Zustand.
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
    const onChange = () => setDirty(true);
    const onReset = () => setDirty(false);
    const onSubmit = () => setDirty(false);
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    form.addEventListener("reset", onReset);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
      form.removeEventListener("reset", onReset);
      form.removeEventListener("submit", onSubmit);
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
          className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-4 text-[14px] font-semibold md:h-9"
        >
          {discardLabel}
        </button>
        <button
          type="submit"
          form={formId}
          disabled={pending}
          tabIndex={visible ? undefined : -1}
          className="rounded-admin-badge bg-admin-akzent text-admin-auf-akzent hover:bg-admin-akzent-hover h-11 px-4 text-[14px] font-semibold disabled:opacity-60 md:h-9"
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
