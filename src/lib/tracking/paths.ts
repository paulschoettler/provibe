/**
 * Datensparsamkeit bei Adressen (DSGVO Art. 5 Abs. 1 lit. c, Art. 25): Pfade mit Zugangs-Token
 * (Bestellbestätigung, Newsletter-Links, Konto, Anmeldung) gehen nie an Werbedienste, und
 * Suchparameter werden bis auf Kampagnenparameter entfernt. Rein, im Client und im Test nutzbar.
 */

/**
 * Auf diesen Pfaden lädt kein Pixel und es wird nichts an einen Dienst gesendet. Die Pixel lesen
 * die Seitenadresse selbst aus; ein Token in der Adresse (zum Beispiel /checkout/danke/<id>)
 * würde sonst bei Meta, Google oder TikTok landen.
 */
export const SENSITIVE_PATH_PREFIXES = [
  "/checkout/danke",
  "/newsletter",
  "/account",
  "/auth",
  "/admin",
  "/api",
  "/abo",
  "/bewertung",
] as const;

/** Erlaubte Suchparameter in page_location (Kampagne und Klick-IDs). */
const ALLOWED_PARAMS =
  /^(utm_(source|medium|campaign|term|content)|gclid|gbraid|wbraid|fbclid|ttclid)$/;

/** UUID oder lange Zufallskette mit Ziffern (Produkt-Handles wie "raspberry-lime" bleiben). */
const TOKEN_SEGMENT =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,})$/i;

export function isSensitivePath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return SENSITIVE_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/** Ersetzt Token-artige Pfadsegmente (UUIDs, lange Zufallsketten) durch ":token". */
export function sanitizePath(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0] || "/";
  return clean
    .split("/")
    .map((segment) => (TOKEN_SEGMENT.test(segment) ? ":token" : segment))
    .join("/");
}

/** Bereinigte URL: Ursprung, bereinigter Pfad, nur Kampagnenparameter, ohne Fragment. */
export function sanitizeLocation(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (ALLOWED_PARAMS.test(key)) kept.append(key, value.slice(0, 200));
  });
  const query = kept.toString();
  return `${url.origin}${sanitizePath(url.pathname)}${query ? `?${query}` : ""}`;
}
