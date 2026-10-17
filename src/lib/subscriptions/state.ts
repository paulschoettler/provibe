import type { SubscriptionStatus } from "./types";

/**
 * Zustandsmaschine des Abos (rein, getestet in state.test.ts).
 *
 *   draft ──activate──▶ active ──pause──▶ paused ──resume──▶ active
 *                         │  ▲                ▲
 *            payment_failed  payment_succeeded │ payment_exhausted (nach Tag 7)
 *                         ▼  │                 │
 *                       past_due ──────────────┘
 *   jeder Zustand außer cancelled ──cancel──▶ cancelled (endgültig)
 *
 * In der Datenbank sichert subscription_apply ab, dass der Status beim Schreiben noch dem
 * erwarteten Ausgangszustand entspricht (FOR UPDATE), siehe Migration 20261017107000.
 */

export type SubscriptionEvent =
  | "activate"
  | "pause"
  | "resume"
  | "skip"
  | "change"
  | "payment_failed"
  | "payment_action_required"
  | "payment_succeeded"
  | "payment_exhausted"
  | "cancel";

const TRANSITIONS: Record<
  SubscriptionEvent,
  Partial<Record<SubscriptionStatus, SubscriptionStatus>>
> = {
  activate: { draft: "active" },
  pause: { active: "paused", paused: "paused" },
  resume: { paused: "active" },
  skip: { active: "active" },
  change: { active: "active", paused: "paused", past_due: "past_due" },
  payment_failed: { active: "past_due", past_due: "past_due" },
  payment_action_required: { active: "past_due", past_due: "past_due" },
  payment_succeeded: { active: "active", past_due: "active", paused: "active" },
  payment_exhausted: { past_due: "paused" },
  cancel: { draft: "cancelled", active: "cancelled", paused: "cancelled", past_due: "cancelled" },
};

export class SubscriptionStateError extends Error {
  constructor(
    readonly from: SubscriptionStatus,
    readonly event: SubscriptionEvent,
  ) {
    super(`Abo im Status ${from} erlaubt ${event} nicht`);
    this.name = "SubscriptionStateError";
  }
}

export function canTransition(from: SubscriptionStatus, event: SubscriptionEvent): boolean {
  return TRANSITIONS[event][from] !== undefined;
}

export function nextStatus(from: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
  const to = TRANSITIONS[event][from];
  if (!to) throw new SubscriptionStateError(from, event);
  return to;
}

/** Ausgangszustände, aus denen das Ereignis erlaubt ist (für subscription_apply p_expected). */
export function allowedFrom(event: SubscriptionEvent): SubscriptionStatus[] {
  return Object.keys(TRANSITIONS[event]) as SubscriptionStatus[];
}

/** Kunde darf im Portal ändern (Sorte, Menge, Intervall, Adresse, Zahlungsmittel). */
export function isEditable(status: SubscriptionStatus): boolean {
  return canTransition(status, "change");
}

export function isOpen(status: SubscriptionStatus): boolean {
  return status !== "cancelled";
}
