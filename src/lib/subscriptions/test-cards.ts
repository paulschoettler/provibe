import { cardBrand, expiryValid, luhnValid, normalizeCardNumber } from "@/lib/checkout/test-cards";

/**
 * Testkarten für das Speichern eines Zahlungsmittels im Abo (nur APP_INTEGRATIONS=mock), gleiche
 * Nummern wie im Stripe-Testmodus. Im Live-Betrieb erfasst ausschließlich Stripe die Kartendaten.
 *   4242 4242 4242 4242  Einrichten und alle Abbuchungen erfolgreich
 *   4000 0025 0000 3155  Einrichten mit 3-D Secure, danach Abbuchungen erfolgreich
 *   4000 0000 0000 0341  Einrichten klappt, spätere Abbuchungen werden abgelehnt
 *   4000 0027 6000 3184  jede Abbuchung verlangt eine Bestätigung
 *   4000 0000 0000 0002  Einrichten wird abgelehnt
 */
export const SETUP_TEST_CARDS: Record<string, "ok" | "declined"> = {
  "4242424242424242": "ok",
  "4000002500003155": "ok",
  "4000000000000341": "ok",
  "4000002760003184": "ok",
  "4000000000000002": "declined",
};

export type SetupCardCheck =
  | { ok: true; last4: string; brand: string; expMonth: number; expYear: number }
  | { ok: false; field: "cardNumber" | "cardExpiry" | "cardCvc"; message: string };

export function checkSetupTestCard(
  input: { number: string; expiry: string; cvc: string },
  now: Date = new Date(),
): SetupCardCheck {
  const digits = normalizeCardNumber(input.number);
  if (!luhnValid(digits))
    return { ok: false, field: "cardNumber", message: "Bitte prüf die Kartennummer." };
  if (!expiryValid(input.expiry, now)) {
    return {
      ok: false,
      field: "cardExpiry",
      message: "Bitte gib ein gültiges Ablaufdatum an (MM / JJ).",
    };
  }
  if (!/^\d{3,4}$/.test(input.cvc.trim())) {
    return { ok: false, field: "cardCvc", message: "Bitte gib die Prüfnummer (CVC) an." };
  }
  const outcome = SETUP_TEST_CARDS[digits];
  if (!outcome) {
    return {
      ok: false,
      field: "cardNumber",
      message:
        "Im Testmodus funktionieren nur die Stripe-Testkarten (zum Beispiel 4242 4242 4242 4242).",
    };
  }
  if (outcome === "declined") {
    return { ok: false, field: "cardNumber", message: "Diese Karte wurde abgelehnt." };
  }
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(input.expiry)!;
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  return {
    ok: true,
    last4: digits.slice(-4),
    brand: cardBrand(digits),
    expMonth: Number(match[1]),
    expYear: year,
  };
}
