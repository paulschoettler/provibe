/**
 * Einwilligung (TDDDG § 25, DSGVO Art. 6 Abs. 1 lit. a, Art. 7): Datenmodell, Cookie-Format und
 * die Entscheidung, ob ein Dienst laden darf. Rein, im Browser und auf dem Server nutzbar.
 *
 * Cookie "pv_consent", 12 Monate (365 Tage), nicht httpOnly, weil der Browser den Stand lesen
 * muss, bevor er ein Skript lädt. Inhalt ohne personenbezogene Daten, Felder mit "~" getrennt:
 *
 *   <Textversion>~<Kennung>~<Zeitpunkt in Unix-Sekunden>~<Auswahl>
 *   2026-10-17~k3j4h5g6f7d8s9a0q1w2~1760702400~mgt
 *
 * Auswahl: "-" für nur notwendige, sonst Buchstaben in fester Reihenfolge: s = Statistik
 * (derzeit kein Anbieter), m = Meta, g = Google Ads, t = TikTok. Die Kennung ist eine Zufallszahl
 * ohne Bezug zur Person; sie verknüpft den Cookie mit den Zeilen in consent_logs (Nachweis).
 */

export const CONSENT_COOKIE = "pv_consent";
/** 12 Monate. Danach fragt das Banner erneut. */
export const CONSENT_MAX_AGE_DAYS = 365;
export const CONSENT_MAX_AGE_SECONDS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
/**
 * Version des Banner- und Einstellungstexts. Erhöhen, sobald sich Text, Kategorien oder Anbieter
 * ändern (zum Beispiel wenn ein Statistik-Dienst dazukommt): Alle Besucher werden dann neu gefragt.
 */
export const CONSENT_VERSION = "2026-10-17";

export const MARKETING_VENDORS = ["meta", "google", "tiktok"] as const;
export type MarketingVendor = (typeof MARKETING_VENDORS)[number];

const VENDOR_LETTER: Record<MarketingVendor, string> = { meta: "m", google: "g", tiktok: "t" };

export interface ConsentState {
  version: string;
  /** Zufällige Kennung (16 bis 32 Zeichen a-z0-9), verknüpft mit consent_logs.anonymous_id */
  id: string;
  /** Zeitpunkt der Entscheidung in Unix-Sekunden (UTC) */
  ts: number;
  /** Statistik: derzeit ohne Anbieter (H25), deshalb immer false */
  analytics: boolean;
  /** Eingewilligte Marketing-Dienste; Marketing gilt als erteilt, wenn mindestens einer drin ist */
  vendors: MarketingVendor[];
}

export type ConsentAction = "accept_all" | "reject_all" | "custom" | "withdraw";

const ID_RE = /^[a-z0-9]{16,32}$/;
const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const FLAGS_RE = /^(-|s?m?g?t?)$/;

export function isValidConsentId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** Dienste in fester Reihenfolge, ohne Doppelte und Unbekannte. */
export function normalizeVendors(input: readonly unknown[]): MarketingVendor[] {
  return MARKETING_VENDORS.filter((v) => input.includes(v));
}

export function serializeConsent(state: ConsentState): string {
  const flags =
    (state.analytics ? "s" : "") +
    normalizeVendors(state.vendors)
      .map((v) => VENDOR_LETTER[v])
      .join("");
  return [state.version, state.id, String(Math.floor(state.ts)), flags || "-"].join("~");
}

/** Liest den Cookie-Wert; alles, was nicht exakt dem Format entspricht, gilt als keine Entscheidung. */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw || raw.length > 120) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const parts = value.split("~");
  if (parts.length !== 4) return null;
  const [version, id, tsText, flags] = parts;
  if (!VERSION_RE.test(version) || !ID_RE.test(id) || !/^\d{9,11}$/.test(tsText)) return null;
  if (!FLAGS_RE.test(flags) || flags === "") return null;
  const ts = Number(tsText);
  return {
    version,
    id,
    ts,
    analytics: flags.includes("s"),
    vendors: MARKETING_VENDORS.filter((v) => flags.includes(VENDOR_LETTER[v])),
  };
}

/** Gültige Entscheidung zur aktuellen Textversion? Sonst zeigt das Banner sich erneut. */
export function isCurrentConsent(
  state: ConsentState | null,
  version = CONSENT_VERSION,
): state is ConsentState {
  return state !== null && state.version === version;
}

export function hasMarketingConsent(state: ConsentState | null): boolean {
  return isCurrentConsent(state) && state.vendors.length > 0;
}

/** Konfigurierte Dienste (nur IDs der aktivierten Dienste, siehe config.ts). */
export interface ActiveVendorIds {
  meta: string | null;
  google: string | null;
  tiktok: string | null;
}

/**
 * Darf ein Dienst laden? Nur mit gültiger, aktueller Einwilligung für genau diesen Dienst, mit
 * eingetragener ID und nicht auf einer Seite mit Zugangs-Token in der Adresse (paths.ts).
 */
export function mayLoad(
  vendor: MarketingVendor,
  state: ConsentState | null,
  ids: ActiveVendorIds | null,
  options: { sensitivePath?: boolean } = {},
): boolean {
  if (options.sensitivePath) return false;
  if (!ids || !ids[vendor]) return false;
  if (!isCurrentConsent(state)) return false;
  return state.vendors.includes(vendor);
}

export function allowedVendors(
  state: ConsentState | null,
  ids: ActiveVendorIds | null,
  options: { sensitivePath?: boolean } = {},
): MarketingVendor[] {
  return MARKETING_VENDORS.filter((v) => mayLoad(v, state, ids, options));
}

/** Neue Entscheidung aus der Auswahl im Banner, Dialog oder Formular. */
export function decideConsent(
  choice: "alle" | "notwendig" | "auswahl",
  selected: readonly unknown[],
  previous: ConsentState | null,
  context: { id: string; now: number; version?: string },
): ConsentState {
  const vendors =
    choice === "alle"
      ? [...MARKETING_VENDORS]
      : choice === "notwendig"
        ? []
        : normalizeVendors(selected);
  return {
    version: context.version ?? CONSENT_VERSION,
    id: previous && isValidConsentId(previous.id) ? previous.id : context.id,
    ts: Math.floor(context.now / 1000),
    analytics: false,
    vendors,
  };
}

/** Art der Entscheidung für consent_logs.action. */
export function consentAction(previous: ConsentState | null, next: ConsentState): ConsentAction {
  if (hasMarketingConsent(previous) && next.vendors.length === 0) return "withdraw";
  if (next.vendors.length === MARKETING_VENDORS.length) return "accept_all";
  if (next.vendors.length === 0) return "reject_all";
  return "custom";
}

/** Kategorien für consent_logs.categories (jsonb). */
export function consentCategories(state: ConsentState) {
  return {
    necessary: true,
    analytics: state.analytics,
    marketing: state.vendors.length > 0,
    vendors: Object.fromEntries(MARKETING_VENDORS.map((v) => [v, state.vendors.includes(v)])),
  };
}

/** Dienste, deren Einwilligung gerade entzogen wurde (für Aufräumen und Neuladen). */
export function revokedVendors(
  previous: ConsentState | null,
  next: ConsentState,
): MarketingVendor[] {
  if (!isCurrentConsent(previous)) return [];
  return previous.vendors.filter((v) => !next.vendors.includes(v));
}

/** Zufällige Kennung aus 16 Zufallsbytes, Base-36-artig (a-z0-9), 20 Zeichen. */
export function consentIdFromBytes(bytes: Uint8Array): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 20; i++) out += alphabet[bytes[i % bytes.length] % alphabet.length];
  return out;
}
