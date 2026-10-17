/**
 * Auswahl der gültigen Rechtstext-Version (rein, Spiegel von current_legal_version() in der
 * Datenbank). Getestet in versions.test.ts.
 */

export interface VersionLike {
  status: "draft" | "published" | "archived";
  effective_from: string | null;
  version: number;
}

/** Gültige Version wie current_legal_version(): veröffentlicht, effective_from erreicht, höchste zuerst. */
export function currentVersionOf<T extends VersionLike>(
  versions: T[],
  now: Date = new Date(),
): T | null {
  return (
    versions
      .filter(
        (v) => v.status === "published" && (!v.effective_from || new Date(v.effective_from) <= now),
      )
      .sort((a, b) => {
        const ea = a.effective_from ? Date.parse(a.effective_from) : -Infinity;
        const eb = b.effective_from ? Date.parse(b.effective_from) : -Infinity;
        return eb - ea || b.version - a.version;
      })[0] ?? null
  );
}
