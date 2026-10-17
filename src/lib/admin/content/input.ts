/**
 * Formulareingaben des Backoffice (Inhalte, Einstellungen, Bewertungen) in saubere Werte für die
 * Zod-Schemas der Serverlogik übersetzen. Rein, getestet in input.test.ts.
 *
 * Zeiten: Eingabefelder vom Typ datetime-local liefern Ortszeit ohne Zone ("2026-10-20T14:30").
 * Gemeint ist immer Europe/Berlin, gespeichert wird UTC (ISO mit Z).
 */

const TIME_ZONE = "Europe/Berlin";

/** Einzelner Text aus FormData, getrimmt; fehlend wird "". */
export function text(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** Text oder null, wenn leer. */
export function optText(fd: FormData, name: string): string | null {
  return text(fd, name) || null;
}

/** Checkbox oder Switch: angehakt = "on" (oder ein anderer Wert ungleich leer und "false"). */
export function flag(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return typeof v === "string" && v !== "" && v !== "false" && v !== "0";
}

/** Mehrfachwerte (Checkbox-Gruppen, Tabellenauswahl) entdoppelt. */
export function list(fd: FormData, name: string): string[] {
  return [
    ...new Set(
      fd
        .getAll(name)
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

/** Eingaben als flaches Objekt aus Strings (für ActionState.values, damit nichts verloren geht). */
export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$ACTION") || typeof value !== "string") continue;
    if (!(key in out)) out[key] = value;
  }
  return out;
}

/**
 * Eurobetrag aus einem Textfeld in Cent: "4,90", "4.90", "4,90 €", "1.234,50", "50".
 * Leer ergibt null, Unlesbares NaN (das Zod-Schema meldet dann den Fehler am Feld).
 */
export function euroToCents(raw: string | null | undefined): number | null {
  const s = String(raw ?? "")
    .replace(/[€\s]/g, "")
    .trim();
  if (!s) return null;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

/** Cent als Eingabewert "4,90" (ohne Währungszeichen). */
export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Kilogramm-Eingabe ("31,5") in Gramm. Leer ergibt null. */
export function kgToGrams(raw: string | null | undefined): number | null {
  const s = String(raw ?? "")
    .replace(/kg/i, "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 1000);
}

export function gramsToKgInput(grams: number | null | undefined): string {
  if (grams === null || grams === undefined) return "";
  return String(grams / 1000).replace(".", ",");
}

/** Prozent-Eingabe ("19" oder "7,5") in Basispunkte (1900, 750). */
export function percentToBp(raw: string | null | undefined): number | null {
  const s = String(raw ?? "")
    .replace("%", "")
    .trim()
    .replace(",", ".");
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

/* Zeitzone ---------------------------------------------------------------------------------- */

function berlinOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asLocal - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-10-20T14:30" (Ortszeit Berlin) als ISO-Zeitstempel in UTC; ungültig ergibt null. */
export function berlinLocalToIso(local: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(local ?? "").trim());
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (Number.isNaN(asUtc)) return null;
  // Zwei Durchläufe, damit der Versatz an Umstellungstagen stimmt
  let ts = asUtc - berlinOffsetMs(asUtc);
  ts = asUtc - berlinOffsetMs(ts);
  return new Date(ts).toISOString();
}

/** ISO-Zeitstempel als Wert für ein datetime-local-Feld in Berliner Ortszeit. */
export function isoToBerlinLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const local = new Date(ms + berlinOffsetMs(ms));
  return local.toISOString().slice(0, 16);
}
