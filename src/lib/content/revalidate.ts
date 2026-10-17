import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { LEGAL_PATHS, type LegalKind } from "./legal";

/**
 * On-Demand-Revalidation für Inhalte (für das Backoffice vorbereitet, Briefing 1).
 * Die Seiten laden ihre Daten über supabase-js und sind per revalidate = 3600 statisch;
 * revalidatePath erneuert sie sofort. Die Tags "content" und "legal" sind für künftige
 * gecachte Datenfunktionen reserviert und werden hier mit ausgelöst.
 */
export const CONTENT_TAG = "content";
export const LEGAL_TAG = "legal";

/** Nach dem Speichern einer Seite im Backoffice aufrufen. */
export function revalidateContentPage(handle: string) {
  revalidateTag(CONTENT_TAG, "max");
  revalidatePath(`/pages/${handle}`);
  revalidatePath("/sitemap.xml");
}

/** Nach dem Veröffentlichen einer Rechtstext-Version aufrufen. */
export function revalidateLegal(kind: LegalKind) {
  revalidateTag(LEGAL_TAG, "max");
  revalidatePath(LEGAL_PATHS[kind]);
  revalidatePath("/sitemap.xml");
}

/** Nach dem Veröffentlichen oder Ändern eines Blogbeitrags aufrufen. */
export function revalidateBlog(handle?: string) {
  revalidateTag(CONTENT_TAG, "max");
  revalidatePath("/blogs/news");
  if (handle) revalidatePath(`/blogs/news/${handle}`);
  revalidatePath("/sitemap.xml");
}
