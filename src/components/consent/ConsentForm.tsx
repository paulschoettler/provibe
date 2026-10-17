"use client";

import { useState, type FormEvent } from "react";
import { saveConsentForm } from "@/lib/tracking/actions";
import { MARKETING_VENDORS, type MarketingVendor } from "@/lib/tracking/consent";
import {
  IMPRINT_PATH,
  MARKETING_HELPER_COOKIE,
  NECESSARY_COOKIES,
  PRIVACY_PATH,
  VENDOR_INFO,
} from "@/lib/tracking/vendors";
import { saveConsent } from "./store";

export type ActiveVendors = Record<MarketingVendor, boolean>;

interface ConsentFormProps {
  /** Eindeutiges Präfix für IDs (Dialog und Seite können gleichzeitig existieren) */
  idPrefix: string;
  variant: "dialog" | "page";
  initialVendors: MarketingVendor[];
  /** Für welche Dienste eine ID eingetragen ist (sonst Hinweis "derzeit nicht im Einsatz") */
  activeVendors: ActiveVendors;
  /** Ziel nach dem Speichern ohne JavaScript; leer heißt: zurück zur aufrufenden Seite */
  returnTo?: string;
  /** Anbieterliste offen anzeigen (Seite, Dialog ab Tablet) */
  vendorsOpen?: boolean;
  onSaved?: () => void;
}

function Switch({
  id,
  name,
  value,
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange,
}: {
  id: string;
  name?: string;
  value?: string;
  checked: boolean;
  disabled?: boolean;
  labelledBy: string;
  describedBy?: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <span className="pv-switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onChange={(e) => onChange?.(e.target.checked)}
        className="pv-switch-input"
      />
      <span className="pv-switch-track" aria-hidden="true" />
    </span>
  );
}

/**
 * Kategorien und Anbieter (Figma 75:1900 mobil, 75:2130 Desktop): Notwendig (immer an),
 * Statistik (ausgegraut, derzeit kein Anbieter, H25), Marketing mit Schaltern je Anbieter und
 * Angaben zu Zweck, Anbieter, Speicherdauer und Datenschutz. Funktioniert ohne JavaScript als
 * normales Formular (saveConsentForm), mit JavaScript sofort ohne Seitenwechsel.
 */
export function ConsentForm({
  idPrefix: p,
  variant,
  initialVendors,
  activeVendors,
  returnTo,
  vendorsOpen,
  onSaved,
}: ConsentFormProps) {
  const [vendors, setVendors] = useState<MarketingVendor[]>(initialVendors);
  const [saved, setSaved] = useState<string | null>(null);
  const hadConsent = initialVendors.length > 0;
  const marketingOn = vendors.length > 0;

  function setVendor(vendor: MarketingVendor, on: boolean) {
    setVendors((current) =>
      MARKETING_VENDORS.filter((v) => (v === vendor ? on : current.includes(v))),
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const choice =
      submitter?.value === "alle"
        ? "alle"
        : submitter?.value === "notwendig"
          ? "notwendig"
          : "auswahl";
    const next = await saveConsent(choice, vendors);
    setVendors(next.vendors);
    setSaved(
      next.vendors.length
        ? "Gespeichert. Deine Auswahl gilt ab sofort."
        : "Gespeichert. Es laufen nur notwendige Cookies.",
    );
    onSaved?.();
  }

  return (
    <form
      action={saveConsentForm}
      onSubmit={onSubmit}
      className={`pv-consent-form pv-consent-form--${variant}`}
    >
      {returnTo ? <input type="hidden" name="zurueck" value={returnTo} /> : null}

      <div className="pv-consent-cat" role="group" aria-labelledby={`${p}-nec`}>
        <div className="pv-consent-cat-head">
          <div className="pv-consent-cat-title">
            <h3 id={`${p}-nec`}>Notwendig</h3>
            <p className="pv-consent-cat-sub">Immer aktiv</p>
          </div>
          <Switch
            id={`${p}-nec-switch`}
            checked
            disabled
            labelledBy={`${p}-nec`}
            describedBy={`${p}-nec-text`}
          />
        </div>
        <p id={`${p}-nec-text`} className="pv-consent-cat-text">
          Warenkorb, Login, Kasse, Schutz vor Missbrauch und das Speichern deiner Cookie-Wahl. Ohne
          diese Cookies funktioniert der Shop nicht.
        </p>
        {variant === "page" ? (
          <details className="pv-consent-details">
            <summary>Cookies anzeigen ({NECESSARY_COOKIES.length})</summary>
            <ul className="pv-consent-cookie-list">
              {NECESSARY_COOKIES.map((c) => (
                <li key={c.name}>
                  <code>{c.name}</code>: {c.purpose}, {c.storage}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div
        className="pv-consent-cat pv-consent-cat--off"
        role="group"
        aria-labelledby={`${p}-stat`}
      >
        <div className="pv-consent-cat-head">
          <div className="pv-consent-cat-title">
            <h3 id={`${p}-stat`}>Statistik</h3>
            <p className="pv-consent-cat-sub">Derzeit nicht im Einsatz</p>
          </div>
          <Switch
            id={`${p}-stat-switch`}
            checked={false}
            disabled
            labelledBy={`${p}-stat`}
            describedBy={`${p}-stat-text`}
          />
        </div>
        <p id={`${p}-stat-text`} className="pv-consent-cat-text">
          Damit würden wir Besuche zählen und sehen, welche Seiten gut ankommen. Wir setzen dafür
          gerade keinen Dienst ein. Kommt einer dazu, fragen wir dich vorher.
        </p>
      </div>

      <div className="pv-consent-cat" role="group" aria-labelledby={`${p}-mkt`}>
        <div className="pv-consent-cat-head">
          <div className="pv-consent-cat-title">
            <h3 id={`${p}-mkt`}>Marketing</h3>
            <p className="pv-consent-cat-sub">
              {marketingOn ? `${vendors.length} von 3 an` : "Aus"}
            </p>
          </div>
          <Switch
            id={`${p}-mkt-switch`}
            name="marketing"
            value="1"
            checked={marketingOn}
            labelledBy={`${p}-mkt`}
            describedBy={`${p}-mkt-text`}
            onChange={(on) => setVendors(on ? [...MARKETING_VENDORS] : [])}
          />
        </div>
        <p id={`${p}-mkt-text`} className="pv-consent-cat-text">
          Damit zeigen wir dir passende Werbung und messen, ob unsere Anzeigen funktionieren.
        </p>
        <details className="pv-consent-details" open={vendorsOpen}>
          <summary>Anbieter anzeigen (3)</summary>
          <ul className="pv-consent-vendors">
            {MARKETING_VENDORS.map((id) => {
              const info = VENDOR_INFO[id];
              return (
                <li key={id} className="pv-consent-vendor">
                  <div className="pv-consent-vendor-head">
                    <div className="pv-consent-vendor-title">
                      <p id={`${p}-${id}`} className="pv-consent-vendor-name">
                        {info.name}
                        {!activeVendors[id] ? (
                          <span className="pv-consent-badge">derzeit nicht im Einsatz</span>
                        ) : null}
                      </p>
                      <p className="pv-consent-vendor-short">{info.short}</p>
                    </div>
                    <Switch
                      id={`${p}-${id}-switch`}
                      name="vendor"
                      value={id}
                      checked={vendors.includes(id)}
                      labelledBy={`${p}-${id}`}
                      describedBy={`${p}-${id}-info`}
                      onChange={(on) => setVendor(id, on)}
                    />
                  </div>
                  <dl id={`${p}-${id}-info`} className="pv-consent-vendor-info">
                    <dt>Zweck</dt>
                    <dd>{info.purpose}</dd>
                    <dt>Anbieter</dt>
                    <dd>{info.provider}</dd>
                    <dt>Speicherdauer</dt>
                    <dd>{info.storage}</dd>
                    <dt>Datenschutz</dt>
                    <dd>
                      <a href={info.privacyUrl} target="_blank" rel="noreferrer noopener">
                        Datenschutzhinweise von {info.name.split(" ")[0]}
                        <span className="sr-only"> (öffnet in neuem Tab)</span>
                      </a>
                    </dd>
                  </dl>
                </li>
              );
            })}
          </ul>
          {variant === "page" ? (
            <p className="pv-consent-cat-text pv-consent-helper">
              Mit Einwilligung zusätzlich: <code>{MARKETING_HELPER_COOKIE.name}</code>:{" "}
              {MARKETING_HELPER_COOKIE.purpose}, {MARKETING_HELPER_COOKIE.storage}.
            </p>
          ) : null}
        </details>
      </div>

      <div className="pv-consent-actions">
        <button type="submit" name="wahl" value="auswahl" className="pv-consent-btn">
          Auswahl speichern
        </button>
        <button type="submit" name="wahl" value="alle" className="pv-consent-btn">
          Alle akzeptieren
        </button>
      </div>
      {hadConsent ? (
        <button
          type="submit"
          name="wahl"
          value="notwendig"
          className="pv-consent-btn pv-consent-btn--wide"
        >
          Einwilligung widerrufen, nur notwendige
        </button>
      ) : null}

      <p className="pv-consent-status" role="status" aria-live="polite">
        {saved}
      </p>

      <p className="pv-consent-links">
        <a href={PRIVACY_PATH}>Datenschutzerklärung</a>
        <a href={IMPRINT_PATH}>Impressum</a>
      </p>
    </form>
  );
}

export default ConsentForm;
