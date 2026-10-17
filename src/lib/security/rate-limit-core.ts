import { createHash } from "node:crypto";

/**
 * Reine Logik des Rate Limits (ohne Datenbank, ohne next/headers), damit sie testbar bleibt.
 * Die Datenbankanbindung steht in rate-limit.ts.
 */

/** Aktion, für die ein Limit gilt. Kleinbuchstaben, Ziffern, Bindestrich (wird Teil des Schlüssels). */
export type RateLimitAction = string;

/** Fallback-Salz, falls APP_TOKEN_SECRET fehlt. Nur für lokale Entwicklung gedacht. */
const DEV_SALT = "provibe-rate-limit-dev-salt";

/**
 * IP-Adresse pseudonymisiert speichern (DSGVO Art. 25): SHA-256 mit Salz, gekürzt.
 * Aus dem Hash lässt sich die Adresse ohne Salz nicht zurückrechnen.
 */
export function hashIp(ip: string, salt: string | undefined): string {
  return createHash("sha256")
    .update(`${salt || DEV_SALT}:${ip.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Schlüssel in rate_limits: "<aktion>:<ip-hash>" (Muster aus Migration 20260921121100). */
export function rateLimitKey(action: RateLimitAction, ipHash: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(action)) {
    throw new Error(`Ungültige Rate-Limit-Aktion: ${action}`);
  }
  return `${action}:${ipHash}`;
}

/** Fenster in Sekunden als Postgres-Intervall ("600 seconds"). */
export function toInterval(windowSeconds: number): string {
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    throw new Error("windowSeconds muss eine positive ganze Zahl sein");
  }
  return `${windowSeconds} seconds`;
}

/**
 * Client-IP aus den Request-Headern. Netlify setzt x-nf-client-connection-ip, davor
 * greifen die üblichen Proxy-Header. Ohne Angabe "unbekannt" (dann teilen sich alle
 * unbekannten Absender ein Limit, das ist gewollt streng).
 */
export function clientIpFromHeaders(get: (name: string) => string | null): string {
  const direct = get("x-nf-client-connection-ip") ?? get("x-real-ip");
  if (direct) return direct.trim();
  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unbekannt";
}
