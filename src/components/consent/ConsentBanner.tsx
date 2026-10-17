"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type FormEvent } from "react";
import { saveConsentForm } from "@/lib/tracking/actions";
import { isCurrentConsent, parseConsent } from "@/lib/tracking/consent";
import { CONSENT_PAGE_PATH, PRIVACY_PATH } from "@/lib/tracking/vendors";
import { readConsentRaw, saveConsent, serverConsentRaw, subscribeConsent } from "./store";

/**
 * Consent-Banner (Figma 75:1849 mobil, 75:2078 Desktop): unten, ohne Schließen-X, zwei
 * gleichwertige Buttons (gleiche Größe, Farbe, Schrift), Link zu den Einstellungen.
 *
 * Steht immer im Server-HTML (das Layout bleibt statisch). Ein kleines Inline-Skript in
 * ConsentRoot blendet es vor dem ersten Zeichnen aus, wenn schon eine Entscheidung vorliegt.
 * Liegt fest über der Seite (keine Layout-Verschiebung), nicht modal, nimmt beim Laden keinen
 * Fokus und ist per Tab erreichbar. Ohne JavaScript speichern die Buttons per Formular.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, serverConsentRaw);
  const decided = raw !== null && isCurrentConsent(parseConsent(raw));

  // Hat das Inline-Skript einen veralteten oder kaputten Cookie für gültig gehalten, Banner zeigen
  useEffect(() => {
    if (raw !== null && !decided) {
      document.documentElement.removeAttribute("data-consent-decided");
    }
  }, [raw, decided]);

  if (decided || pathname?.startsWith("/admin")) return null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void saveConsent(submitter?.value === "alle" ? "alle" : "notwendig");
  }

  return (
    <section
      className="pv-consent-banner"
      aria-labelledby="pv-consent-title"
      data-consent-banner=""
    >
      <div className="pv-consent-head">
        <Image src="/images/consent/cookie.svg" alt="" width={24} height={24} unoptimized />
        <h2 id="pv-consent-title" className="pv-consent-title">
          Kurz zu Cookies
        </h2>
      </div>
      <p className="pv-consent-text" id="pv-consent-text">
        Wir nutzen notwendige Cookies, damit Warenkorb und Kasse laufen. Mit deinem Okay zeigen wir
        dir passende Werbung bei Meta, Google und TikTok und messen, ob unsere Anzeigen
        funktionieren (Marketing). Deine Wahl kannst du jederzeit unter „Cookie-Einstellungen“ im
        Footer ändern. Mehr dazu in der{" "}
        <a href={PRIVACY_PATH} className="pv-consent-inline-link">
          Datenschutzerklärung
        </a>
        .
      </p>
      <form action={saveConsentForm} onSubmit={onSubmit} className="pv-consent-actions">
        <button type="submit" name="wahl" value="alle" className="pv-consent-btn">
          Alle akzeptieren
        </button>
        <button type="submit" name="wahl" value="notwendig" className="pv-consent-btn">
          Nur notwendige
        </button>
      </form>
      <a href={CONSENT_PAGE_PATH} className="pv-consent-link" data-consent-open="">
        Einstellungen
      </a>
    </section>
  );
}

export default ConsentBanner;
