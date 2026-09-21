/**
 * Geldbeträge sind im gesamten System Integer in Cent (EUR).
 * Diese Helfer sind die einzige Stelle, an der gerundet und formatiert wird.
 */
export type Cents = number;

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(cents: Cents): string {
  return eurFormatter.format(cents / 100);
}

/** Kaufmännisch runden (Half away from zero), z.B. für Prozentrabatte. */
export function roundHalfAwayFromZero(value: number): Cents {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Prozentsatz in Basispunkten anwenden: 1000 bp = 10 %. */
export function applyBasisPoints(cents: Cents, bp: number): Cents {
  return roundHalfAwayFromZero((cents * bp) / 10_000);
}

/** Enthaltene MwSt. aus einem Bruttobetrag herausrechnen (rate_bp 1900 = 19 %). */
export function includedTaxFromGross(grossCents: Cents, rateBp: number): Cents {
  return roundHalfAwayFromZero(grossCents - (grossCents * 10_000) / (10_000 + rateBp));
}

export function netFromGross(grossCents: Cents, rateBp: number): Cents {
  return grossCents - includedTaxFromGross(grossCents, rateBp);
}

export function assertCents(value: unknown, label = "Betrag"): asserts value is Cents {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new TypeError(`${label} muss eine ganze Zahl in Cent sein, erhalten: ${String(value)}`);
  }
}

/**
 * Einen Gesamtbetrag proportional auf Positionen verteilen, ohne Rundungsdifferenz
 * (Largest-Remainder-Verfahren). Wird für Rabatt-Zuordnung je Position genutzt.
 */
export function allocateProportionally(total: Cents, weights: number[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] += 1;
    remainder -= 1;
  }
  return floored;
}
