/**
 * Eingaben aus Formularen des Backoffice lesen (reine Funktionen, getestet in form-input.test.ts).
 * Beträge tippt das Team in Euro ("26,10", "26.10", "26"); intern immer Cent als Integer.
 */

/** "26,10" → 2610, "1.234,50" → 123450, "26" → 2600; null bei leer oder ungültig. */
export function parseEuroToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  let v = raw.replace(/\s|€/g, "").trim();
  if (!v) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [euros, cents = ""] = v.split(".");
  const value = Number(euros) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

/** Kilogramm mit Komma ("1,2") → Gramm; null bei leer oder ungültig. */
export function parseKgToGrams(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s|kg/gi, "").replace(",", ".");
  if (!v) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(v)) return null;
  return Math.round(Number(v) * 1000);
}

/** Checkbox aus FormData: "on", "true", "1" gelten als gesetzt. */
export function isChecked(raw: FormDataEntryValue | null): boolean {
  return raw === "on" || raw === "true" || raw === "1";
}

/** Ganze, nicht negative Zahl aus einem Formularfeld; leer = 0, ungültig = null. */
export function parseCount(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "") return 0;
  if (typeof raw !== "string" || !/^\d{1,5}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}
