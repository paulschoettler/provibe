/**
 * Terminberechnung des Abos (rein, getestet in schedule.test.ts). Alle Zeitpunkte in UTC.
 *
 * Ein Liefertag ist ein Kalendertag in Europe/Berlin. Gespeichert wird er als Zeitpunkt 04:00 UTC
 * dieses Tages (06:00 Sommerzeit, 05:00 Winterzeit). Der tägliche Abo-Lauf (pg_cron 05:41 UTC)
 * findet so alle Lieferungen des Tages, und die Anzeige ist in jeder Zeitzone derselbe Tag.
 */

const DAY_MS = 86_400_000;
const DELIVERY_HOUR_UTC = 4;

const berlinDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalendertag in Europe/Berlin als "YYYY-MM-DD". */
export function berlinDay(date: Date): string {
  return berlinDate.format(date);
}

/** Zeitpunkt des Liefertags "YYYY-MM-DD" (04:00 UTC). */
export function deliveryDayAt(day: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`Ungültiges Datum: ${day}`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d, DELIVERY_HOUR_UTC));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`Ungültiges Datum: ${day}`);
  }
  return date;
}

/** Liefertag des Zeitpunkts plus days Tage (Kalendertage, robust gegen Zeitumstellung). */
export function addDeliveryDays(date: Date, days: number): Date {
  const base = deliveryDayAt(berlinDay(date));
  return new Date(base.getTime() + days * DAY_MS);
}

export function addDeliveryWeeks(date: Date, weeks: number): Date {
  return addDeliveryDays(date, weeks * 7);
}

/** Nächste Lieferung nach der ersten Bestellung: Bestelltag plus Intervall. */
export function firstNextOrderAt(orderedAt: Date, intervalWeeks: number): Date {
  return addDeliveryWeeks(orderedAt, intervalWeeks);
}

/**
 * Nächste Lieferung nach einer erfolgreichen Lieferung. Der Rhythmus bleibt am geplanten Termin
 * (scheduled). Lag die Lieferung so spät (Zahlung offen, Bestand), dass der nächste Termin schon
 * erreicht wäre, zählt das Intervall ab heute, damit nie zweimal kurz hintereinander abgebucht wird.
 */
export function nextOrderAfterDelivery(
  scheduled: Date | null,
  now: Date,
  intervalWeeks: number,
): Date {
  const fromSchedule = addDeliveryWeeks(scheduled ?? now, intervalWeeks);
  const earliest = addDeliveryDays(now, Math.max(7, intervalWeeks * 7 - 7));
  return fromSchedule.getTime() >= earliest.getTime()
    ? fromSchedule
    : addDeliveryWeeks(now, intervalWeeks);
}

/** Termin nach dem Überspringen einer Lieferung. */
export function nextOrderAfterSkip(scheduled: Date, intervalWeeks: number): Date {
  return addDeliveryWeeks(scheduled, intervalWeeks);
}

export interface ScheduleView {
  status: string;
  next_order_at: string | null;
  paused_until: string | null;
  skip_next: boolean;
  interval_count: number;
  cancel_effective_at?: string | null;
}

/**
 * Tatsächlich nächste Lieferung für Anzeige und Mails: pausiert bis paused_until, mit
 * Überspringen ein Intervall später; null, wenn gekündigt oder die Kündigung vorher greift.
 */
export function effectiveNextDelivery(s: ScheduleView): Date | null {
  if (s.status === "cancelled" || s.status === "draft") return null;
  let next: Date | null = null;
  if (s.status === "paused") next = s.paused_until ? new Date(s.paused_until) : null;
  else if (s.next_order_at) {
    const base = new Date(s.next_order_at);
    next = s.skip_next ? nextOrderAfterSkip(base, s.interval_count) : base;
  }
  if (
    next &&
    s.cancel_effective_at &&
    next.getTime() >= new Date(s.cancel_effective_at).getTime()
  ) {
    return null;
  }
  return next;
}

export type PauseCheck = { ok: true; until: Date } | { ok: false; message: string };

/**
 * Pause bis zu einem Tag: frühestens morgen, höchstens maxDays Tage ab heute (H25: 6 Monate,
 * Einstellung subscription_pause_max_days = 183). An diesem Tag kommt die nächste Lieferung.
 */
export function validatePauseUntil(day: string, now: Date, maxDays: number): PauseCheck {
  let until: Date;
  try {
    until = deliveryDayAt(day);
  } catch {
    return { ok: false, message: "Bitte gib ein gültiges Datum an." };
  }
  const tomorrow = addDeliveryDays(now, 1);
  const latest = addDeliveryDays(now, maxDays);
  if (until.getTime() < tomorrow.getTime()) {
    return { ok: false, message: "Das Datum muss in der Zukunft liegen." };
  }
  if (until.getTime() > latest.getTime()) {
    return {
      ok: false,
      message: `Du kannst höchstens ${Math.round(maxDays / 30.5)} Monate pausieren (bis ${formatDay(latest)}).`,
    };
  }
  return { ok: true, until };
}

/** Vorschläge im Pause-Dialog (Figma 68:1101): 2, 4 und 8 Wochen ab der geplanten Lieferung. */
export function pauseSuggestions(
  nextDelivery: Date | null,
  now: Date,
  maxDays: number,
  weeks: number[] = [2, 4, 8],
): { weeks: number; until: Date; day: string }[] {
  const base = nextDelivery && nextDelivery.getTime() > now.getTime() ? nextDelivery : now;
  const latest = addDeliveryDays(now, maxDays).getTime();
  return weeks
    .map((w) => {
      const until = addDeliveryWeeks(base, w);
      return { weeks: w, until, day: berlinDay(until) };
    })
    .filter((s) => s.until.getTime() <= latest);
}

/** Fortsetzen: nächste Lieferung morgen (der tägliche Lauf bucht dann ab). */
export function resumeNextOrderAt(now: Date): Date {
  return addDeliveryDays(now, 1);
}

export type RetryDecision =
  { action: "retry"; at: Date; attempt: number; nextAttemptDays: number } | { action: "pause" };

/**
 * Nach einer abgelehnten Zahlung: failedAttempts zählt alle Fehlschläge dieses Termins
 * (1 = erster Versuch gescheitert). Mit retryDays [3, 7] folgt ein Versuch an Tag 3 und an
 * Tag 7 nach dem ersten Fehlschlag; scheitert auch der letzte, wird das Abo pausiert.
 */
export function retryDecision(
  retryDays: number[],
  failedAttempts: number,
  firstFailedAt: Date,
): RetryDecision {
  const index = failedAttempts - 1;
  if (index < 0) throw new RangeError("failedAttempts muss mindestens 1 sein");
  const days = retryDays[index];
  if (days === undefined) return { action: "pause" };
  return {
    action: "retry",
    at: new Date(firstFailedAt.getTime() + days * DAY_MS),
    attempt: failedAttempts + 1,
    nextAttemptDays: days,
  };
}

/** Alle noch ausstehenden Wiederholungstermine (für Mail und Portal: "am 18.10. und 22.10."). */
export function remainingRetryDates(
  retryDays: number[],
  failedAttempts: number,
  firstFailedAt: Date,
): Date[] {
  return retryDays
    .slice(Math.max(0, failedAttempts - 1))
    .map((d) => new Date(firstFailedAt.getTime() + d * DAY_MS));
}

export interface ReminderView extends ScheduleView {
  reminder_sent_for: string | null;
}

/** Erinnerung fällig: aktiv, nicht übersprungen, Lieferung in höchstens reminderDays Tagen. */
export function reminderDue(s: ReminderView, now: Date, reminderDays: number): boolean {
  if (s.status !== "active" || s.skip_next || !s.next_order_at) return false;
  if (s.reminder_sent_for && s.reminder_sent_for === s.next_order_at) return false;
  if (
    s.reminder_sent_for &&
    new Date(s.reminder_sent_for).getTime() === new Date(s.next_order_at).getTime()
  ) {
    return false;
  }
  const next = new Date(s.next_order_at).getTime();
  if (s.cancel_effective_at && next >= new Date(s.cancel_effective_at).getTime()) return false;
  const remaining = next - now.getTime();
  return remaining > 0 && remaining <= reminderDays * DAY_MS + DAY_MS / 2;
}

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "14.11.2026" */
export function formatDay(date: Date | string): string {
  return dayFormatter.format(typeof date === "string" ? new Date(date) : date);
}

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "17.10.2026 um 14:32 Uhr" */
export function formatDayTime(date: Date | string): string {
  const parts = dateTimeFormatter.formatToParts(typeof date === "string" ? new Date(date) : date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} um ${get("hour")}:${get("minute")} Uhr`;
}
