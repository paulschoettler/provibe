import "server-only";
import { retrySubscriptionPayment, runDueSubscriptions, sendDueReminders } from "./renewal";
import { SUBSCRIPTION_JOB_KINDS, type SubscriptionJobKind } from "./jobs-queue";

/**
 * Registrierung der Abo-Jobs für den gemeinsamen Job-Runner (src/lib/admin/jobs, Paket
 * Bestellungen). Einbau dort (Vorschlag im Bericht):
 *
 *   import { SUBSCRIPTION_JOB_KINDS, runSubscriptionJob } from "@/lib/subscriptions/jobs";
 *   KNOWN_JOB_KINDS: [...CHECKOUT_JOB_KINDS, ...ADMIN_JOB_KINDS, ...SUBSCRIPTION_JOB_KINDS]
 *   dispatchJob: if (isSubscriptionJobKind(job.kind)) return runSubscriptionJob(job);
 *
 * Geplant werden subscription.run_due und subscription.reminder täglich per pg_cron
 * (Migration 20261017107000), subscription.retry legt der Abo-Lauf selbst für Tag 3 und 7 an.
 * Jeder Handler ist wiederholbar: Sperre je Abo (subscription_claim_due, subscription_lock),
 * Idempotenz der Zahlung über den Schlüssel je Termin und Versuch, Bestellung je PaymentIntent.
 */

export { SUBSCRIPTION_JOB_KINDS, type SubscriptionJobKind };

export function isSubscriptionJobKind(kind: string): kind is SubscriptionJobKind {
  return (SUBSCRIPTION_JOB_KINDS as readonly string[]).includes(kind);
}

export async function runSubscriptionJob(job: { kind: string; payload: unknown }): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  switch (job.kind as SubscriptionJobKind) {
    case "subscription.run_due": {
      const summary = await runDueSubscriptions();
      if (summary.errors.length > 0 && summary.errors.length === summary.claimed) {
        // alles gescheitert: Job erneut versuchen lassen (Backoff des Runners)
        throw new Error(
          `Abo-Lauf: ${summary.errors.length} Fehler, z.B. ${summary.errors[0].message}`,
        );
      }
      return;
    }
    case "subscription.reminder":
      await sendDueReminders();
      return;
    case "subscription.retry": {
      const id = payload.subscription_id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("Job subscription.retry: payload.subscription_id fehlt");
      }
      const outcome = await retrySubscriptionPayment(id);
      if (outcome === "locked") throw new Error("Abo gerade gesperrt, später erneut");
      return;
    }
    default:
      throw new Error(`Unbekannter Abo-Job: ${job.kind}`);
  }
}
