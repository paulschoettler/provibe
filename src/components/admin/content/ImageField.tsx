"use client";

import { useRef, useState, useTransition } from "react";
import { uploadContentImageAction } from "@/lib/admin/content/actions";
import { contentImageUrl } from "@/lib/admin/content/image-url";
import { INITIAL_ACTION_STATE } from "@/components/admin/ui/action-state";
import { Button } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/fields";

/**
 * Bildfeld für Inhalte: Pfad als Textfeld (ohne JavaScript nutzbar, zum Beispiel
 * "media/content/bild.webp" oder "/images/…"), dazu Vorschau und Hochladen bis 2 MB.
 * Der Upload läuft als eigene Server Action, weil Formulare nicht verschachtelt sein dürfen;
 * danach steht der neue Pfad im Feld und wird mit dem umgebenden Formular gespeichert.
 */
export function ImageField({
  name,
  label,
  defaultValue,
  hint,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = contentImageUrl(value);

  const upload = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setMessage(null);
    startTransition(async () => {
      const result = await uploadContentImageAction(INITIAL_ACTION_STATE, fd);
      if (result.status === "ok" && typeof result.data?.path === "string") {
        const path = result.data.path;
        setValue(path);
        // Feld im Formular aktualisieren und SaveBar informieren
        const input = document.querySelector<HTMLInputElement>(`input[data-image-field="${name}"]`);
        if (input) {
          input.value = path;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setMessage({ tone: "ok", text: "Hochgeladen. Speichern nicht vergessen." });
      } else setMessage({ tone: "error", text: result.message ?? "Upload fehlgeschlagen." });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="bg-admin-flaeche rounded-admin-feld border-admin-rahmen flex size-16 shrink-0 items-center justify-center overflow-hidden border">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus Storage, keine Optimierung nötig
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-admin-text-2 text-[11px]">kein Bild</span>
          )}
        </div>
        <Field
          name={name}
          label={label}
          hint={hint ?? "Pfad im Speicher, zum Beispiel media/content/bild.webp"}
          defaultValue={defaultValue}
          disabled={disabled}
          data-image-field={name}
          onChange={(e) => setValue(e.currentTarget.value)}
          className="min-w-0 flex-1"
        />
      </div>
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) upload(file);
              e.currentTarget.value = "";
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            icon="upload"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? "Wird hochgeladen …" : "Bild hochladen"}
          </Button>
          {value ? (
            <Button
              size="sm"
              variant="text"
              onClick={() => {
                setValue("");
                const input = document.querySelector<HTMLInputElement>(
                  `input[data-image-field="${name}"]`,
                );
                if (input) {
                  input.value = "";
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                }
              }}
            >
              Entfernen
            </Button>
          ) : null}
          {message ? (
            <span
              role="status"
              className={
                message.tone === "error"
                  ? "text-admin-rot text-[12px]"
                  : "text-admin-gruen text-[12px]"
              }
            >
              {message.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
