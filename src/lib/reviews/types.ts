import type { RatingSummary } from "./logic";

/** Freigegebene Bewertung, wie sie die Produktseite zeigt (keine IDs von Bestellung oder Kunde). */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  verified: boolean;
  createdAt: string;
  /** Antwort des Shops, falls vorhanden */
  reply: string | null;
}

export interface ProductReviews {
  summary: RatingSummary;
  /** Neueste zuerst */
  reviews: PublicReview[];
}

/** Bestehende Bewertung des Kunden zu einem Produkt seiner Bestellung (zum Ändern). */
export interface OwnReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: "pending" | "approved" | "rejected";
}

export interface ReviewFormItem {
  productId: string;
  orderItemId: string;
  handle: string | null;
  title: string;
  /** Zweite Zeile, zum Beispiel "Eistee · 0,33 l · 12 Dosen" */
  meta: string | null;
  image: { src: string; alt: string; width: number; height: number } | null;
  /** Hintergrund hinter dem Produktbild (Sortenfarbe), Hex */
  tint: string;
  existing: OwnReview | null;
}

export type ReviewTokenResult =
  | {
      status: "ok";
      orderId: string;
      orderNumber: string;
      placedAt: string;
      customerId: string | null;
      authorName: string;
      tokenHash: string;
      expiresAt: string;
      items: ReviewFormItem[];
    }
  | { status: "invalid" | "expired" | "not_delivered" | "cancelled" | "error" };

/** Zustand des Bewertungsformulars für useActionState. */
export interface ReviewFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: { rating?: string; title?: string; body?: string };
}

export const INITIAL_REVIEW_FORM_STATE: ReviewFormState = { status: "idle" };
