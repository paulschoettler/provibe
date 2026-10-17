"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloseLineIcon } from "@/components/catalog/icons";
import { isCurrentConsent, parseConsent } from "@/lib/tracking/consent";
import { ConsentForm, type ActiveVendors } from "./ConsentForm";
import { onOpenConsentSettings, readConsentRaw, serverConsentRaw, subscribeConsent } from "./store";

/**
 * Einstellungsdialog (natives <dialog>, Fokusfalle und Escape vom Browser). Öffnet über den Link
 * "Einstellungen" im Banner, den Footer-Link "Cookie-Einstellungen" und jedes Element mit
 * data-consent-open. Ohne JavaScript führen dieselben Links auf /cookie-einstellungen.
 * Mobil als Bottom Sheet (Figma 75:1900), ab Tablet zentriert (75:2130).
 */
export function ConsentDialog({ activeVendors }: { activeVendors: ActiveVendors }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, serverConsentRaw);
  const consent = raw === null ? null : parseConsent(raw);
  const current = isCurrentConsent(consent) ? consent.vendors : [];

  useEffect(() => {
    const show = () => {
      setWide(window.matchMedia("(min-width: 768px)").matches);
      setOpenCount((n) => n + 1);
      setIsOpen(true);
      if (ref.current && !ref.current.open) ref.current.showModal();
    };
    const off = onOpenConsentSettings(show);
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target instanceof Element ? e.target.closest("[data-consent-open]") : null;
      if (!target) return;
      e.preventDefault();
      show();
    };
    document.addEventListener("click", onClick);
    return () => {
      off();
      document.removeEventListener("click", onClick);
    };
  }, []);

  function close() {
    ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className="pv-consent-dialog"
      aria-labelledby="pv-consent-dialog-title"
      onClose={() => setIsOpen(false)}
      onClick={(e) => {
        // Klick auf die Abdunklung schließt (das Ziel ist dann das dialog-Element selbst)
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pv-consent-sheet">
        <span className="pv-consent-grip" aria-hidden="true" />
        <div className="pv-consent-dialog-head">
          <h2 id="pv-consent-dialog-title">Cookie-Einstellungen</h2>
          <button type="button" className="pv-consent-close" onClick={close} aria-label="Schließen">
            <CloseLineIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="pv-consent-intro">
          Du entscheidest, was wir nutzen dürfen. Ohne dein Okay bleibt Marketing aus.
        </p>
        {isOpen ? (
          <ConsentForm
            key={openCount}
            idPrefix="pv-cd"
            variant="dialog"
            initialVendors={current}
            activeVendors={activeVendors}
            vendorsOpen={wide}
            onSaved={close}
          />
        ) : null}
      </div>
    </dialog>
  );
}

export default ConsentDialog;
