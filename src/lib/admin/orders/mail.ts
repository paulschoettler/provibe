import "server-only";
import { isEmailAllowlisted, serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import type { SendEmailInput, SendEmailResult } from "@/lib/integrations/email/types";
import { addOrderEvent, ordersDb } from "./db";

/**
 * Transaktionale Mail zu einer Bestellung senden und protokollieren (email_messages, order_events).
 * Bis zum Go-live gilt die Allowlist (CLAUDE.md): Mit echtem Anbieter gehen Mails an Adressen
 * außerhalb von EMAIL_ALLOWLIST nicht raus, sondern werden als blocked_allowlist protokolliert.
 * Adressen auf der Sperrliste wegen Bounce oder Beschwerde werden nicht angeschrieben.
 */
export async function sendOrderMail(
  input: Omit<SendEmailInput, "from" | "replyTo">,
  ctx: {
    orderId: string;
    customerId?: string | null;
    eventMessage?: string;
    metadata?: Record<string, string>;
  },
): Promise<SendEmailResult> {
  const env = serverEnv();
  const email = integrations().email;
  const db = ordersDb();

  let result: SendEmailResult;
  const { data: suppression } = await db
    .from("email_suppressions")
    .select("reason")
    .eq("email", input.to.toLowerCase())
    .in("reason", ["bounce", "complaint"])
    .maybeSingle();
  if (suppression) {
    result = { status: "suppressed", providerMessageId: null };
  } else if (email.name !== "mock" && !isEmailAllowlisted(input.to, env)) {
    result = { status: "blocked_allowlist", providerMessageId: null };
  } else {
    result = await email.send({
      ...input,
      from: env.EMAIL_FROM_TRANSACTIONAL,
      replyTo: env.EMAIL_REPLY_TO,
    });
  }

  const { error } = await db.from("email_messages").insert({
    to_email: input.to,
    from_email: env.EMAIL_FROM_TRANSACTIONAL,
    reply_to: env.EMAIL_REPLY_TO,
    subject: input.subject,
    template: input.template,
    category: input.category,
    provider: email.name,
    provider_message_id: result.providerMessageId,
    status: result.status,
    order_id: ctx.orderId,
    customer_id: ctx.customerId ?? null,
    metadata: ctx.metadata ?? {},
    sent_at: result.status === "sent" ? new Date().toISOString() : null,
  });
  if (error) console.error("[admin/orders] email_messages:", error.message);

  await addOrderEvent(ctx.orderId, {
    kind: "email_sent",
    message: `${ctx.eventMessage ?? input.subject} (${result.status})`,
    data: { template: input.template, to: input.to, status: result.status },
    visibleToCustomer: input.category === "transactional" && result.status === "sent",
  });
  return result;
}

/** Wurde diese Mail (Vorlage plus Bezug, zum Beispiel refund_id) schon erfolgreich verschickt? */
export async function mailAlreadySent(
  orderId: string,
  template: string,
  metadata: Record<string, string>,
): Promise<boolean> {
  const { data } = await ordersDb()
    .from("email_messages")
    .select("id")
    .eq("order_id", orderId)
    .eq("template", template)
    .contains("metadata", metadata)
    .in("status", ["sent", "delivered"])
    .limit(1);
  return (data ?? []).length > 0;
}
