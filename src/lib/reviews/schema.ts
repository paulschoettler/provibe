import { z } from "zod";
import {
  isPlausibleReviewToken,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_TITLE_MAX,
} from "./limits";

export { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_TITLE_MAX };

/**
 * Eingaben des Bewertungsformulars (serverseitig geprüft). Sterne Pflicht, Titel optional bis
 * 80 Zeichen, Text 20 bis 1.500 Zeichen. Steuerzeichen außer Zeilenumbruch werden entfernt.
 */

function stripControl(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");
}

export const reviewInputSchema = z.object({
  token: z.string().refine(isPlausibleReviewToken, "Der Bewertungslink ist ungültig."),
  productId: z.uuid("Unbekanntes Produkt."),
  rating: z.coerce
    .number({ error: "Bitte wähle 1 bis 5 Sterne." })
    .int("Bitte wähle 1 bis 5 Sterne.")
    .min(1, "Bitte wähle 1 bis 5 Sterne.")
    .max(5, "Bitte wähle 1 bis 5 Sterne."),
  title: z
    .string()
    .transform((v) => stripControl(v).replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .max(REVIEW_TITLE_MAX, `Der Titel darf höchstens ${REVIEW_TITLE_MAX} Zeichen haben.`),
    )
    .transform((v) => (v ? v : null)),
  body: z
    .string()
    .transform((v) =>
      stripControl(v)
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(REVIEW_BODY_MIN, `Bitte schreib mindestens ${REVIEW_BODY_MIN} Zeichen.`)
        .max(REVIEW_BODY_MAX, `Bitte fasse dich kürzer (höchstens ${REVIEW_BODY_MAX} Zeichen).`),
    ),
});

export type ReviewInput = z.output<typeof reviewInputSchema>;

/** Feldfehler (erster Fehler je Feld) für das Formular. */
export function reviewFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
