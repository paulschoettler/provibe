import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-Demand-Revalidation der Bewertungen. Die Produktseiten lesen freigegebene Bewertungen mit dem
 * Cache-Tag "reviews" (src/lib/reviews/queries.ts). Das Backoffice ruft revalidateReviews nach
 * Freigabe, Ablehnung, Antwort oder Löschung auf; expire 0, damit eine abgelehnte Bewertung sofort
 * verschwindet und nicht noch aus dem veralteten Cache ausgeliefert wird.
 */
export const REVIEWS_TAG = "reviews";

export function revalidateReviews(productHandle?: string | null) {
  revalidateTag(REVIEWS_TAG, { expire: 0 });
  if (productHandle) revalidatePath(`/products/${productHandle}`);
}
