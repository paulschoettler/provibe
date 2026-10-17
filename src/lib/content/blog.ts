import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";

/** Blogbeitrag (blog_posts plus blog_post_translations, Migration 20260921121000). */
export interface BlogPost {
  id: string;
  handle: string;
  blogHandle: string;
  authorName: string | null;
  coverImagePath: string | null;
  publishedAt: string | null;
  updatedAt: string;
  title: string;
  excerpt: string | null;
  bodyHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

type Row = {
  id: string;
  handle: string;
  blog_handle: string;
  author_name: string | null;
  cover_image_path: string | null;
  published_at: string | null;
  updated_at: string;
  blog_post_translations: {
    locale: string;
    title: string;
    excerpt: string | null;
    body_html: string | null;
    seo_title: string | null;
    seo_description: string | null;
  }[];
};

const SELECT =
  "id, handle, blog_handle, author_name, cover_image_path, published_at, updated_at, blog_post_translations(locale, title, excerpt, body_html, seo_title, seo_description)";

function toPost(row: Row, locale: string): BlogPost | null {
  const t = row.blog_post_translations.find((x) => x.locale === locale);
  if (!t) return null;
  return {
    id: row.id,
    handle: row.handle,
    blogHandle: row.blog_handle,
    authorName: row.author_name,
    coverImagePath: row.cover_image_path,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    title: t.title,
    excerpt: t.excerpt,
    bodyHtml: t.body_html ?? "",
    seoTitle: t.seo_title,
    seoDescription: t.seo_description,
  };
}

/** Veröffentlichte Beiträge eines Blogs, neueste zuerst. Nur Beiträge mit erreichtem published_at. */
export const getBlogPosts = cache(
  async (blogHandle = "news", locale = "de"): Promise<BlogPost[]> => {
    const { data, error } = await supabaseAnon()
      .from("blog_posts")
      .select(SELECT)
      .eq("blog_handle", blogHandle)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (error) {
      console.error("[blog] Beiträge nicht ladbar", error);
      return [];
    }
    return ((data ?? []) as unknown as Row[])
      .map((r) => toPost(r, locale))
      .filter((p): p is BlogPost => p !== null);
  },
);

export const getBlogPost = cache(
  async (handle: string, blogHandle = "news", locale = "de"): Promise<BlogPost | null> => {
    const { data, error } = await supabaseAnon()
      .from("blog_posts")
      .select(SELECT)
      .eq("blog_handle", blogHandle)
      .eq("handle", handle)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error) {
      console.error(`[blog] Beitrag ${handle} nicht ladbar`, error);
      return null;
    }
    return data ? toPost(data as unknown as Row, locale) : null;
  },
);
