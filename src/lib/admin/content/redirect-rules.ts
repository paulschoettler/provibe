/**
 * Regeln für Weiterleitungen aus dem Backoffice (Tabelle public.redirects). Rein, getestet in
 * redirect-rules.test.ts. Die Normalisierung entspricht der Storefront (src/lib/redirects/resolve.ts):
 * führender Slash, ohne Trailing Slash, ohne doppelte Slashes, Prozent-Kodierung aufgelöst,
 * ohne Groß- und Kleinschreibung. Gespeichert wird die normalisierte Quelle, damit
 * "/Pages/Alt/" und "/pages/alt" als dieselbe Quelle erkannt werden.
 */

export interface RedirectLike {
  id?: string;
  fromPath: string;
  toPath: string;
  isEnabled: boolean;
}

/** Präfixe, die nie weitergeleitet werden (Catch-all überspringt sie ohnehin). */
const RESERVED_PREFIXES = ["/admin", "/api", "/_next"];
const MAX_CHAIN = 20;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Quelle für den Abgleich, ohne Query und Fragment. */
export function normalizeRedirectPath(raw: string): string {
  let p = String(raw ?? "").trim();
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  p = safeDecode(p);
  p = `/${p}`.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLocaleLowerCase("de-DE");
}

export function isExternalTarget(target: string): boolean {
  return /^https?:\/\//i.test(target.trim());
}

/** Ziel: interner Pfad (Query und Fragment bleiben) oder absolute http(s)-Adresse. */
export function normalizeRedirectTarget(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t || /\s/.test(t)) return null;
  if (isExternalTarget(t)) {
    try {
      const url = new URL(t);
      return url.protocol === "https:" || url.protocol === "http:" ? t : null;
    } catch {
      return null;
    }
  }
  if (t.startsWith("//")) return null; // protokollrelativ: offener Redirect auf Fremdhosts
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // javascript:, mailto: und Co.
  return t.startsWith("/") ? t : `/${t}`;
}

export type RedirectCheck =
  | { ok: true; fromPath: string; toPath: string; warnings: string[] }
  | { ok: false; field: "fromPath" | "toPath"; message: string };

/**
 * Neue oder geänderte Weiterleitung prüfen: gültige Quelle und gültiges Ziel, keine doppelte
 * Quelle, keine Schleife (auch über mehrere Stufen), Ketten werden als Hinweis gemeldet.
 * existing enthält alle Zeilen der Tabelle (auch inaktive), candidate.id beim Bearbeiten.
 */
export function checkRedirect(candidate: RedirectLike, existing: RedirectLike[]): RedirectCheck {
  const rawFrom = String(candidate.fromPath ?? "").trim();
  if (!rawFrom) return { ok: false, field: "fromPath", message: "Bitte gib den alten Pfad ein." };
  if (isExternalTarget(rawFrom) || /^[a-z][a-z0-9+.-]*:/i.test(rawFrom))
    return {
      ok: false,
      field: "fromPath",
      message: "Die Quelle ist ein Pfad auf diesem Shop, zum Beispiel /pages/alt.",
    };
  if (rawFrom.includes("?"))
    return {
      ok: false,
      field: "fromPath",
      message: "Die Quelle darf keine Parameter enthalten, die Query wird automatisch übernommen.",
    };
  const fromPath = normalizeRedirectPath(rawFrom);
  if (fromPath === "/")
    return {
      ok: false,
      field: "fromPath",
      message: "Die Startseite lässt sich nicht weiterleiten.",
    };
  if (fromPath.length > 500)
    return { ok: false, field: "fromPath", message: "Der Pfad ist zu lang." };
  if (RESERVED_PREFIXES.some((p) => fromPath === p || fromPath.startsWith(`${p}/`)))
    return {
      ok: false,
      field: "fromPath",
      message: "Pfade unter /admin, /api und /_next lassen sich nicht weiterleiten.",
    };

  const toPath = normalizeRedirectTarget(candidate.toPath);
  if (!toPath)
    return {
      ok: false,
      field: "toPath",
      message: "Ziel muss ein Pfad wie /collections/all oder eine https-Adresse sein.",
    };
  if (toPath.length > 1000) return { ok: false, field: "toPath", message: "Das Ziel ist zu lang." };
  if (!isExternalTarget(toPath) && normalizeRedirectPath(toPath) === fromPath)
    return { ok: false, field: "toPath", message: "Ziel und Quelle sind gleich (Schleife)." };

  const others = existing.filter((r) => !candidate.id || r.id !== candidate.id);
  const duplicate = others.find((r) => normalizeRedirectPath(r.fromPath) === fromPath);
  if (duplicate)
    return {
      ok: false,
      field: "fromPath",
      message: `Für diese Quelle gibt es schon eine Weiterleitung (nach ${duplicate.toPath}).`,
    };

  const warnings: string[] = [];
  if (candidate.isEnabled) {
    const map = new Map<string, string>();
    for (const r of others) {
      if (r.isEnabled) map.set(normalizeRedirectPath(r.fromPath), r.toPath);
    }
    map.set(fromPath, toPath);
    // Kette ab dem Ziel verfolgen; landet sie wieder bei der Quelle, entsteht eine Schleife
    let hops = 0;
    let current = toPath;
    const seen = new Set<string>([fromPath]);
    while (!isExternalTarget(current)) {
      const key = normalizeRedirectPath(current);
      const next = map.get(key);
      if (!next) break;
      if (seen.has(key) || key === fromPath)
        return {
          ok: false,
          field: "toPath",
          message: `Das ergäbe eine Schleife: ${current} leitet wieder auf ${fromPath} zurück.`,
        };
      seen.add(key);
      hops++;
      if (hops >= MAX_CHAIN)
        return { ok: false, field: "toPath", message: "Die Weiterleitungskette ist zu lang." };
      current = next;
    }
    if (hops > 0)
      warnings.push(
        `Das Ziel leitet selbst weiter (${hops} ${hops === 1 ? "Stufe" : "Stufen"}). Besser direkt auf ${current} verweisen.`,
      );
    // Andere Weiterleitungen, die auf die neue Quelle zeigen, bilden jetzt eine Kette
    const pointing = others.filter(
      (r) =>
        r.isEnabled && !isExternalTarget(r.toPath) && normalizeRedirectPath(r.toPath) === fromPath,
    );
    if (pointing.length)
      warnings.push(
        `${pointing.length} ${pointing.length === 1 ? "Weiterleitung zeigt" : "Weiterleitungen zeigen"} auf diese Quelle und ${pointing.length === 1 ? "bildet" : "bilden"} jetzt eine Kette.`,
      );
  }
  return { ok: true, fromPath, toPath, warnings };
}

/** Anzeige der Statuscodes. */
export const REDIRECT_STATUS_LABELS: Record<number, string> = {
  301: "301 dauerhaft",
  302: "302 vorübergehend",
  307: "307 vorübergehend",
  308: "308 dauerhaft",
};
