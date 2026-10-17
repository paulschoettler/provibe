/**
 * Links mit Suchparametern bauen, ohne bestehende Filter zu verlieren
 * (Sortierung, Seiten, Filter-Chips, Drawer). Leere Werte und null entfernen den Parameter.
 *
 *   withParams("/admin/protokoll", { aktion: "order.refund", seite: "2" }, { seite: null })
 *   // "/admin/protokoll?aktion=order.refund"
 */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function withParams(
  path: string,
  current: SearchParamsInput = {},
  overrides: Record<string, string | number | null | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key in overrides) continue;
    if (Array.isArray(value)) value.forEach((v) => v && params.append(key, v));
    else if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Ersten Wert eines Suchparameters lesen (Next liefert string | string[] | undefined). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
