"use client";

import { useEffect, useState } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { TOAST_COOKIE, type ToastData } from "./toast-shared";

/**
 * Toast nach Figma (26:5184): dunkel bei Erfolg, rot bei Fehler, 48 px, unten mittig.
 * Bekommt die Meldung vom Server (Cookie über flashToast oder ?toast=…), entfernt das Cookie
 * nach dem Anzeigen und blendet sich nach 6 Sekunden aus. Fehler bleiben, bis man sie schließt.
 * aria-live, damit Screenreader die Rückmeldung vorlesen.
 */
export function Toast({
  toast,
  action,
}: {
  toast: ToastData | null;
  /** optionaler Link, zum Beispiel "Rückgängig" */
  action?: { label: string; href: string };
}) {
  const [hidden, setHidden] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    document.cookie = `${TOAST_COOKIE}=; Max-Age=0; Path=/admin; SameSite=Lax`;
    if (toast.tone === "error") return;
    const timer = window.setTimeout(() => setHidden(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visible = toast && hidden !== toast.id;
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 md:bottom-6"
    >
      {visible ? (
        <div
          className={cx(
            "rounded-admin-karte shadow-admin-karte pointer-events-auto flex min-h-12 max-w-full items-center gap-3 px-4 py-2 text-[14px] text-white",
            toast.tone === "error" ? "bg-admin-rot" : "bg-admin-text",
          )}
        >
          <Icon name={toast.tone === "error" ? "warnung" : "haken"} size={18} />
          <p className="min-w-0 font-medium">{toast.message}</p>
          {action ? (
            <a href={action.href} className="font-semibold whitespace-nowrap underline">
              {action.label}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setHidden(toast.id)}
            aria-label="Meldung schließen"
            className="rounded-admin-feld -mr-2 flex size-8 shrink-0 items-center justify-center hover:bg-white/10"
          >
            <Icon name="schliessen" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
