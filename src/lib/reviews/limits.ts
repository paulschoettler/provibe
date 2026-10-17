/**
 * Grenzwerte des Bewertungsmoduls ohne Abhängigkeiten (auch im Client-Bundle nutzbar, deshalb
 * getrennt von token.ts, das node:crypto braucht).
 */

/** Gültigkeit eines Bewertungslinks ab Versand der Mail. */
export const REVIEW_TOKEN_TTL_DAYS = 60;

export const REVIEW_TITLE_MAX = 80;
export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 1500;

/**
 * Grobe Formprüfung vor jedem Datenbankzugriff: base64url, 20 bis 128 Zeichen. Der echte Token hat
 * 32 Zeichen; der Spielraum erlaubt eine spätere Änderung der Länge ohne Codeänderung hier.
 */
export function isPlausibleReviewToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(token);
}
