"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { cx } from "@/components/admin/ui/cx";
import { inputClasses, Textarea } from "@/components/admin/ui/fields";
import { Icon } from "@/components/admin/ui/Icon";

/**
 * Einfacher Texteditor für Beschreibungen (Figma Produkt-Editor, Karte Allgemein): Absatz oder
 * Zwischenüberschrift, fett, kursiv, Listen, Link. Ohne JavaScript ist es ein Textfeld mit HTML.
 * Gespeichert wird HTML, das der Server mit sanitizeHtml bereinigt (Allowlist, keine Attribute
 * außer href und title an Links); erlaubte Tags siehe src/lib/admin/products/sanitize.ts.
 */
function noop() {
  return () => {};
}

export function RichTextEditor({
  name,
  label,
  defaultValue,
  hint,
  disabled,
  minHeight = 160,
  inline,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  disabled?: boolean;
  minHeight?: number;
  /** nur Hervorhebungen, keine Überschriften und Listen (Zutatenliste) */
  inline?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const state = useActionFormState();
  const value =
    state.status === "error" && state.values && name in state.values
      ? state.values[name]
      : defaultValue;
  const error = state.fieldErrors?.[name];
  const id = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [block, setBlock] = useState("p");

  // Inhalt setzen (beim ersten Mal, nach Fehlern und nach dem Zurücksetzen des Formulars)
  useEffect(() => {
    if (!hydrated || !editorRef.current) return;
    editorRef.current.innerHTML = value || "";
    if (hiddenRef.current) hiddenRef.current.value = value || "";
  }, [hydrated, value]);

  // Zurücksetzen: nach dem Absenden (React setzt das Formular nach der Action zurück) bleibt der
  // Text stehen, das versteckte Feld folgt dem Editor. "Verwerfen" stellt den gespeicherten Text her.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    let submitted = false;
    const onSubmit = () => {
      submitted = true;
    };
    const onReset = () => {
      const keep = submitted;
      submitted = false;
      requestAnimationFrame(() => {
        if (!editorRef.current || !hiddenRef.current) return;
        if (keep) hiddenRef.current.value = editorRef.current.innerHTML;
        else {
          editorRef.current.innerHTML = valueRef.current || "";
          hiddenRef.current.value = valueRef.current || "";
        }
      });
    };
    form.addEventListener("submit", onSubmit);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("reset", onReset);
    };
  }, [hydrated]);

  if (!hydrated) {
    return (
      <Textarea
        name={name}
        label={label}
        defaultValue={value}
        rows={6}
        disabled={disabled}
        hint={hint ?? "HTML erlaubt: Absätze, fett, kursiv, Listen, Links."}
      />
    );
  }

  const sync = () => {
    if (!editorRef.current || !hiddenRef.current) return;
    hiddenRef.current.value = editorRef.current.innerHTML;
    // Formular als geändert melden (SaveBar)
    hiddenRef.current.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] leading-[1.4] font-medium">
        {label}
      </span>
      <div
        className={cx(
          "rounded-admin-feld overflow-hidden border",
          error ? "border-admin-rot border-2" : "border-admin-rahmen-stark",
          "focus-within:border-admin-akzent focus-within:border-2",
        )}
      >
        <div
          role="toolbar"
          aria-label={`Formatierung ${label}`}
          className="border-admin-rahmen bg-admin-flaeche flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
        >
          {!inline ? (
            <label className="relative mr-1">
              <span className="sr-only">Absatzformat</span>
              <select
                value={block}
                disabled={disabled}
                onChange={(e) => {
                  setBlock(e.target.value);
                  exec("formatBlock", e.target.value);
                }}
                className={inputClasses(
                  false,
                  "h-9! w-auto appearance-none bg-transparent pr-7 text-[13px] md:h-8!",
                )}
              >
                <option value="p">Absatz</option>
                <option value="h2">Überschrift</option>
                <option value="h3">Unterüberschrift</option>
              </select>
              <span className="text-admin-text-2 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                <Icon name="chevron-unten" size={14} />
              </span>
            </label>
          ) : null}
          <ToolButton label="Fett" disabled={disabled} onClick={() => exec("bold")}>
            B
          </ToolButton>
          <ToolButton label="Kursiv" disabled={disabled} onClick={() => exec("italic")}>
            <span className="italic">I</span>
          </ToolButton>
          {!inline ? (
            <ToolButton
              label="Aufzählung"
              disabled={disabled}
              onClick={() => exec("insertUnorderedList")}
            >
              <Icon name="liste" size={16} />
            </ToolButton>
          ) : null}
          {!inline ? (
            <ToolButton
              label="Nummerierte Liste"
              disabled={disabled}
              onClick={() => exec("insertOrderedList")}
            >
              1.
            </ToolButton>
          ) : null}
          {!inline ? (
            <ToolButton
              label="Link einfügen"
              disabled={disabled}
              onClick={() => {
                const url = window.prompt("Adresse des Links (https://… oder /pfad)");
                if (url) exec("createLink", url);
              }}
            >
              <Icon name="link" size={16} />
            </ToolButton>
          ) : null}
          <ToolButton
            label="Formatierung entfernen"
            disabled={disabled}
            onClick={() => exec("removeFormat")}
          >
            <Icon name="schliessen" size={16} />
          </ToolButton>
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-fehler` : hint ? `${id}-hinweis` : undefined}
          aria-invalid={error ? true : undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          style={{ minHeight }}
          className="kat-richtext bg-admin-karte px-3 py-2.5 text-[14px] leading-[1.5] outline-none"
        />
      </div>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={value} />
      {error ? (
        <p id={`${id}-fehler`} className="text-admin-rot flex items-start gap-1 text-[12px]">
          <Icon name="warnung" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hinweis`} className="text-admin-text-2 text-[12px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-admin-feld hover:bg-admin-karte flex size-11 items-center justify-center text-[14px] font-semibold md:size-8"
    >
      {children}
    </button>
  );
}
