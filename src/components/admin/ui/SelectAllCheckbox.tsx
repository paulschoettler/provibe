"use client";

import { useEffect, useRef, useState } from "react";
import { CheckboxBox } from "./fields";

/**
 * "Alle auswählen" im Tabellenkopf: schaltet alle Zeilen-Checkboxen desselben Formulars um und
 * zeigt den Teilweise-Zustand. Ohne JavaScript bleibt die Auswahl pro Zeile möglich.
 */
export function SelectAllCheckbox({ formId, name }: { formId: string; name: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"none" | "some" | "all">("none");

  useEffect(() => {
    const boxes = () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][data-row-select][form="${CSS.escape(formId)}"][name="${CSS.escape(name)}"]`,
        ),
      );
    const update = () => {
      const all = boxes();
      // Desktop-Tabelle und mobile Karten haben je eine Checkbox pro Zeile: nach Wert zählen
      const values = new Set(all.map((b) => b.value));
      const checked = new Set(all.filter((b) => b.checked).map((b) => b.value));
      setState(checked.size === 0 ? "none" : checked.size === values.size ? "all" : "some");
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (!t.matches?.("input[data-row-select]")) return;
      // Gegenstück (Karte oder Tabellenzeile) mitziehen
      boxes()
        .filter((b) => b !== t && b.value === t.value)
        .forEach((b) => (b.checked = t.checked));
      update();
    };
    document.addEventListener("change", onChange);
    update();
    return () => document.removeEventListener("change", onChange);
  }, [formId, name]);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);

  return (
    <CheckboxBox
      ref={ref}
      aria-label="Alle Zeilen auswählen"
      checked={state === "all"}
      onChange={(e) => {
        const on = e.currentTarget.checked;
        document
          .querySelectorAll<HTMLInputElement>(
            `input[type="checkbox"][data-row-select][form="${CSS.escape(formId)}"][name="${CSS.escape(name)}"]`,
          )
          .forEach((b) => (b.checked = on));
        setState(on ? "all" : "none");
      }}
    />
  );
}
