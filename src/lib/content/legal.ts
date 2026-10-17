import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";
import { structureLegalHtml, type LegalKind, type TocEntry } from "./html";

export type { LegalKind } from "./html";

/** Rechtstext in der aktuell gültigen, veröffentlichten Fassung. */
export interface LegalDocument {
  kind: LegalKind;
  path: string;
  title: string;
  version: number;
  /** Gültig ab (effective_from), sonst Anlagedatum der Version. ISO, UTC */
  publishedAt: string;
  updatedAt: string;
  /** Strukturiertes HTML (H2 mit ids, verlinkte E-Mail-Adressen), Wortlaut unverändert */
  html: string;
  toc: TocEntry[];
}

/** Feste Pfade der Rechtstexte (legal_documents.path, Seed part1/part2). */
export const LEGAL_PATHS: Record<LegalKind, string> = {
  impressum: "/pages/impressum",
  agb: "/pages/allgemeine-geschaftsbedingungen",
  widerruf: "/pages/ruckgabe-und-wiederrufsbelehrung",
  versand: "/pages/versand",
  datenschutz: "/policies/privacy-policy",
};

/**
 * Höchste veröffentlichte Version eines Rechtstexts, deren effective_from erreicht ist.
 * RLS liefert anon nur veröffentlichte Versionen. Pro Request einmal (React cache).
 */
export const getLegalDocument = cache(
  async (kind: LegalKind, locale = "de"): Promise<LegalDocument | null> => {
    const db = supabaseAnon();
    const { data: doc, error } = await db
      .from("legal_documents")
      .select("id, kind, path, updated_at")
      .eq("kind", kind)
      .maybeSingle();
    if (error || !doc) {
      if (error) console.error(`[legal] ${kind} nicht ladbar`, error);
      return null;
    }

    const nowIso = new Date().toISOString();
    const { data: versions, error: vErr } = await db
      .from("legal_document_versions")
      .select("version, title, body_html, effective_from, created_at")
      .eq("document_id", doc.id)
      .eq("locale", locale)
      .eq("status", "published")
      .or(`effective_from.is.null,effective_from.lte.${nowIso}`)
      .order("version", { ascending: false })
      .limit(1);
    if (vErr) {
      console.error(`[legal] Versionen für ${kind} nicht ladbar`, vErr);
      return null;
    }
    const v = versions?.[0];
    if (!v) return null;

    const structured = structureLegalHtml(kind, v.body_html, v.title);
    return {
      kind,
      path: doc.path,
      title: v.title,
      version: v.version,
      publishedAt: v.effective_from ?? v.created_at,
      updatedAt: doc.updated_at,
      html: structured.html,
      toc: structured.toc,
    };
  },
);

/** Stand aller Rechtstexte für die Sitemap. */
export async function getLegalSitemapEntries(): Promise<{ path: string; lastModified: string }[]> {
  const db = supabaseAnon();
  const { data, error } = await db
    .from("legal_documents")
    .select("path, updated_at, legal_document_versions(created_at, effective_from, status)");
  if (error) {
    console.error("[legal] Sitemap-Einträge nicht ladbar", error);
    return Object.values(LEGAL_PATHS).map((path) => ({
      path,
      lastModified: new Date().toISOString(),
    }));
  }
  return (data ?? []).map((d) => {
    const dates = (d.legal_document_versions ?? [])
      .map((v) => v.effective_from ?? v.created_at)
      .concat(d.updated_at)
      .sort();
    return { path: d.path, lastModified: dates[dates.length - 1] ?? d.updated_at };
  });
}
