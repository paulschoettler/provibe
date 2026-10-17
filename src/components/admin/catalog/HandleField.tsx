"use client";

import { useEffect, useRef, useState } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { Field } from "@/components/admin/ui/fields";
import { slugifyHandle } from "@/lib/admin/products/rules";

/**
 * Handle-Feld mit Prüfung beim Tippen: Format (wie der Check-Constraint) und Eindeutigkeit über
 * eine Server Action. Bei neuen Datensätzen folgt der Handle dem Titel, bis man ihn selbst ändert.
 * Verbindlich prüft der Server beim Speichern.
 */
export function HandleField({
  name = "handle",
  label = "URL-Handle",
  defaultValue,
  prefix,
  exceptId,
  check,
  followTitle,
  titleName = "title",
  disabled,
  note,
}: {
  name?: string;
  label?: string;
  defaultValue: string;
  /** Pfad vor dem Handle, zum Beispiel "/products/" */
  prefix: string;
  exceptId?: string;
  check: (handle: string, exceptId?: string) => Promise<{ ok: boolean; message: string }>;
  followTitle?: boolean;
  titleName?: string;
  disabled?: boolean;
  note?: string;
}) {
  const state = useActionFormState();
  const serverError = state.fieldErrors?.[name];
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(Boolean(defaultValue));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!value || value === defaultValue) {
      setMsg(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setMsg(await check(value, exceptId));
      } catch {
        setMsg(null);
      }
    }, 350);
  };

  useEffect(() => {
    if (!followTitle) return;
    const input = ref.current?.querySelector("input");
    const form = input?.form;
    if (!input || !form) return;
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t === input) {
        touched.current = Boolean(input.value);
        return;
      }
      if (t.name !== titleName || touched.current) return;
      input.value = slugifyHandle(t.value);
      run(input.value);
    };
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followTitle, titleName]);

  return (
    <div ref={ref}>
      <Field
        name={name}
        label={label}
        defaultValue={defaultValue}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        error={serverError ?? (msg && !msg.ok ? msg.message : undefined)}
        hint={
          msg?.ok
            ? msg.message
            : (note ?? `provibe-drinks.de${prefix}…, leer lassen: aus dem Titel`)
        }
        onChange={(e) => run(e.currentTarget.value.trim().toLowerCase())}
      />
      <span className="sr-only" aria-live="polite">
        {msg?.message ?? ""}
      </span>
    </div>
  );
}
