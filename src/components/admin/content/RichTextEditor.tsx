"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { sanitizeRichHtml } from "@/lib/admin/content/sanitize";
import { useActionFormState } from "@/components/admin/ui/ActionForm";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { inputClasses } from "@/components/admin/ui/fields";

/**
 * Einfacher Editor für Seiten, Rechtstexte und Blog (Figma 41:13808: Werkzeugleiste H, B, I,
 * Liste, Link). Ohne JavaScript ein Textfeld mit HTML (gleicher Feldname), mit JavaScript ein
 * bearbeitbarer Bereich, dessen HTML in ein verstecktes Feld geschrieben wird. Der Server
 * bereinigt jedes Speichern mit sanitizeRichHtml (Whitelist); hier wird beim Umschalten aus der
 * HTML-Ansicht zusätzlich bereinigt, damit im Backoffice kein eingefügtes Skript läuft.
 */
export function RichTextEditor({
  name,
  label,
  defaultValue,
  hint,
  disabled,
  minHeight = 320,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  disabled?: boolean;
  minHeight?: number;
}) {
  const id = useId();
  const state = useActionFormState();
  const error = state.fieldErrors?.[name];
  const initial =
    state.status === "error" && state.values && name in state.values
      ? state.values[name]
      : defaultValue;
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const initialRef = useRef(initial);
  const [source, setSource] = useState(false);

  // Startinhalt einmal setzen und bei "Verwerfen" (Formular-Reset) wiederherstellen
  useEffect(() => {
    if (!hydrated || !editorRef.current) return;
    editorRef.current.innerHTML = sanitizeRichHtml(initialRef.current);
    const form = hiddenRef.current?.form;
    const onReset = () => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeRichHtml(initialRef.current);
      setSource(false);
    };
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, [hydrated]);

  const sync = () => {
    if (hiddenRef.current && editorRef.current && !source)
      hiddenRef.current.value = editorRef.current.innerHTML;
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const toggleHeading = () => {
    const block = document.queryCommandValue("formatBlock").toLowerCase();
    exec("formatBlock", block === "h2" ? "<p>" : "<h2>");
  };

  const addLink = () => {
    const url = window.prompt("Link-Adresse (https://… oder /pages/…)", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|\/|mailto:)/i.test(url.trim())) {
      window.alert("Bitte gib einen Link mit https://, / oder mailto: an.");
      return;
    }
    exec("createLink", url.trim());
  };

  const toggleSource = () => {
    if (!hiddenRef.current || !editorRef.current) return;
    if (source) {
      const clean = sanitizeRichHtml(hiddenRef.current.value);
      editorRef.current.innerHTML = clean;
      hiddenRef.current.value = clean;
      setSource(false);
    } else {
      hiddenRef.current.value = editorRef.current.innerHTML;
      setSource(true);
    }
  };

  const describedBy = error ? `${id}-fehler` : hint ? `${id}-hinweis` : undefined;

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label} (HTML)
        </label>
        <textarea
          id={id}
          name={name}
          defaultValue={initial}
          rows={16}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClasses(
            Boolean(error),
            "h-auto! py-2.5 font-mono text-[13px] leading-[1.5]",
          )}
        />
        <Note id={id} hint={hint} error={error} />
      </div>
    );
  }

  const runTool = (key: ToolKey) => {
    if (key === "heading") toggleHeading();
    else if (key === "link") addLink();
    else exec(key);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium">
        {label}
      </span>
      <div
        className={cx(
          "rounded-admin-feld bg-admin-karte overflow-hidden border",
          error ? "border-admin-rot border-2" : "border-admin-rahmen-stark",
        )}
      >
        <div
          role="toolbar"
          aria-label={`${label}: Formatierung`}
          className="border-admin-rahmen bg-admin-flaeche flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
        >
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runTool(t.key)}
              disabled={disabled || source}
              aria-label={t.label}
              title={t.label}
              className="rounded-admin-feld hover:bg-admin-karte flex size-11 items-center justify-center text-[15px] font-semibold disabled:opacity-40 md:size-9"
            >
              {t.icon ? <Icon name={t.icon} size={18} /> : <span aria-hidden="true">{t.text}</span>}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={toggleSource}
            disabled={disabled}
            aria-pressed={source}
            className="rounded-admin-feld hover:bg-admin-karte text-admin-text-2 h-11 px-3 text-[13px] font-medium md:h-9"
          >
            {source ? "Zur Ansicht" : "HTML"}
          </button>
        </div>
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          contentEditable={!disabled && !source}
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          hidden={source}
          style={{ minHeight }}
          className="admin-inhalte-prosa max-h-[70vh] overflow-y-auto px-4 py-3 text-[14px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-admin-akzent)] focus-visible:ring-inset"
        />
        <textarea
          ref={hiddenRef}
          name={name}
          defaultValue={initial}
          hidden={!source}
          aria-label={`${label} als HTML`}
          rows={16}
          disabled={disabled}
          className="w-full px-4 py-3 font-mono text-[13px] leading-[1.5] outline-none"
        />
      </div>
      <Note id={id} hint={hint} error={error} />
    </div>
  );
}

function Note({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error)
    return (
      <p id={`${id}-fehler`} className="text-admin-rot flex items-start gap-1 text-[12px]">
        <span className="mt-px">
          <Icon name="warnung" size={14} />
        </span>
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-hinweis`} className="text-admin-text-2 text-[12px]">
        {hint}
      </p>
    );
  return null;
}

type ToolKey =
  "heading" | "bold" | "italic" | "insertUnorderedList" | "insertOrderedList" | "link" | "unlink";

const TOOLS: { key: ToolKey; label: string; icon?: "liste" | "link"; text?: string }[] = [
  { key: "heading", label: "Zwischenüberschrift", text: "H" },
  { key: "bold", label: "Fett", text: "B" },
  { key: "italic", label: "Kursiv", text: "I" },
  { key: "insertUnorderedList", label: "Aufzählung", icon: "liste" },
  { key: "insertOrderedList", label: "Nummerierte Liste", text: "1." },
  { key: "link", label: "Link einfügen", icon: "link" },
  { key: "unlink", label: "Link entfernen", text: "⌀" },
];

function noop() {
  return () => {};
}
