import "server-only";
import { aboDb } from "./db";

/**
 * Jobs des Abos in der gemeinsamen Queue (Tabelle jobs, enqueue_job aus 0010). Ausgeführt vom
 * Job-Runner über runSubscriptionJob (src/lib/subscriptions/jobs.ts).
 */
export const SUBSCRIPTION_JOB_KINDS = [
  "subscription.run_due",
  "subscription.reminder",
  "subscription.retry",
] as const;

export type SubscriptionJobKind = (typeof SUBSCRIPTION_JOB_KINDS)[number];

export async function enqueueSubscriptionJob(input: {
  kind: SubscriptionJobKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAt?: string;
  priority?: number;
  maxAttempts?: number;
}): Promise<string | null> {
  const { data, error } = await aboDb().rpc("enqueue_job", {
    p_kind: input.kind,
    p_payload: input.payload,
    p_run_at: input.runAt ?? new Date().toISOString(),
    p_idempotency_key: input.idempotencyKey,
    p_priority: input.priority ?? (input.kind === "subscription.retry" ? 30 : 20),
    p_max_attempts: input.maxAttempts ?? 5,
  });
  if (error) {
    console.error("[abo] Job nicht angelegt", input.kind, error.message);
    return null;
  }
  return (data as string | null) ?? null;
}
