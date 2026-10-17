"use server";

import { redirect } from "next/navigation";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/security/rate-limit";
import { saveReview } from "./data";
import { reviewFieldErrors, reviewInputSchema } from "./schema";
import type { ReviewFormState } from "./types";

const FIELDS = ["token", "productId", "rating", "title", "body", "website"] as const;
const THANKS_PATH = "/bewerten/danke";

const ERROR_FIELDS = "Bitte prüfe die markierten Felder.";
const ERROR_FAILED =
  "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal oder schreib uns an hello@provibe-drinks.de.";
const ERROR_TOKEN =
  "Dein Bewertungslink ist nicht mehr gültig. Schreib uns kurz an hello@provibe-drinks.de, dann schicken wir dir einen neuen.";
const ERROR_PRODUCT = "Dieses Produkt gehört nicht zu deiner Bestellung.";

function read(formData: FormData) {
  const out = {} as Record<(typeof FIELDS)[number], string>;
  for (const k of FIELDS) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

/**
 * Bewertung absenden (Server Action für useActionState, funktioniert auch ohne JavaScript).
 * Ablauf: Honeypot, Zod, Rate Limit, Token erneut prüfen, speichern. Danach Redirect: sind noch
 * Produkte der Bestellung unbewertet, zurück zum Formular mit Erfolgshinweis, sonst Dankesseite.
 */
export async function submitReview(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const raw = read(formData);
  const values = {
    rating: raw.rating,
    title: raw.title.slice(0, 200),
    body: raw.body.slice(0, 4000),
  };
  // Honeypot gefüllt: still beenden, für Bots sieht es nach Erfolg aus
  if (raw.website) redirect(THANKS_PATH);

  const parsed = reviewInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = reviewFieldErrors(parsed.error);
    if (fieldErrors.token || fieldErrors.productId) {
      return { status: "error", message: fieldErrors.token ? ERROR_TOKEN : ERROR_PRODUCT, values };
    }
    return { status: "error", message: ERROR_FIELDS, fieldErrors, values };
  }

  const limit = await checkRateLimit({ action: "review", limit: 10, windowSeconds: 3600 });
  if (!limit.allowed) return { status: "error", message: RATE_LIMIT_MESSAGE, values };

  const result = await saveReview(parsed.data);
  if (!result.ok) {
    const message =
      result.reason === "invalid_token"
        ? result.tokenStatus === "error"
          ? ERROR_FAILED
          : ERROR_TOKEN
        : result.reason === "unknown_product"
          ? ERROR_PRODUCT
          : ERROR_FAILED;
    return { status: "error", message, values };
  }

  if (result.remaining > 0) {
    const params = new URLSearchParams({
      token: parsed.data.token,
      gespeichert: parsed.data.productId,
    });
    redirect(`/bewerten?${params.toString()}#produkt-${parsed.data.productId}`);
  }
  redirect(THANKS_PATH);
}
