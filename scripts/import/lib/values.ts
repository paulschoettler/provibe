/**
 * Werte aus Shopify-Exporten lesen: Spalten-Aliase, Geld in Cent, Datumswerte in UTC,
 * Ja/Nein, Namen. Reine Funktionen ohne Datenbank, getestet in __tests__/values.test.ts.
 */
import { z } from "zod";
import type { RawRow } from "./csv";

/** Erste nicht leere Spalte aus einer Alias-Liste (Groß/Kleinschreibung egal). */
export function pick(row: RawRow, aliases: readonly string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const key = keys.find((k) => k.toLowerCase() === a);
    if (key !== undefined) {
      const v = cleanText(row[key]);
      if (v !== "") return v;
    }
  }
  return "";
}

/** Gibt es irgendeine der Spalten in der Kopfzeile? */
export function hasColumn(headers: readonly string[], aliases: readonly string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  return aliases.some((a) => lower.includes(a.toLowerCase()));
}

/**
 * Shopify setzt vor IDs und Telefonnummern ein Apostroph, damit Excel sie nicht als Zahl
 * umformatiert ('+4917...). Das Apostroph und Leerraum am Rand fallen weg.
 */
export function cleanText(value: string | undefined | null): string {
  if (value == null) return "";
  return value
    .trim()
    .replace(/^'(?=[+\d])/, "")
    .trim();
}

export function nullable(value: string): string | null {
  return value === "" ? null : value;
}

/**
 * Geldbetrag in Cent ohne Fließkommafehler. Erlaubt "26.10", "26,10", "1,234.56", "1.234,56",
 * "€26.10", "-10.0", "10 €". Leer ergibt null, Unlesbares wirft.
 */
export function parseMoneyCents(input: string): number | null {
  let s = cleanText(input).replace(/[€\s]|EUR/gi, "");
  if (s === "") return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let fracPart = "";
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    const cleaned = s.split(thousands).join("");
    [intPart, fracPart = ""] = cleaned.split(decimal);
  } else if (lastComma >= 0) {
    // "26,10" ist Dezimal, "1,234" (genau drei Ziffern, ohne weitere) Tausender
    if (/^\d{1,3}(,\d{3})+$/.test(s) && !/^\d+,\d{1,2}$/.test(s)) {
      intPart = s.split(",").join("");
    } else {
      [intPart, fracPart = ""] = s.split(",");
    }
  } else if (lastDot >= 0 && s.indexOf(".") !== lastDot) {
    intPart = s.split(".").join(""); // "1.234.567"
  } else {
    [intPart, fracPart = ""] = s.split(".");
  }
  if (!/^\d+$/.test(intPart || "0") || !/^\d*$/.test(fracPart)) {
    throw new Error(`Betrag nicht lesbar: "${input}"`);
  }
  const frac = (fracPart + "000").slice(0, 3);
  let cents = Number(intPart || "0") * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1; // kaufmännisch auf ganze Cent
  return negative ? -cents : cents;
}

export function parseMoneyOrZero(input: string): number {
  return parseMoneyCents(input) ?? 0;
}

/** Ganze Zahl oder null ("12", "12.0"); Unlesbares wirft. */
export function parseIntOrNull(input: string): number | null {
  const s = cleanText(input).replace(/\s/g, "");
  if (s === "") return null;
  if (!/^-?\d+(\.0+)?$/.test(s)) throw new Error(`Zahl nicht lesbar: "${input}"`);
  return Number.parseInt(s, 10);
}

/** Shopify-ID (Ziffern, optional als gid://shopify/Customer/123) als String, sonst null. */
export function parseShopifyId(input: string): string | null {
  const s = cleanText(input);
  if (s === "") return null;
  const gid = /^gid:\/\/shopify\/\w+\/(\d+)$/.exec(s);
  if (gid) return gid[1];
  if (/^\d+$/.test(s)) return s;
  throw new Error(`Shopify-ID nicht lesbar: "${input}"`);
}

const TRUE_VALUES = new Set(["yes", "y", "true", "1", "ja", "subscribed", "x"]);
const FALSE_VALUES = new Set(["no", "n", "false", "0", "nein", ""]);

export function parseYesNo(input: string): boolean {
  const s = cleanText(input).toLowerCase();
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  throw new Error(`Ja/Nein-Wert nicht lesbar: "${input}"`);
}

// --- Datum -----------------------------------------------------------------------------------

const SHOP_TIME_ZONE = "Europe/Berlin";

/** Versatz einer Zeitzone zu UTC in Minuten für einen Zeitpunkt. */
function zoneOffsetMinutes(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMillis));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - utcMillis) / 60000);
}

/** Lokale Wandzeit in der Shop-Zeitzone nach UTC (zwei Durchläufe wegen Sommerzeit). */
function localToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let offset = zoneOffsetMinutes(guess, SHOP_TIME_ZONE);
  let utc = guess - offset * 60000;
  const offset2 = zoneOffsetMinutes(utc, SHOP_TIME_ZONE);
  if (offset2 !== offset) {
    offset = offset2;
    utc = guess - offset * 60000;
  }
  return utc;
}

/**
 * Datumswerte aus Shopify nach ISO 8601 in UTC. Formate:
 *   2024-03-15 14:23:11 +0100   (Shopify-CSV)
 *   2024-03-15T14:23:11+01:00   (Admin-API), auch mit Z
 *   2024-03-15 14:23:11 UTC
 *   2024-03-15 14:23 / 2024-03-15 / 15.03.2024 14:23 (ohne Zone: Shop-Zeitzone Europe/Berlin)
 * Leer ergibt null, Unlesbares wirft.
 */
export function parseShopifyDate(input: string): string | null {
  const s = cleanText(input);
  if (s === "") return null;
  let y: number, mo: number, d: number;
  let h = 0,
    mi = 0,
    sec = 0;
  let zone: string | undefined;
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i.exec(
      s,
    );
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (iso) {
    [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (iso[4]) [h, mi, sec] = [Number(iso[4]), Number(iso[5]), Number(iso[6] ?? 0)];
    zone = iso[7];
  } else if (de) {
    [d, mo, y] = [Number(de[1]), Number(de[2]), Number(de[3])];
    if (de[4]) [h, mi, sec] = [Number(de[4]), Number(de[5]), Number(de[6] ?? 0)];
  } else {
    throw new Error(`Datum nicht lesbar: "${input}"`);
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) {
    throw new Error(`Datum ungültig: "${input}"`);
  }
  let utc: number;
  if (zone) {
    const z = zone.toUpperCase();
    let offsetMin = 0;
    if (z !== "Z" && z !== "UTC" && z !== "GMT") {
      const m = /^([+-])(\d{2}):?(\d{2})$/.exec(zone)!;
      offsetMin = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    }
    utc = Date.UTC(y, mo - 1, d, h, mi, sec) - offsetMin * 60000;
  } else {
    utc = localToUtc(y, mo, d, h, mi, sec);
  }
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) throw new Error(`Datum ungültig: "${input}"`);
  return date.toISOString();
}

// --- Personen und Adressen ---------------------------------------------------------------------

const emailSchema = z.email();

/** E-Mail normalisieren (trim, klein) und prüfen; null bei leer, wirft bei ungültig. */
export function normalizeEmail(input: string): string | null {
  const s = cleanText(input).toLowerCase();
  if (s === "") return null;
  if (!emailSchema.safeParse(s).success) throw new Error(`E-Mail ungültig: "${input}"`);
  return s;
}

/** "Erika Mustermann" → Vorname "Erika", Nachname "Mustermann"; das letzte Wort ist der Nachname. */
export function splitFullName(input: string): { firstName: string; lastName: string } {
  const parts = cleanText(input).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

const COUNTRY_NAMES: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  austria: "AT",
  österreich: "AT",
  switzerland: "CH",
  schweiz: "CH",
  netherlands: "NL",
  niederlande: "NL",
  luxembourg: "LU",
  luxemburg: "LU",
  belgium: "BE",
  belgien: "BE",
  france: "FR",
  frankreich: "FR",
  denmark: "DK",
  dänemark: "DK",
  poland: "PL",
  polen: "PL",
  italy: "IT",
  italien: "IT",
};

/** Ländercode (ISO 3166-1 alpha-2) aus Code oder Name, null wenn unbekannt. */
export function countryCode(codeOrName: string): string | null {
  const s = cleanText(codeOrName);
  if (s === "") return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return COUNTRY_NAMES[s.toLowerCase()] ?? null;
}

/** Steuersatz in Basispunkten aus Namen wie "DE MwSt 19%" oder "MwSt. 7 %", null wenn keiner. */
export function rateBpFromTaxName(name: string): number | null {
  const m = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/.exec(name);
  if (!m) return null;
  return Math.round(Number(m[1].replace(",", ".")) * 100);
}

/** Komma-getrennte Tags, getrimmt, ohne Dubletten (Groß/Kleinschreibung bleibt). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of cleanText(input).split(",")) {
    const tag = t.trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

/** Fehlertext aus unbekanntem Fehler. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** E-Mail für Konsolenausgaben kürzen (e***@example.com), damit Logs keine vollständigen Adressen tragen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email.length > 2 ? `${email.slice(0, 1)}***` : "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
