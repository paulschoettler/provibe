"use client";

import { useRef } from "react";
import { cx } from "@/components/admin/ui/cx";

/**
 * Sechs Ziffernfelder (Figma 27:4488): 56 px hoch, Abstand 8 px, Ziffer 24 px SemiBold.
 * Felder d1 bis d6; mit JavaScript springt der Fokus weiter, Einfügen verteilt den ganzen Code.
 * autocomplete="one-time-code" am ersten Feld, damit Passwortmanager den Code einsetzen können.
 */
export function CodeInput({ invalid, autoFocus }: { invalid?: boolean; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (start: number, digits: string) => {
    const chars = digits
      .replace(/\D/g, "")
      .slice(0, 6 - start)
      .split("");
    chars.forEach((c, i) => {
      const el = refs.current[start + i];
      if (el) el.value = c;
    });
    const nextIndex = Math.min(start + chars.length, 5);
    refs.current[nextIndex]?.focus();
    if (start + chars.length >= 6) {
      // Vollständig: absenden (wie bei Shopify und den meisten Authenticator-Masken)
      refs.current[5]?.form?.requestSubmit();
    }
  };

  return (
    <fieldset>
      <legend className="sr-only">Sechsstelliger Code</legend>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            name={`d${i + 1}`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={i === 0 ? 6 : 1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            aria-label={`Ziffer ${i + 1} von 6`}
            aria-invalid={invalid || undefined}
            onInput={(e) => {
              const value = e.currentTarget.value;
              if (value.length > 1) {
                e.currentTarget.value = "";
                fill(i, value);
              } else if (/\d/.test(value)) {
                if (i < 5) refs.current[i + 1]?.focus();
                else if (refs.current.every((r) => r?.value))
                  refs.current[5]?.form?.requestSubmit();
              } else {
                e.currentTarget.value = "";
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !e.currentTarget.value && i > 0)
                refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/\d/.test(text)) {
                e.preventDefault();
                fill(i, text);
              }
            }}
            className={cx(
              "rounded-admin-feld bg-admin-karte h-14 w-full min-w-0 flex-1 text-center text-[24px] font-semibold tabular-nums outline-none",
              invalid
                ? "border-admin-rot border-2"
                : "border-admin-rahmen-stark focus:border-admin-akzent border focus:border-2",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
