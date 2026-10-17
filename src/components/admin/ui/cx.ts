/** Klassen zusammenfügen, falsy-Werte fallen weg (keine Bibliothek nötig). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
