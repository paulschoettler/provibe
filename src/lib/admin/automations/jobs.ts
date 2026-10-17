import "server-only";
import { dispatchCampaign, sendCampaignBatch } from "@/lib/admin/newsletter/sending";
import { runAbandonedCart, runAutomationSweep, runReviewRequest, runWelcome } from "./handlers";
import { CRM_JOB_KINDS, type CrmJobKind } from "./queue";

/**
 * Einstieg für den gemeinsamen Job-Runner (Paket Bestellungen, src/lib/admin/jobs): Jobs mit kind
 * aus CRM_JOB_KINDS an runCrmJob übergeben, danach complete_job bzw. fail_job. Wirft bei Fehlern,
 * damit der Runner mit Backoff erneut versucht.
 */
export { CRM_JOB_KINDS, type CrmJobKind };
export { enqueueCrmJob } from "./queue";
export { ensureCrmSweepScheduled } from "./automations";

export function isCrmJobKind(kind: string): kind is CrmJobKind {
  return (CRM_JOB_KINDS as readonly string[]).includes(kind);
}

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (typeof v !== "string" || !v) throw new Error(`Job-Payload ohne ${key}`);
  return v;
}

export async function runCrmJob(job: { kind: string; payload: unknown }): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  switch (job.kind as CrmJobKind) {
    case "automation.sweep":
      await runAutomationSweep();
      return;
    case "automation.welcome":
      return runWelcome(str(payload, "run_id"));
    case "automation.abandoned_cart":
      return runAbandonedCart(str(payload, "run_id"));
    case "automation.review_request":
      return runReviewRequest(str(payload, "run_id"));
    case "newsletter.dispatch":
      return dispatchCampaign(str(payload, "campaign_id"));
    case "newsletter.send_batch":
      return sendCampaignBatch(str(payload, "campaign_id"), Number(payload.batch ?? 1) || 1);
    default:
      throw new Error(`Unbekannter CRM-Job: ${job.kind}`);
  }
}
