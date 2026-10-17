import { createHash } from "node:crypto";

/**
 * Bewertungslink aus der Automation "Bewertungsanfrage" (src/lib/admin/automations/handlers.ts):
 * Der Token ist randomBytes(24) als base64url (32 Zeichen), in automation_runs.token_hash steht nur
 * der SHA-256-Hash als Hex. Diese Datei bildet den Hash identisch nach, damit beide Seiten dieselbe
 * Funktion nutzen können (Vorschlag im Bericht: handlers.ts importiert hashReviewToken von hier).
 */

/** SHA-256 als Hex, exakt wie in runReviewRequest. */
export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { isPlausibleReviewToken, REVIEW_TOKEN_TTL_DAYS } from "./limits";
