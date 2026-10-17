import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { checkoutDb } from "./db";
import {
  createInvoiceForOrder,
  releaseExpiredSession,
  sendInternalNotification,
  sendOrderConfirmation,
  sendPaymentConfirmation,
  subscribeNewsletterFromCheckout,
  trackPurchase,
} from "./post-order";

/**
 * Nachgelagerte Aufgaben des Checkouts laufen über die Job-Queue in Postgres (Tabelle jobs,
 * Retries mit Backoff in fail_job, Idempotenz über idempotency_key). Eine Bestellung scheitert
 * nie an Mail, Rechnung oder Tracking: Die Jobs werden direkt nach der Bestellung einmal inline
 * versucht; was dabei scheitert, holt ein Worker später nach (claim_jobs, Kinds unten).
 *
 * Für den gemeinsamen Job-Runner (Netlify Scheduled Function, Paket Backoffice): Jobs mit
 * kind aus CHECKOUT_JOB_KINDS an runCheckoutJob übergeben, danach complete_job bzw. fail_job.
 */

export const CHECKOUT_JOB_KINDS = [
  "checkout.release_reservation",
  "email.order_confirmation",
  "email.payment_confirmation",
  "email.order_internal",
  "lexware.create_invoice",
  "newsletter.checkout_opt_in",
  "tracking.purchase",
] as const;

export type CheckoutJobKind = (typeof CHECKOUT_JOB_KINDS)[number];

export interface EnqueueInput {
  kind: CheckoutJobKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAt?: string;
  priority?: number;
  orderId?: string | null;
  maxAttempts?: number;
}

/** Job anlegen; null, wenn es den Job mit diesem Schlüssel schon gibt. */
export async function enqueueJob(input: EnqueueInput): Promise<string | null> {
  const { data, error } = await checkoutDb().rpc("enqueue_job", {
    p_kind: input.kind,
    p_payload: input.payload as Json,
    p_run_at: input.runAt ?? new Date().toISOString(),
    p_idempotency_key: input.idempotencyKey,
    p_priority: input.priority ?? 100,
    p_order_id: input.orderId ?? undefined,
    p_max_attempts: input.maxAttempts ?? 8,
  });
  if (error) {
    console.error("[checkout] Job konnte nicht angelegt werden", input.kind, error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export async function runCheckoutJob(job: { kind: string; payload: unknown }): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, string>;
  switch (job.kind as CheckoutJobKind) {
    case "checkout.release_reservation":
      return releaseExpiredSession(payload.checkout_session_id);
    case "email.order_confirmation":
      return sendOrderConfirmation(payload.order_id);
    case "email.payment_confirmation":
      return sendPaymentConfirmation(payload.order_id);
    case "email.order_internal":
      return sendInternalNotification(payload.order_id);
    case "lexware.create_invoice":
      return createInvoiceForOrder(payload.order_id);
    case "newsletter.checkout_opt_in":
      return subscribeNewsletterFromCheckout(payload.order_id);
    case "tracking.purchase":
      return trackPurchase(payload.order_id);
    default:
      throw new Error(`Unbekannter Checkout-Job: ${job.kind}`);
  }
}

/**
 * Frisch angelegte Jobs sofort ausführen. Der Job wird vorher auf running gesetzt, damit ein
 * parallel laufender Worker ihn nicht doppelt bearbeitet.
 */
export async function runJobsNow(ids: (string | null)[]): Promise<void> {
  const db = checkoutDb();
  for (const id of ids) {
    if (!id) continue;
    const { data: job } = await db
      .from("jobs")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: "checkout-inline",
        attempts: 1,
      })
      .eq("id", id)
      .eq("status", "queued")
      .select("id, kind, payload")
      .maybeSingle();
    if (!job) continue;
    try {
      await runCheckoutJob(job);
      await db.rpc("complete_job", { p_id: job.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[checkout] Job fehlgeschlagen, Retry folgt", job.kind, message);
      await db.rpc("fail_job", { p_id: job.id, p_error: message.slice(0, 2000) });
    }
  }
}
