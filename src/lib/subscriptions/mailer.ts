import "server-only";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import type { LegalEntity, RenderedEmail } from "@/lib/checkout/emails";
import { integrations } from "@/lib/integrations";
import type { EmailCategory } from "@/lib/integrations/email/types";
import { aboDb } from "./db";
import type { AboMailBase, AboMailSubscription } from "./emails";
import { aboTitle, type DeliveryQuote } from "./catalog";
import type { PaymentMethodRow, SubscriptionRow } from "./types";

/**
 * Versand der Abo-Mails über den E-Mail-Anbieter (Mock bis zum Go-live, Allowlist im
 * Resend-Anbieter), Protokoll in email_messages. Ein Fehler beim Versand bricht nie die
 * auslösende Aktion ab: Zustand und Ereignis sind dann schon gespeichert.
 */

export function siteUrl(): string {
  return (serverEnv().NEXT_PUBLIC_SITE_URL || publicEnv.siteUrl).replace(/\/$/, "");
}

export function isTestMode(): boolean {
  const env = serverEnv();
  return (
    integrations().payments.name === "mock" ||
    !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "") ||
    env.APP_STAGE !== "production"
  );
}

let entityCache: { value: LegalEntity | null; at: number } | null = null;

export async function legalEntity(): Promise<LegalEntity | null> {
  if (entityCache && Date.now() - entityCache.at < 60_000) return entityCache.value;
  const { data } = await aboDb()
    .from("shop_settings")
    .select("value")
    .eq("key", "shop.legal_entity")
    .maybeSingle();
  const value =
    ((data as { value?: LegalEntity } | null)?.value as LegalEntity | undefined) ?? null;
  entityCache = { value, at: Date.now() };
  return value;
}

export async function mailBase(firstName: string | null): Promise<AboMailBase> {
  return { siteUrl: siteUrl(), entity: await legalEntity(), isTest: isTestMode(), firstName };
}

export async function sendAboMail(input: {
  to: string;
  mail: RenderedEmail;
  template: string;
  idempotencyKey: string;
  category?: EmailCategory;
  replyTo?: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<"sent" | "blocked_allowlist" | "suppressed" | "failed"> {
  const env = serverEnv();
  try {
    const email = integrations().email;
    const result = await email.send({
      from: env.EMAIL_FROM_TRANSACTIONAL,
      replyTo: input.replyTo ?? env.EMAIL_REPLY_TO,
      to: input.to,
      subject: input.mail.subject,
      html: input.mail.html,
      text: input.mail.text,
      category: input.category ?? "transactional",
      template: input.template,
      idempotencyKey: input.idempotencyKey,
    });
    const { error: logError } = await aboDb()
      .from("email_messages")
      .insert({
        to_email: input.to,
        from_email: env.EMAIL_FROM_TRANSACTIONAL,
        reply_to: input.replyTo ?? env.EMAIL_REPLY_TO,
        subject: input.mail.subject,
        template: input.template,
        category: input.category ?? "transactional",
        provider: email.name,
        provider_message_id: result.providerMessageId,
        status: result.status,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
        customer_id: input.customerId ?? null,
        metadata: input.subscriptionId ? { subscription_id: input.subscriptionId } : {},
      });
    if (logError)
      console.error(`[abo] Mailprotokoll ${input.template} nicht gespeichert`, logError.message);
    return result.status;
  } catch (error) {
    console.error(`[abo] Mail ${input.template} fehlgeschlagen`, error);
    return "failed";
  }
}

/** Mail-Daten eines Abos aus Zeile und Preisberechnung. */
export function mailSubscription(row: SubscriptionRow, quote: DeliveryQuote): AboMailSubscription {
  const line = quote.snapshot.lines[0];
  return {
    number: row.number,
    productTitle: aboTitle(quote.line.productHandle, quote.line.productTitle),
    variantTitle: quote.line.variantTitle,
    quantity: row.quantity,
    intervalWeeks: row.interval_count,
    totalCents: quote.snapshot.totalCents,
    depositCents: quote.snapshot.depositCents,
    shippingCents: quote.snapshot.shippingCents,
    basePriceText: line?.basePriceText ?? null,
    imageUrl: quote.line.imageUrl,
  };
}

/** "Visa ···· 4242", "PayPal" */
export function paymentMethodLabel(
  pm: Pick<PaymentMethodRow, "type" | "brand" | "last4"> | null,
): string {
  if (!pm) return "deinem gespeicherten Zahlungsmittel";
  if (pm.type === "paypal") return "PayPal";
  return `${pm.brand ?? "Karte"}${pm.last4 ? ` ···· ${pm.last4}` : ""}`;
}

export interface CustomerContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  authUserId: string | null;
}

export async function loadCustomerContact(customerId: string): Promise<CustomerContact | null> {
  const { data } = await aboDb()
    .from("customers")
    .select("id, email, first_name, last_name, auth_user_id")
    .eq("id", customerId)
    .maybeSingle();
  const c = data as {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    auth_user_id: string | null;
  } | null;
  return c
    ? {
        id: c.id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        authUserId: c.auth_user_id,
      }
    : null;
}

export async function loadPaymentMethod(id: string | null): Promise<PaymentMethodRow | null> {
  if (!id) return null;
  const { data } = await aboDb()
    .from("customer_payment_methods")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PaymentMethodRow | null) ?? null;
}
