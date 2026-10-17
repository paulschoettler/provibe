import { normalizeSubscriptionNumber } from "./rules";
import { deliveryDayAt, effectiveNextDelivery, type ScheduleView } from "./schedule";
import type { CancelKind, SubscriptionStatus } from "./types";

/**
 * Kündigungslogik (rein, getestet in cancellation.test.ts). Grundsatz nach § 312k BGB und H23:
 * Die Kündigung ist mit dem Klick erklärt. Ab dann wird nichts mehr abgebucht, außer der Kunde
 * wünscht ausdrücklich einen späteren Zeitpunkt (ordentliche Kündigung zu einem Wunschdatum).
 */

export type CancelTiming = "next_possible" | "date";

export interface CancellationInput {
  kind: CancelKind;
  timing: CancelTiming;
  /** Wunschdatum "YYYY-MM-DD", nur bei timing = date */
  desiredDay?: string | null;
  now: Date;
  subscription: ScheduleView & { status: SubscriptionStatus };
}

export type CancellationPlan =
  | {
      /** sofort gekündigt: Status cancelled, keine weitere Lieferung, keine Abbuchung */
      mode: "immediate";
      cancelledAt: Date;
      /** Vertragsende: nächster Liefertermin (ordentlich) oder sofort (außerordentlich) */
      effectiveAt: Date;
    }
  | {
      /** ordentlich zu einem späteren Wunschdatum: Lieferungen davor laufen weiter */
      mode: "scheduled";
      effectiveAt: Date;
    };

export function planCancellation(input: CancellationInput): CancellationPlan {
  const { now, subscription } = input;
  const next = effectiveNextDelivery(subscription);
  if (input.kind === "extraordinary") {
    return { mode: "immediate", cancelledAt: now, effectiveAt: now };
  }
  const nextPossible = next && next.getTime() > now.getTime() ? next : now;
  if (input.timing === "date" && input.desiredDay) {
    let desired: Date | null = null;
    try {
      desired = deliveryDayAt(input.desiredDay);
    } catch {
      desired = null;
    }
    // Ein Wunschtermin nach der nächsten Lieferung: bis dahin läuft das Abo weiter
    if (desired && next && desired.getTime() > next.getTime()) {
      return { mode: "scheduled", effectiveAt: desired };
    }
  }
  return { mode: "immediate", cancelledAt: now, effectiveAt: nextPossible };
}

/** Portal (Figma 68:1287): "Ab sofort keine weiteren Lieferungen". */
export function planPortalCancellation(
  subscription: CancellationInput["subscription"],
  now: Date,
): CancellationPlan {
  return planCancellation({ kind: "ordinary", timing: "next_possible", now, subscription });
}

export interface MatchCandidate {
  id: string;
  number: string;
  status: SubscriptionStatus;
}

/**
 * Welche Abos betrifft eine Kündigung ohne Login? Grundlage ist die E-Mail-Adresse (die Abfrage
 * filtert schon darauf). Mit Abo-Nummer nur dieses Abo; passt die Nummer zu keinem Abo dieser
 * Adresse, wird nichts automatisch gekündigt, sondern intern geprüft. Ohne Nummer gilt die
 * Erklärung für alle offenen Abos der Adresse.
 */
export function matchCancellation(
  candidates: MatchCandidate[],
  numberInput: string | null | undefined,
): MatchCandidate[] {
  const open = candidates.filter((c) => c.status !== "cancelled");
  const raw = numberInput?.trim() ?? "";
  if (raw.length === 0) return open;
  const number = normalizeSubscriptionNumber(raw);
  if (!number) return [];
  return open.filter((c) => c.number.toUpperCase() === number);
}

/** Namen vergleichen ohne Groß-/Kleinschreibung, Akzente und doppelte Leerzeichen (nur Protokoll). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
