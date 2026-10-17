"use client";

import { useEffect, useRef } from "react";

/**
 * Im Formular platzieren: Auswahlfelder (select, Checkbox, Datum) schicken das Formular bei
 * Änderung sofort ab. Textfelder nicht, die schickt Enter oder der Button ab.
 */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      if (
        t instanceof HTMLSelectElement ||
        ["checkbox", "radio", "date"].includes((t as HTMLInputElement).type)
      ) {
        form.requestSubmit();
      }
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return <span ref={ref} hidden />;
}
