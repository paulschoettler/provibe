import "server-only";
import { checkoutDb } from "./db";

/**
 * Aktuelle Fassungen der Rechtstexte für den Bestell-Snapshot (orders.legal_versions) und die
 * Bestellbestätigung in Textform (§ 312f Abs. 2 BGB: AGB und Widerrufsbelehrung per E-Mail).
 */
export type LegalKind = "agb" | "widerruf" | "datenschutz";

export interface LegalVersion {
  id: string;
  version: number;
  title: string;
  bodyHtml: string;
}

export { LEGAL_LINKS } from "./links";

export async function currentLegalVersions(): Promise<Partial<Record<LegalKind, LegalVersion>>> {
  const db = checkoutDb();
  const kinds: LegalKind[] = ["agb", "widerruf", "datenschutz"];
  const results = await Promise.all(
    kinds.map((kind) => db.rpc("current_legal_version", { p_kind: kind, p_locale: "de" })),
  );
  const out: Partial<Record<LegalKind, LegalVersion>> = {};
  results.forEach((res, i) => {
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (row && row.id) {
      out[kinds[i]] = {
        id: row.id,
        version: row.version,
        title: row.title,
        bodyHtml: row.body_html,
      };
    }
  });
  return out;
}

/** Snapshot für orders.legal_versions: {"agb":"<version_id>", ...} plus Versionsnummern. */
export function legalVersionsSnapshot(versions: Partial<Record<LegalKind, LegalVersion>>) {
  const out: Record<string, string | number> = {};
  for (const [kind, v] of Object.entries(versions)) {
    if (!v) continue;
    out[kind] = v.id;
    out[`${kind}_version`] = v.version;
  }
  return out;
}

export async function legalVersionsByIds(ids: string[]): Promise<LegalVersion[]> {
  if (ids.length === 0) return [];
  const { data } = await checkoutDb()
    .from("legal_document_versions")
    .select("id, version, title, body_html")
    .in("id", ids);
  return (data ?? []).map((r) => ({
    id: r.id,
    version: r.version,
    title: r.title,
    bodyHtml: r.body_html,
  }));
}
