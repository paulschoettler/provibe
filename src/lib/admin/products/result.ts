import type { z } from "zod";

/**
 * Einheitliches Ergebnis der Katalog-Serverlogik (Produkte, Bilder, Kollektionen, Bestand, Rabatte).
 * Server Actions geben es unverändert an das Formular weiter: fieldErrors je Feldpfad
 * ("variants.0.gtin"), warnings als Hinweise, die das Speichern nicht verhindern.
 * Rein, ohne Server-Abhängigkeiten.
 */
export type FieldErrors = Record<string, string>;

export type AdminResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string; fieldErrors: FieldErrors };

export function ok<T>(data: T, warnings: string[] = []): AdminResult<T> {
  return { ok: true, data, warnings };
}

export function fail<T = never>(error: string, fieldErrors: FieldErrors = {}): AdminResult<T> {
  return { ok: false, error, fieldErrors };
}

/** Zod-Fehler in Feldpfade übersetzen; pro Feld zählt die erste Meldung. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Für das Audit-Log: nur geänderte Felder (Briefing 8, audit.ts). Vergleich per JSON,
 * damit Arrays und Objekte (tags, attributes) korrekt erkannt werden.
 */
export function changedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before?.[key];
    const next = after[key];
    if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) {
      b[key] = prev ?? null;
      a[key] = next ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

/** Suchtext für PostgREST-Filter (ilike, or-Syntax) entschärfen. */
export function escapeSearch(q: string): string {
  return q
    .replace(/[%_*,()\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export const INVALID_INPUT = "Bitte prüfe die markierten Felder.";
export const NO_PERMISSION = "Dafür fehlt dir die Berechtigung.";
export const NOT_FOUND = "Der Datensatz wurde nicht gefunden.";
