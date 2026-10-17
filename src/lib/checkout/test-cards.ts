/**
 * Testkarten für den Mock-Zahlungsanbieter (APP_INTEGRATIONS=mock). Gleiche Nummern wie im
 * Stripe-Testmodus, damit die Abnahme später mit echtem Stripe identisch abläuft:
 *   4242 4242 4242 4242  Zahlung erfolgreich
 *   4000 0000 0000 0002  Zahlung abgelehnt (card_declined)
 *   4000 0025 0000 3155  3-D-Secure nötig (Bestätigungsseite als Simulation)
 * Diese Datei enthält keine echte Kartenlogik und wird im Live-Betrieb nicht verwendet:
 * dort erfasst ausschließlich das Stripe Payment Element die Kartendaten.
 */
export type TestCardOutcome = "succeeded" | "declined" | "requires_action";

export const TEST_CARDS: Record<string, TestCardOutcome> = {
  "4242424242424242": "succeeded",
  "4000000000000002": "declined",
  "4000002500003155": "requires_action",
};

export type CardCheck =
  | { ok: true; outcome: TestCardOutcome; last4: string; brand: string }
  | { ok: false; field: "cardNumber" | "cardExpiry" | "cardCvc"; message: string };

export function normalizeCardNumber(input: string): string {
  return input.replace(/[\s-]/g, "");
}

/** Prüfsumme nach Luhn, wie sie jede Kartennummer erfüllt. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(digits: string): string {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^(5018|5020|5038|6304|6759|676[1-3])/.test(digits)) return "Maestro";
  return "Karte";
}

/** Ablaufdatum "MM / JJ" oder "MM/JJ", muss in der Zukunft liegen (Monatsende zählt). */
export function expiryValid(input: string, now: Date = new Date()): boolean {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(input);
  if (!match) return false;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return false;
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  const endOfMonth = Date.UTC(year, month, 1);
  return endOfMonth > now.getTime();
}

export function checkTestCard(
  input: { number: string; expiry: string; cvc: string },
  now: Date = new Date(),
): CardCheck {
  const digits = normalizeCardNumber(input.number);
  if (!luhnValid(digits)) {
    return { ok: false, field: "cardNumber", message: "Bitte prüf die Kartennummer." };
  }
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
  const outcome = TEST_CARDS[digits];
  if (!outcome) {
    return {
      ok: false,
      field: "cardNumber",
      message:
        "Im Testmodus funktionieren nur die Testkarten 4242 4242 4242 4242, 4000 0000 0000 0002 und 4000 0025 0000 3155.",
    };
  }
  return { ok: true, outcome, last4: digits.slice(-4), brand: cardBrand(digits) };
}
