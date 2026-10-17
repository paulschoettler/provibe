import "server-only";
import { asJson, crmDb } from "@/lib/admin/customers/crm-db";

/**
 * Jobs des CRM-Pakets in die gemeinsame Queue (Tabelle jobs, enqueue_job mit Idempotenzschlüssel).
 * Abgearbeitet vom Job-Runner des Pakets Bestellungen (src/lib/admin/jobs), der runCrmJob aufruft.
 */

export const CRM_JOB_KINDS = [
  "automation.sweep",
  "automation.welcome",
  "automation.abandoned_cart",
  "automation.review_request",
  "newsletter.dispatch",
  "newsletter.send_batch",
] as const;

export type CrmJobKind = (typeof CRM_JOB_KINDS)[number];

export interface EnqueueCrmJobInput {
  kind: CrmJobKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAt?: string;
  priority?: number;
  maxAttempts?: number;
}

/** Job anlegen; null, wenn es den Schlüssel schon gibt (idempotent). */
export async function enqueueCrmJob(input: EnqueueCrmJobInput): Promise<string | null> {
  const { data, error } = await crmDb().rpc("enqueue_job", {
    p_kind: input.kind,
    p_payload: asJson(input.payload),
    p_run_at: input.runAt ?? new Date().toISOString(),
    p_idempotency_key: input.idempotencyKey,
    p_priority: input.priority ?? 120,
    p_max_attempts: input.maxAttempts ?? 6,
  });
  if (error) throw new Error(`Job ${input.kind} nicht angelegt: ${error.message}`);
  return (data as string | null) ?? null;
}

/** Laufende oder wartende Jobs eines Kinds mit Payload-Feld abbrechen (z.B. Kampagne entplant). */
export async function cancelQueuedJobs(
  kind: CrmJobKind,
  payloadMatch: Record<string, string>,
): Promise<number> {
  const { data, error } = await crmDb()
    .from("jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("kind", kind)
    .eq("status", "queued")
    .contains("payload", payloadMatch)
    .select("id");
  if (error) throw new Error(`Jobs nicht abgebrochen: ${error.message}`);
  return data?.length ?? 0;
}
