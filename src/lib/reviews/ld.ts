import { isoDateBerlin, type RatingSummary } from "./logic";
import type { PublicReview } from "./types";

/**
 * JSON-LD-Erweiterung für das Product-Objekt (Briefing 3 und 7): AggregateRating und Review nur,
 * wenn mindestens eine freigegebene, echte Bewertung existiert. Ohne Bewertung ein leeres Objekt,
 * damit `{ ...productLd(product), ...reviewsLd(...) }` nichts hinzufügt.
 */
export function reviewsLd(
  summary: RatingSummary,
  reviews: PublicReview[],
  maxReviews = 10,
): Record<string, unknown> {
  if (summary.count === 0 || summary.averageRounded === null || reviews.length === 0) return {};
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.averageRounded.toFixed(1),
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, maxReviews).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      datePublished: isoDateBerlin(r.createdAt),
      ...(r.title ? { name: r.title } : {}),
      ...(r.body ? { reviewBody: r.body } : {}),
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
    })),
  };
}
