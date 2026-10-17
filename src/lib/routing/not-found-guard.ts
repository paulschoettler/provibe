import { NextResponse, type NextRequest } from "next/server";

/**
 * 404 für unbekannte Handles schon im Proxy (src/proxy.ts), ADR-017.
 *
 * Warum: Ein notFound() aus einer Seite unter einem dynamischen Segment liefert in Next 16.3 zwar
 * Status 404, aber nur eine leere HTML-Hülle (<html id="__next_error__">). Die 404-Seite entsteht
 * erst im Browser aus dem RSC-Payload, das verletzt die Rendering-Regel. Next rendert den Fehler
 * nicht serverseitig, weil React beim Server-Rendering keine Error Boundaries kennt und der
 * Fehler deshalb die ganze Hülle abbricht (Fehlerpfad in app-render.js, getErrorRSCPayload).
 * Pfade ohne passende Route rendert Next dagegen über den Not-found-Baum und liefert die
 * statische 404 mit vollständigem HTML. Der Proxy schreibt unbekannte Handles deshalb vor dem
 * Routing auf einen Pfad ohne Route um. Die Next-Doku empfiehlt genau das (loading.md, Status
 * Codes). dynamicParams = false scheidet aus, weil neue Produkte aus dem Backoffice dann bis zum
 * nächsten Build 404 liefern (revalidatePath ergänzt keine Pfade, geprüft im Produktions-Build).
 *
 * Kosten: Die Handles kommen per REST mit dem Publishable Key (RLS wie im Katalog) und liegen je
 * Server-Instanz höchstens eine Minute im Speicher. Bei einem Fehltreffer wird höchstens alle zehn
 * Sekunden neu geladen, damit ein gerade angelegtes Produkt sofort erreichbar ist. Ist nichts
 * ladbar, lässt der Proxy die Anfrage durch (fail open); die Seite ruft dann selbst notFound().
 */

export type HandleKind = "product" | "collection" | "blog";
export type HandleSets = Record<HandleKind, Set<string>>;

export const HANDLES_TTL_MS = 60_000;
export const HANDLES_MIN_RELOAD_MS = 10_000;

/** Pfad ohne Route: Next rendert darauf die statische 404 (src/app/not-found.tsx) mit Status 404. */
export const NOT_FOUND_REWRITE_PATH = "/_404";

/** Checkout-Token = ID der Checkout-Session (UUID), gleiche Prüfung wie findSessionById. */
const SESSION_TOKEN = /^[0-9a-f-]{36}$/i;

export type GuardTarget = { kind: HandleKind; handle: string } | { kind: "invalid" } | null;

/** Welche Prüfung braucht dieser Pfad? null = keine. */
export function guardTarget(method: string, pathname: string): GuardTarget {
  if (method !== "GET" && method !== "HEAD") return null;
  const m = /^\/(products|collections|blogs\/news|checkout\/danke)\/([^/]+)$/.exec(pathname);
  if (!m) return null;
  let segment: string;
  try {
    segment = decodeURIComponent(m[2]);
  } catch {
    return { kind: "invalid" };
  }
  switch (m[1]) {
    case "products":
      return { kind: "product", handle: segment };
    case "collections":
      return { kind: "collection", handle: segment };
    case "blogs/news":
      return { kind: "blog", handle: segment };
    default:
      return SESSION_TOKEN.test(segment) ? null : { kind: "invalid" };
  }
}

export interface HandleIndex {
  /** true nur, wenn der Handle sicher unbekannt ist (nach frischem Laden). */
  isMissing(kind: HandleKind, handle: string): Promise<boolean>;
}

/** TTL-Cache mit Entdopplung und Nachladen bei Fehltreffer; reine Logik, getestet. */
export function createHandleIndex(
  load: () => Promise<HandleSets | null>,
  options: {
    ttlMs?: number;
    minReloadMs?: number;
    now?: () => number;
    onError?: (error: unknown) => void;
  } = {},
): HandleIndex {
  const ttl = options.ttlMs ?? HANDLES_TTL_MS;
  const minReload = options.minReloadMs ?? HANDLES_MIN_RELOAD_MS;
  const now = options.now ?? Date.now;
  let sets: HandleSets | null = null;
  let loadedAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> | null = null;

  function refresh(): Promise<void> {
    pending ??= load()
      .then((next) => {
        if (next) sets = next;
      })
      .catch((error) => {
        (options.onError ?? ((e) => console.error("[404-guard]", errorText(e))))(error);
      })
      .finally(() => {
        loadedAt = now();
        pending = null;
      });
    return pending;
  }

  return {
    async isMissing(kind, handle) {
      if (now() - loadedAt >= ttl) await refresh();
      if (sets?.[kind].has(handle)) return false;
      if (now() - loadedAt >= minReload) await refresh();
      if (!sets) return false;
      return !sets[kind].has(handle);
    },
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadFromSupabase(): Promise<HandleSets | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const nowIso = encodeURIComponent(new Date().toISOString());
  const get = async (query: string): Promise<{ handle: string }[]> => {
    const res = await fetch(`${base}/${query}`, { headers, cache: "no-store" });
    if (!res.ok)
      throw new Error(`Handles nicht ladbar (${query.split("?")[0]}): HTTP ${res.status}`);
    return (await res.json()) as { handle: string }[];
  };
  // Gleiche Filter wie der Katalog (status active / published) und der Blog (published_at erreicht)
  const [products, collections, posts] = await Promise.all([
    get("products?select=handle&status=eq.active&limit=5000"),
    get("collections?select=handle&status=eq.published&limit=5000"),
    get(
      `blog_posts?select=handle&blog_handle=eq.news&status=eq.published&published_at=lte.${nowIso}&limit=5000`,
    ),
  ]);
  return {
    product: new Set(products.map((r) => r.handle)),
    collection: new Set(collections.map((r) => r.handle)),
    blog: new Set(posts.map((r) => r.handle)),
  };
}

const sharedIndex = createHandleIndex(loadFromSupabase);

/**
 * Rewrite auf die statische 404 oder null. Aufruf in src/proxy.ts nach den Weiterleitungen:
 *   const missing = await notFoundRewrite(request); if (missing) return missing;
 */
export async function notFoundRewrite(
  request: NextRequest,
  index: HandleIndex = sharedIndex,
): Promise<NextResponse | null> {
  const target = guardTarget(request.method, request.nextUrl.pathname);
  if (!target) return null;
  if (target.kind !== "invalid" && !(await index.isMissing(target.kind, target.handle)))
    return null;
  return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE_PATH, request.url));
}
