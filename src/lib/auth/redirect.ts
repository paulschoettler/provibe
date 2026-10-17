/**
 * Prüft das Rücksprungziel aus ?next=… (Login, Callback). Erlaubt sind nur relative Pfade
 * innerhalb des Shops, damit niemand über einen präparierten Link auf eine fremde Seite
 * weiterleiten kann (Open Redirect).
 */
export const DEFAULT_AFTER_LOGIN = "/account";

export function safeNextPath(raw: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  // Die Supabase-Mailvorlagen hängen {{ .RedirectTo }} als next an, also unsere eigene
  // Callback-Adresse samt ?next=…: daraus nur das innere Ziel übernehmen, nie den Host.
  const wrapped = value.match(/^https?:\/\/[^/?#]+\/auth\/callback\?(.*)$/i);
  if (wrapped) {
    return safeNextPath(new URLSearchParams(wrapped[1]).get("next"), fallback);
  }
  // Nur ein führender Schrägstrich, keine Protokoll- oder Host-Angaben, keine Steuerzeichen
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;
  // Auth-Routen selbst sind kein sinnvolles Ziel (Schleifen vermeiden)
  if (value.startsWith("/auth/") || value.startsWith("/account/login")) return fallback;
  return value;
}

/** Login-URL mit Rücksprungziel, zum Beispiel für den Redirect geschützter Kontoseiten. */
export function loginUrl(next?: string): string {
  const target = safeNextPath(next, "");
  return target ? `/account/login?next=${encodeURIComponent(target)}` : "/account/login";
}
