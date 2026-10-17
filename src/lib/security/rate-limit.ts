import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  clientIpFromHeaders,
  hashIp,
  rateLimitKey,
  toInterval,
  type RateLimitAction,
} from "./rate-limit-core";

/**
 * Gemeinsamer Rate-Limit-Helfer für Formulare, Login und Rabattcode-Prüfung (Briefing 9).
 *
 * Zählt Versuche je Aktion und pseudonymisierter IP in der Tabelle rate_limits über die
 * Datenbankfunktion check_rate_limit (atomar per upsert, Migration 20260921121100).
 * Die Funktion ist nur für service_role ausführbar, deshalb läuft der Aufruf mit dem
 * Service-Role-Client und ausschließlich serverseitig.
 *
 * Verwendung in einer Server Action:
 *
 *   const limit = await checkRateLimit({ action: "contact", limit: 5, windowSeconds: 3600 });
 *   if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE };
 *   // limit.ipHash kann in der Zieltabelle (Spalte ip_hash) gespeichert werden
 */

export interface RateLimitOptions {
  /** Name der Aktion, zum Beispiel "contact", "partner", "withdrawal", "login", "discount" */
  action: RateLimitAction;
  /** Erlaubte Versuche je Fenster */
  limit: number;
  /** Fensterlänge in Sekunden */
  windowSeconds: number;
  /** Optional eigene Kennung statt der IP (zum Beispiel E-Mail-Hash beim Login) */
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Pseudonymisierte IP (oder Kennung), passend für Spalten wie ip_hash */
  ipHash: string;
  /** true, wenn die Datenbank nicht erreichbar war und deshalb durchgelassen wurde */
  degraded: boolean;
}

/** Neutrale Meldung für Formulare, wenn das Limit greift. */
export const RATE_LIMIT_MESSAGE =
  "Du hast gerade sehr viele Anfragen geschickt. Bitte warte kurz und versuch es dann noch einmal.";

/** Pseudonymisierte IP des aktuellen Requests, ohne zu zählen. */
export async function currentIpHash(): Promise<string> {
  const h = await headers();
  return hashIp(
    clientIpFromHeaders((n) => h.get(n)),
    serverEnv().APP_TOKEN_SECRET,
  );
}

/**
 * Zählt einen Versuch und meldet, ob er erlaubt ist.
 * Fällt die Datenbank aus, wird der Versuch durchgelassen (degraded: true) und geloggt:
 * Ein Formular soll nicht an einem Zählerproblem scheitern, Honeypot und Validierung greifen weiter.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const ipHash = options.identifier
    ? hashIp(options.identifier, serverEnv().APP_TOKEN_SECRET)
    : await currentIpHash();
  const key = rateLimitKey(options.action, ipHash);
  try {
    const { data, error } = await supabaseAdmin().rpc("check_rate_limit", {
      p_key: key,
      p_limit: options.limit,
      p_window: toInterval(options.windowSeconds),
    });
    if (error) throw error;
    return { allowed: data === true, ipHash, degraded: false };
  } catch (error) {
    console.error(`[rate-limit] Prüfung für "${options.action}" fehlgeschlagen`, error);
    return { allowed: true, ipHash, degraded: true };
  }
}

export { hashIp, rateLimitKey } from "./rate-limit-core";
