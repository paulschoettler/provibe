import { publicEnv } from "@/lib/env/public";

/**
 * Open-Graph-Bilder der Storefront. Ohne eigenes Bild nimmt jede Seite das Standardbild
 * (Logo und die drei Dosen, 1200 × 630, public/images/og/provibe.jpg). Inhaltsseiten können im
 * Backoffice ein "Vorschaubild (Social)" hinterlegen (page_translations.og_image_path), das hier
 * Vorrang bekommt. Next führt openGraph nicht zusammen, deshalb setzt jede Route images selbst.
 */
export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/images/og/provibe.jpg",
  width: 1200,
  height: 630,
  alt: "provibe Eistee mit 15 g Protein: Wildberry, Raspberry Lime und Peach",
};

/** Pfad aus dem Backoffice (Speicher, zum Beispiel media/content/bild.webp) oder eigener Pfad */
export function contentImageUrl(path: string): string {
  if (path.startsWith("/") || path.startsWith("http")) return path;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${path}`;
}

/** Bild aus dem Backoffice, sonst das übergebene oder das Standardbild */
export function ogImages(
  path: string | null | undefined,
  alt: string,
  fallback: OgImage = DEFAULT_OG_IMAGE,
): OgImage[] {
  if (!path) return [fallback];
  return [{ url: contentImageUrl(path), width: 1200, height: 630, alt }];
}
