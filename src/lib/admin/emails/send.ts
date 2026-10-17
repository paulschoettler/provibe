import "server-only";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import type { Database } from "@/lib/supabase/database.types";
import { asJson, crmDb } from "@/lib/admin/customers/crm-db";
import { isAllowlistActive } from "./context";
import {
  canSendTo,
  normalizeEmail,
  suppressionBlocks,
  type MailCategory,
  type SuppressionReason,
} from "./policy";

/**
 * Einziger Versandweg der CRM-Mails (Newsletter, Automationen, Aktivierung aus dem Backoffice):
 * Sperrliste prüfen, Allowlist prüfen, senden, im Versandprotokoll (email_messages) vermerken.
 * Blockierte Mails werden ebenfalls protokolliert (Status suppressed bzw. blocked_allowlist).
 */

export type EmailStatus = Database["public"]["Enums"]["email_status"];

export interface TrackedEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category: MailCategory;
  template: string;
  /** Pflicht bei marketing: Abmeldeseite (Link im Fuß) */
  unsubscribeUrl?: string;
  /** One-Click-Abmeldung für den Header List-Unsubscribe (RFC 8058) */
  listUnsubscribeUrl?: string;
  idempotencyKey?: string;
  customerId?: string | null;
  campaignId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export interface TrackedEmailResult {
  status: EmailStatus;
  messageId: string | null;
  providerMessageId: string | null;
}

async function suppressionReason(email: string): Promise<SuppressionReason | null> {
  const { data } = await crmDb()
    .from("email_suppressions")
    .select("reason")
    .eq("email", email)
    .maybeSingle();
  return (data?.reason as SuppressionReason | undefined) ?? null;
}

async function logMessage(
  input: TrackedEmailInput,
  fields: {
    status: EmailStatus;
    from: string;
    replyTo: string;
    provider: string;
    providerMessageId?: string | null;
    error?: string | null;
  },
): Promise<string | null> {
  const { data, error } = await crmDb()
    .from("email_messages")
    .insert({
      to_email: normalizeEmail(input.to),
      from_email: fields.from,
      reply_to: fields.replyTo,
      subject: input.subject.slice(0, 500),
      template: input.template,
      category: input.category,
      provider: fields.provider,
      provider_message_id: fields.providerMessageId ?? null,
      status: fields.status,
      error: fields.error ?? null,
      customer_id: input.customerId ?? null,
      campaign_id: input.campaignId ?? null,
      order_id: input.orderId ?? null,
      metadata: asJson(input.metadata ?? {}),
      sent_at: fields.status === "sent" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[crm] email_messages nicht geschrieben", error.message);
    return null;
  }
  return data.id;
}

export async function sendTrackedEmail(input: TrackedEmailInput): Promise<TrackedEmailResult> {
  const env = serverEnv();
  const to = normalizeEmail(input.to);
  const from =
    input.category === "marketing" ? env.EMAIL_FROM_NEWSLETTER : env.EMAIL_FROM_TRANSACTIONAL;
  const replyTo = env.EMAIL_REPLY_TO;
  const email = integrations().email;
  const base = { from, replyTo, provider: email.name };

  if (input.category === "marketing" && !input.unsubscribeUrl) {
    throw new Error("Werbemails brauchen einen Abmeldelink");
  }

  const reason = await suppressionReason(to);
  if (reason && suppressionBlocks(reason, input.category)) {
    const messageId = await logMessage(input, {
      ...base,
      status: "suppressed",
      error: `Sperrliste: ${reason}`,
    });
    return { status: "suppressed", messageId, providerMessageId: null };
  }

  if (!canSendTo(to, env, await isAllowlistActive())) {
    const messageId = await logMessage(input, { ...base, status: "blocked_allowlist" });
    return { status: "blocked_allowlist", messageId, providerMessageId: null };
  }

  try {
    const result = await email.send({
      to,
      from,
      replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      category: input.category,
      template: input.template,
      unsubscribeUrl: input.listUnsubscribeUrl ?? input.unsubscribeUrl,
      idempotencyKey: input.idempotencyKey,
      tags: input.tags,
    });
    const status: EmailStatus = result.status === "sent" ? "sent" : result.status;
    const messageId = await logMessage(input, {
      ...base,
      status,
      providerMessageId: result.providerMessageId,
    });
    return { status, messageId, providerMessageId: result.providerMessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logMessage(input, { ...base, status: "failed", error: message.slice(0, 1000) });
    throw error;
  }
}
