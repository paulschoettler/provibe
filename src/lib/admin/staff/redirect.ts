/**
 * Rücksprungziel nach Login und Zwei-Faktor (?next=…). Erlaubt sind nur Pfade im Backoffice,
 * keine fremden Hosts (Open Redirect) und keine Anmelde-Routen selbst (Schleifen).
 */
export const ADMIN_HOME = "/admin";

const AUTH_PATHS = ["/admin/login", "/admin/2fa", "/admin/logout", "/admin/callback"];

export function safeAdminNext(raw: unknown, fallback: string = ADMIN_HOME): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const path = value.split(/[?#]/)[0];
  if (path !== "/admin" && !path.startsWith("/admin/")) return fallback;
  if (path.includes("/../") || path.endsWith("/..")) return fallback;
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return fallback;
  return value;
}

/** /admin/login?next=… mit geprüftem Ziel */
export function adminLoginUrl(next?: string | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  const target = safeAdminNext(next, "");
  if (target && target !== ADMIN_HOME) params.set("next", target);
  const query = params.toString();
  return query ? `/admin/login?${query}` : "/admin/login";
}

/** /admin/2fa?next=… mit geprüftem Ziel */
export function adminTwoFactorUrl(next?: string | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  const target = safeAdminNext(next, "");
  if (target && target !== ADMIN_HOME) params.set("next", target);
  const query = params.toString();
  return query ? `/admin/2fa?${query}` : "/admin/2fa";
}
