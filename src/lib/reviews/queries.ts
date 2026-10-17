import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";
import { aggregateRatings } from "./logic";
import type { ProductReviews, PublicReview } from "./types";

/**
 * Lesefunktionen für die Produktseite. Anonymer Client (RLS: nur status = 'approved'), lesende
 * Abfragen mit Cache-Tag "reviews" und stündlicher Erneuerung; das Backoffice erneuert gezielt per
 * revalidateReviews() (src/lib/reviews/revalidate.ts). Es werden nur Spalten gelesen, die anon
 * nach Migration 20261017110000 sehen darf (keine Bestell-, Kunden- oder Token-Felder).
 */

const REVIEW_TAGS = ["reviews"];
/** Höchstzahl der Bewertungen, die auf der Produktseite stehen (Rest nur in der Zählung). */
export const PRODUCT_REVIEWS_LIMIT = 50;

function reviewsDb() {
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method ?? "GET").toUpperCase();
        if (method !== "GET") return fetch(input, init);
        return fetch(input, {
          ...init,
          next: { revalidate: 3600, tags: REVIEW_TAGS },
        } as RequestInit);
      },
    },
  });
}

const EMPTY: ProductReviews = { summary: aggregateRatings([]), reviews: [] };

/**
 * Freigegebene Bewertungen eines Produkts: Liste (neueste zuerst), Durchschnitt, Anzahl und
 * Verteilung. Fehler beim Laden führen zu einer leeren Liste, die Produktseite bleibt erreichbar.
 */
export const getProductReviews = cache(async (productId: string): Promise<ProductReviews> => {
  const db = reviewsDb();
  const [ratings, list] = await Promise.all([
    db.from("reviews").select("rating").eq("product_id", productId).eq("status", "approved"),
    db
      .from("reviews")
      .select("id, rating, title, body, author_name, is_verified_purchase, created_at, reply_body")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(PRODUCT_REVIEWS_LIMIT),
  ]);
  if (ratings.error || list.error) {
    console.error("[reviews] Bewertungen konnten nicht geladen werden", {
      productId,
      error: ratings.error?.message ?? list.error?.message,
    });
    return EMPTY;
  }
  const reviews: PublicReview[] = (list.data ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.author_name,
    verified: r.is_verified_purchase,
    createdAt: r.created_at,
    reply: r.reply_body?.trim() ? r.reply_body.trim() : null,
  }));
  return { summary: aggregateRatings((ratings.data ?? []).map((r) => r.rating)), reviews };
});
