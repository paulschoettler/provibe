import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";

/** Inhaltsseite aus pages und page_translations (nur veröffentlicht, RLS). */
export interface ContentPage {
  id: string;
  handle: string;
  template: string;
  noindex: boolean;
  showInSitemap: boolean;
  updatedAt: string;
  title: string;
  bodyHtml: string;
  blocks: unknown[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImagePath: string | null;
}

/**
 * Lädt eine Seite per Handle. Pro Request einmal (React cache), öffentlich lesbar,
 * daher statisch generierbar. Gibt null zurück, wenn die Seite fehlt oder nicht veröffentlicht ist.
 */
export const getPage = cache(async (handle: string, locale = "de"): Promise<ContentPage | null> => {
  const db = supabaseAnon();
  const { data: page, error } = await db
    .from("pages")
    .select("id, handle, template, noindex, show_in_sitemap, updated_at")
    .eq("handle", handle)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error(`[content] Seite ${handle} konnte nicht geladen werden`, error);
    return null;
  }
  if (!page) return null;

  const { data: t } = await db
    .from("page_translations")
    .select("title, body_html, blocks, seo_title, seo_description, og_image_path")
    .eq("page_id", page.id)
    .eq("locale", locale)
    .maybeSingle();
  if (!t) return null;

  return {
    id: page.id,
    handle: page.handle,
    template: page.template,
    noindex: page.noindex,
    showInSitemap: page.show_in_sitemap,
    updatedAt: page.updated_at,
    title: t.title,
    bodyHtml: t.body_html ?? "",
    blocks: Array.isArray(t.blocks) ? t.blocks : [],
    seoTitle: t.seo_title,
    seoDescription: t.seo_description,
    ogImagePath: t.og_image_path,
  };
});

/** Alle veröffentlichten Seiten für die Sitemap (Handle, Stand, Indexierung). */
export async function getSitemapPages(): Promise<
  { handle: string; updatedAt: string; noindex: boolean; showInSitemap: boolean }[]
> {
  const { data, error } = await supabaseAnon()
    .from("pages")
    .select("handle, updated_at, noindex, show_in_sitemap")
    .eq("status", "published");
  if (error) {
    console.error("[content] Seiten für die Sitemap nicht ladbar", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    handle: p.handle,
    updatedAt: p.updated_at,
    noindex: p.noindex,
    showInSitemap: p.show_in_sitemap,
  }));
}
