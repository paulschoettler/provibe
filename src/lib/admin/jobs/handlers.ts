import "server-only";
import { ensureInvoice } from "@/lib/admin/invoices/invoices";
import { sendRefundMail, sendShippingMail } from "@/lib/admin/orders/notifications";
import { CHECKOUT_JOB_KINDS, runCheckoutJob } from "@/lib/checkout/jobs";
import { CRM_JOB_KINDS, isCrmJobKind, runCrmJob } from "@/lib/admin/automations/jobs";
import {
  isSubscriptionJobKind,
  runSubscriptionJob,
  SUBSCRIPTION_JOB_KINDS,
} from "@/lib/subscriptions/jobs";
import type { ClaimedJob } from "./core";

/**
 * Verteilung der Jobs nach kind. Checkout-Kinds (inklusive checkout.release_reservation) laufen
 * über runCheckoutJob (src/lib/checkout/jobs.ts), die Backoffice-Kinds über die Handler hier.
 */
export const ADMIN_JOB_KINDS = [
  "order.shipping_mail",
  "order.refund_mail",
  "invoice.create",
] as const;
export type AdminJobKind = (typeof ADMIN_JOB_KINDS)[number];

export const KNOWN_JOB_KINDS: readonly string[] = [
  ...CHECKOUT_JOB_KINDS,
  ...ADMIN_JOB_KINDS,
  ...CRM_JOB_KINDS,
  ...SUBSCRIPTION_JOB_KINDS,
];

function requireString(payload: Record<string, unknown>, key: string, kind: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Job ${kind}: payload.${key} fehlt`);
  }
  return value;
}

export async function dispatchJob(job: Pick<ClaimedJob, "kind" | "payload">): Promise<void> {
  if ((CHECKOUT_JOB_KINDS as readonly string[]).includes(job.kind)) {
    return runCheckoutJob(job);
  }
  if (isCrmJobKind(job.kind)) {
    return runCrmJob(job);
  }
  if (isSubscriptionJobKind(job.kind)) {
    return runSubscriptionJob(job);
  }
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  switch (job.kind as AdminJobKind) {
    case "order.shipping_mail":
      return sendShippingMail(requireString(payload, "shipment_id", job.kind));
    case "order.refund_mail":
      return sendRefundMail(requireString(payload, "refund_id", job.kind));
    case "invoice.create":
      await ensureInvoice(requireString(payload, "order_id", job.kind), null);
      return;
    default:
      throw new Error(`Unbekannter Job: ${job.kind}`);
  }
}
