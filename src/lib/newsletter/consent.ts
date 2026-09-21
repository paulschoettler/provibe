import { createHash } from "node:crypto";

/**
 * Wortlaut und Version der Einwilligung. Beides wird je Kontakt gespeichert,
 * damit wir später belegen können, wem wozu zugestimmt wurde (DSGVO Art. 7 Abs. 1).
 * Liegt bewusst außerhalb der Server Actions: eine "use server"-Datei darf nur
 * asynchrone Funktionen exportieren.
 */
export const CONSENT_TEXT =
  "Mit dem Absenden stimmst du dem Erhalt unseres Newsletters zu. Du bestätigst deine Adresse per E-Mail und kannst dich jederzeit abmelden.";
export const CONSENT_VERSION = "2026-09";

/** Gültigkeit des Bestätigungslinks in Tagen */
export const OPT_IN_TTL_DAYS = 7;

/** In der Datenbank liegt nur der Hash, nie das Token selbst. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface NewsletterFormState {
  status: "idle" | "ok" | "error";
  message: string;
}

export const NEWSLETTER_INITIAL_STATE: NewsletterFormState = { status: "idle", message: "" };

/**
 * Neutrale Erfolgsmeldung. Sie ist für jede Eingabe gleich, damit von außen nicht
 * erkennbar ist, ob eine Adresse schon angemeldet ist (kein Info-Leak).
 */
export const NEWSLETTER_SUCCESS_MESSAGE =
  "Fast geschafft! Bitte bestätige deine Adresse über den Link in deiner E-Mail.";
