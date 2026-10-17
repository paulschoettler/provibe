import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/content/blog";
import { getLegalSitemapEntries } from "@/lib/content/legal";
import { getSitemapPages } from "@/lib/content/pages";
import { publicEnv } from "@/lib/env/public";
import { supabaseAnon } from "@/lib/supabase/server";

/**
 * sitemap.xml (Briefing 7): alle öffentlichen, indexierbaren Routen mit lastmod und
 * Bild-Einträgen für Produkte. Warenkorb, Checkout, Konto, Suche und Admin fehlen bewusst
 * (robots.txt sperrt sie). Seiten mit noindex (Messe) oder ohne Sitemap-Flag fehlen ebenfalls.
 * Stündlich neu erzeugt, sofort per revalidatePath("/sitemap.xml").
 */
export const revalidate = 3600;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.provibe-drinks.de").replace(
  /\/$/,
  "",
);
const url = (path: string) => `${SITE}${path === "/" ? "" : path}` || SITE;

function storageUrl(bucket: string, path: string): string {
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function latest(dates: (string | null | undefined)[]): Date {
  const valid = dates.filter((d): d is string => Boolean(d)).sort();
  return valid.length ? new Date(valid[valid.length - 1]) : new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = supabaseAnon();
  const [products, collections, pages, legal, posts] = await Promise.all([
    db
      .from("products")
      .select("handle, updated_at, product_images(storage_bucket, storage_path, position)")
      .eq("status", "active"),
    db.from("collections").select("handle, updated_at").eq("status", "published"),
    getSitemapPages(),
    getLegalSitemapEntries(),
    getBlogPosts(),
  ]);

  const productRows = products.data ?? [];
  const collectionRows = collections.data ?? [];
  const catalogUpdated = latest([
    ...productRows.map((p) => p.updated_at),
    ...collectionRows.map((c) => c.updated_at),
  ]);
  const legalPaths = new Set(legal.map((l) => l.path));

  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: catalogUpdated, changeFrequency: "weekly", priority: 1 },
    {
      url: url("/collections"),
      lastModified: catalogUpdated,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  for (const c of collectionRows) {
    entries.push({
      url: url(`/collections/${c.handle}`),
      lastModified: new Date(c.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const p of productRows) {
    const images = [...(p.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => storageUrl(i.storage_bucket, i.storage_path));
    entries.push({
      url: url(`/products/${p.handle}`),
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly",
      priority: 0.9,
      images: images.length ? images : undefined,
    });
  }

  for (const page of pages) {
    if (page.noindex || !page.showInSitemap) continue;
    const path = `/pages/${page.handle}`;
    if (legalPaths.has(path)) continue;
    entries.push({
      url: url(path),
      lastModified: new Date(page.updatedAt),
      changeFrequency: "monthly",
      priority: page.handle === "shop" ? 0.8 : 0.5,
    });
  }

  for (const l of legal) {
    entries.push({
      url: url(l.path),
      lastModified: new Date(l.lastModified),
      changeFrequency: "yearly",
      priority: 0.3,
    });
  }

  // Blog erst mit dem ersten Beitrag (vorher noindex, F4)
  if (posts.length > 0) {
    entries.push({
      url: url("/blogs/news"),
      lastModified: latest(posts.map((p) => p.updatedAt)),
      changeFrequency: "weekly",
      priority: 0.5,
    });
    for (const post of posts) {
      entries.push({
        url: url(`/blogs/news/${post.handle}`),
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
