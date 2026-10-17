import { NextResponse, type NextRequest } from "next/server";
import { buildRedirectMap, resolveRedirect, type RedirectMap, type RedirectRow } from "./resolve";

/**
 * Weiterleitungen aus der Tabelle public.redirects im Proxy (src/proxy.ts, läuft vor dem Routing).
 *
 * Warum im Proxy und nicht in einer Catch-all-Seite: Ein notFound() aus einer Seite liefert in
 * Next 16.3 einen leeren <body>, die 404-Seite entsteht dann erst im Browser aus dem RSC-Payload
 * (geprüft per curl im Dev-Server und in einem Produktions-Build). Unbekannte Pfade ohne Catch-all
 * landen dagegen auf der statischen 404 mit vollständigem HTML. Der Proxy leitet deshalb nur
 * Treffer weiter und lässt alles andere unverändert ins Routing; die Next-Doku empfiehlt genau
 * das (proxy.md, "Producing a response").
 * Nebeneffekt: Umbenannte Produkte und Kollektionen (/products/<alt>, /collections/<alt>, vom
 * Backoffice in die Tabelle geschrieben) greifen auch, obwohl es dafür eine dynamische Route gibt.
 *
 * Kosten: Die Tabelle wird je Server-Instanz höchstens alle fünf Minuten geladen (eine REST-
 * Abfrage mit dem Publishable Key, RLS: nur aktive Zeilen) und als Map im Speicher gehalten.
 * Kein Schreiben aus dem Request (die Spalte hits bleibt unberührt).
 */

export const REDIRECTS_TTL_MS = 5 * 60_000;
/** Nach einem Ladefehler früher neu versuchen, bis dahin gilt die letzte gute Map */
const RETRY_AFTER_ERROR_MS = 30_000;

/** Pfade, für die die Tabelle nie gilt (Technik, Backoffice, Schnittstellen). */
const SKIP_PREFIXES = ["/_next/", "/api/", "/admin"];

export interface RedirectCache {
  get(): Promise<RedirectMap>;
}

/** TTL-Cache mit Entdopplung paralleler Ladevorgänge; reine Logik, getestet in proxy.test.ts. */
export function createRedirectCache(
  load: () => Promise<RedirectRow[]>,
  options: { ttlMs?: number; now?: () => number; onError?: (error: unknown) => void } = {},
): RedirectCache {
  const ttl = options.ttlMs ?? REDIRECTS_TTL_MS;
  const now = options.now ?? Date.now;
  let map: RedirectMap = new Map();
  let validUntil = 0;
  let pending: Promise<RedirectMap> | null = null;

  return {
    async get() {
      if (now() < validUntil) return map;
      pending ??= load()
        .then((rows) => {
          map = buildRedirectMap(rows);
          validUntil = now() + ttl;
          return map;
        })
        .catch((error) => {
          (options.onError ?? ((e) => console.error("[redirects]", errorText(e))))(error);
          validUntil = now() + Math.min(ttl, RETRY_AFTER_ERROR_MS);
          return map;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadFromSupabase(): Promise<RedirectRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/redirects?select=from_path,to_path,status_code,is_enabled&is_enabled=eq.true&limit=5000`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Weiterleitungen nicht ladbar: HTTP ${res.status}`);
  return (await res.json()) as RedirectRow[];
}

const sharedCache = createRedirectCache(loadFromSupabase);

/** Soll der Proxy für diese Anfrage überhaupt in die Tabelle schauen? */
export function isRedirectCandidate(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (pathname === "/") return false;
  return !SKIP_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

/**
 * Weiterleitung aus der Tabelle oder null. Aufruf in src/proxy.ts nach dem Passwortschutz:
 *   const hit = await redirectFromTable(request); if (hit) return hit;
 * Status wie in der Tabelle (301, 302, 307 oder 308), Query der Anfrage bleibt erhalten.
 */
export async function redirectFromTable(
  request: NextRequest,
  cache: RedirectCache = sharedCache,
): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (!isRedirectCandidate(request.method, pathname)) return null;
  const hit = resolveRedirect(await cache.get(), pathname, search);
  if (!hit) return null;
  return NextResponse.redirect(new URL(hit.location, request.url), hit.status);
}
