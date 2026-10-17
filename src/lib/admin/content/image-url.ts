import { publicEnv } from "@/lib/env/public";

/**
 * Öffentliche URL eines gespeicherten Bildpfads aus Inhalten (rein, auch im Client nutzbar):
 * absolute Adresse und /lokal bleiben, "media/..." und "product-media/..." zeigen auf den
 * öffentlichen Bucket, alles andere gilt als Pfad in product-media (Seed-Bilder).
 */
export function contentImageUrl(path: string | null | undefined): string | null {
  const p = String(path ?? "").trim();
  if (!p) return null;
  if (p.startsWith("/") || /^https?:\/\//i.test(p)) return p;
  const base = publicEnv.supabaseUrl.replace(/\/+$/, "");
  if (!base) return null;
  const withBucket = /^(media|product-media)\//.test(p) ? p : `product-media/${p}`;
  return `${base}/storage/v1/object/public/${withBucket.split("/").map(encodeURIComponent).join("/")}`;
}
