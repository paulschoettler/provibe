/**
 * Weiterleitungen aus der Tabelle public.redirects (reine Logik, ohne Datenbank, getestet in
 * resolve.test.ts). Laden und Ausführen: table.ts.
 *
 * Abgleich: Pfad mit führendem Slash, ohne Trailing Slash, ohne doppelte Slashes, Prozent-
 * Kodierung aufgelöst, ohne Groß/Kleinschreibung (wie Netlify). Die Query der Anfrage bleibt
 * erhalten und wird an das Ziel angehängt.
 */

export interface RedirectRow {
  from_path: string;
  to_path: string;
  status_code: number;
  is_enabled: boolean;
}

export interface RedirectEntry {
  to: string;
  /** 301, 302, 307 oder 308 wie in der Tabelle */
  status: number;
  permanent: boolean;
}

export type RedirectMap = Map<string, RedirectEntry>;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Pfad für den Abgleich: "/Pages/Alt/?x=1" und "pages/alt" ergeben beide "/pages/alt".
 * Query und Fragment fallen weg (die Query der Anfrage hängt resolveRedirect wieder an).
 */
export function normalizePath(raw: string): string {
  let p = String(raw ?? "").trim();
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  p = safeDecode(p);
  p = `/${p}`.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLocaleLowerCase("de-DE");
}

/** Pfad aus den Segmenten der Catch-all-Route (Next liefert sie je nach Version kodiert). */
export function pathFromSegments(segments: string[] | undefined): string {
  return normalizePath((segments ?? []).map(safeDecode).join("/"));
}

/** Query der Anfrage als String mit führendem "?" oder leer. */
export function queryFromSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) q.append(key, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Nur interne Pfade oder absolute http(s)-Adressen sind gültige Ziele. */
function cleanTarget(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return null; // protokollrelativ wäre ein offener Redirect auf Fremdhosts
  return t.startsWith("/") ? t : `/${t}`;
}

/** Aktive Zeilen als Map (Schlüssel: normalisierter from_path). Ungültige Zeilen fallen weg. */
export function buildRedirectMap(rows: RedirectRow[]): RedirectMap {
  const map: RedirectMap = new Map();
  for (const row of rows) {
    if (!row.is_enabled) continue;
    const from = normalizePath(row.from_path);
    const to = cleanTarget(row.to_path);
    if (from === "/" || !to) continue;
    // Ziel gleich Quelle wäre eine Schleife
    if (!/^https?:\/\//i.test(to) && normalizePath(to) === from) continue;
    const status = [301, 302, 307, 308].includes(row.status_code) ? row.status_code : 301;
    map.set(from, { to, status, permanent: status === 301 || status === 308 });
  }
  return map;
}

/**
 * Ziel für einen angefragten Pfad. query ist die Query der Anfrage ("?a=1" oder leer); hat das
 * Ziel schon eine Query, werden die Parameter mit "&" angehängt, ein Fragment bleibt am Ende.
 */
export function resolveRedirect(
  map: RedirectMap,
  path: string,
  query = "",
): { location: string; status: number; permanent: boolean } | null {
  const entry = map.get(normalizePath(path));
  if (!entry) return null;
  const q = query.replace(/^\?/, "");
  if (!q) return { location: entry.to, status: entry.status, permanent: entry.permanent };
  const hashAt = entry.to.indexOf("#");
  const base = hashAt >= 0 ? entry.to.slice(0, hashAt) : entry.to;
  const hash = hashAt >= 0 ? entry.to.slice(hashAt) : "";
  const joiner = base.includes("?") ? "&" : "?";
  return {
    location: `${base}${joiner}${q}${hash}`,
    status: entry.status,
    permanent: entry.permanent,
  };
}

/** Logzeile für Netlify: "404 <pfad>", ohne Query, ohne Steuerzeichen, gekürzt. */
export function notFoundLogLine(path: string): string {
  const clean = [...String(path ?? "").split(/[?#]/)[0]]
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join("")
    .slice(0, 300);
  return `404 ${clean || "/"}`;
}
