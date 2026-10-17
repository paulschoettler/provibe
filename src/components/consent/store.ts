import { logConsent } from "@/lib/tracking/actions";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  consentIdFromBytes,
  decideConsent,
  parseConsent,
  revokedVendors,
  serializeConsent,
  type ConsentState,
} from "@/lib/tracking/consent";

/**
 * Browser-Zustand der Einwilligung: liest und schreibt den Cookie pv_consent, benachrichtigt
 * Banner, Dialog und Tracking (useSyncExternalStore) und protokolliert über die Server Action.
 * Ohne JavaScript übernimmt saveConsentForm denselben Weg per Formular.
 */

const listeners = new Set<() => void>();
const OPEN_EVENT = "pv:consent-open";

export function readConsentRaw(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match ? match[1] : "";
}

export function subscribeConsent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server-Snapshot: unbekannt. Das Banner steht deshalb immer im Server-HTML. */
export function serverConsentRaw(): string | null {
  return null;
}

function newId(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return consentIdFromBytes(bytes);
}

function writeCookie(value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  document.documentElement.setAttribute("data-consent-decided", "");
  for (const listener of listeners) listener();
}

/**
 * Speichert eine Entscheidung: Cookie sofort (Wirkung ohne Wartezeit), danach Protokoll und
 * Set-Cookie über den Server. Wurde eine Einwilligung entzogen, lädt die Seite neu, damit bereits
 * geladene Anbieter-Skripte wirklich weg sind.
 */
export async function saveConsent(
  choice: "alle" | "notwendig" | "auswahl",
  selected: readonly string[] = [],
): Promise<ConsentState> {
  const previousRaw = readConsentRaw();
  const previous = parseConsent(previousRaw);
  const next = decideConsent(choice, selected, previous, { id: newId(), now: Date.now() });
  const value = serializeConsent(next);
  writeCookie(value);
  const page = `${window.location.pathname}`;
  const logged = logConsent({ value, previous: previousRaw || null, page }).catch(() => ({
    ok: false,
  }));
  if (revokedVendors(previous, next).length > 0) {
    await logged;
    window.location.reload();
  }
  return next;
}

/** Öffnet den Einstellungsdialog (Banner-Link, Footer-Link, beliebige Stelle). */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenConsentSettings(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
