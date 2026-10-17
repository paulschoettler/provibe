/**
 * Betreff aus email_templates.subject_template mit Platzhaltern {{name}}. Unbekannte Platzhalter
 * bleiben leer, Zeilenumbrüche werden entfernt (Header-Injection). Rein, getestet in subject.test.ts.
 */

export const SUBJECT_MAX = 150;

export function applySubjectTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined> = {},
): string {
  const out = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
  return out
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, SUBJECT_MAX);
}

/** Platzhalter einer Vorlage, zum Beispiel ["order_number"] für "Deine Bestellung {{order_number}}". */
export function subjectPlaceholders(template: string): string[] {
  return Array.from(
    new Set(Array.from(template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi), (m) => m[1])),
  );
}

/**
 * Betreff einer gerenderten Mail ersetzen, wenn im Backoffice ein eigener Betreff gespeichert ist.
 * Leere oder gleiche Vorlage: der Betreff aus dem Code bleibt.
 */
export function overrideSubject(
  rendered: string,
  stored: string | null | undefined,
  vars: Record<string, string | number | null | undefined> = {},
): string {
  if (!stored || !stored.trim()) return rendered;
  const applied = applySubjectTemplate(stored, vars);
  return applied || rendered;
}
