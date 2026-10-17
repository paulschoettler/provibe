import "server-only";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import type { SendEmailInput } from "@/lib/integrations/email/types";
import type { InvoiceLine } from "@/lib/integrations/invoicing/types";
import { subscribeToNewsletter } from "@/lib/newsletter/actions";
import { buildPurchaseEvent, emitTrackingEvent } from "@/lib/tracking/events";
import { asJson, checkoutDb } from "./db";
import {
  internalNotificationEmail,
  orderConfirmationEmail,
  paymentConfirmationEmail,
  type LegalEntity,
} from "./emails";
import { legalVersionsByIds } from "./legal";
import { loadOrderView } from "./orders";
import type { OrderView } from "./order-view";

/**
 * Handler der Checkout-Jobs (siehe jobs.ts). Jeder Handler ist idempotent genug für Retries:
 * Mails laufen über eigene Idempotenzschlüssel der Queue, die Rechnung prüft lexware_invoice_id.
 */

async function requireOrder(orderId: string): Promise<OrderView> {
  const order = await loadOrderView(orderId);
  if (!order) throw new Error(`Bestellung ${orderId} nicht gefunden`);
  return order;
}

async function legalEntity(): Promise<LegalEntity | null> {
  const { data } = await checkoutDb()
    .from("shop_settings")
    .select("value")
    .eq("key", "shop.legal_entity")
    .maybeSingle();
  return (data?.value as LegalEntity | undefined) ?? null;
}

async function siteUrl(): Promise<string> {
  return (serverEnv().NEXT_PUBLIC_SITE_URL || publicEnv.siteUrl).replace(/\/$/, "");
}

/** Mail senden, im Protokoll (email_messages) und an der Bestellung (order_events) vermerken. */
async function sendLogged(
  input: SendEmailInput,
  ctx: { orderId: string; event: boolean },
): Promise<void> {
  const env = serverEnv();
  const email = integrations().email;
  const result = await email.send({
    from: env.EMAIL_FROM_TRANSACTIONAL,
    replyTo: env.EMAIL_REPLY_TO,
    ...input,
  });
  const db = checkoutDb();
  await db.from("email_messages").insert({
    to_email: input.to,
    from_email: input.from ?? env.EMAIL_FROM_TRANSACTIONAL,
    reply_to: input.replyTo ?? env.EMAIL_REPLY_TO,
    subject: input.subject,
    template: input.template,
    category: input.category,
    provider: email.name,
    provider_message_id: result.providerMessageId,
    status: result.status,
    order_id: ctx.orderId,
    sent_at: result.status === "sent" ? new Date().toISOString() : null,
  });
  if (ctx.event) {
    await db.from("order_events").insert({
      order_id: ctx.orderId,
      kind: "email_sent",
      message: `${input.subject} (${result.status})`,
      data: asJson({ template: input.template, to: input.to, status: result.status }),
      visible_to_customer: input.category === "transactional",
    });
  }
}

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await requireOrder(orderId);
  const versions = await legalVersionsByIds(order.legalVersionIds);
  const { data: docs } = await checkoutDb()
    .from("legal_document_versions")
    .select("id, legal_documents (kind)")
    .in(
      "id",
      versions.map((v) => v.id),
    );
  const kindById = new Map(
    (docs ?? []).map((d) => [d.id, (d.legal_documents as { kind: string } | null)?.kind]),
  );
  const legal: Parameters<typeof orderConfirmationEmail>[1] = {};
  for (const v of versions) {
    const kind = kindById.get(v.id);
    if (kind === "agb" || kind === "widerruf") legal[kind] = v;
  }
  const mail = orderConfirmationEmail(order, legal, await legalEntity(), await siteUrl());
  await sendLogged(
    {
      to: order.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      category: "transactional",
      template: "order_confirmation",
      idempotencyKey: `order_confirmation:${order.id}`,
    },
    { orderId, event: true },
  );
}

export async function sendPaymentConfirmation(orderId: string): Promise<void> {
  const order = await requireOrder(orderId);
  const mail = paymentConfirmationEmail(order, await legalEntity());
  await sendLogged(
    {
      to: order.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      category: "transactional",
      template: "payment_confirmation",
      idempotencyKey: `payment_confirmation:${order.id}`,
    },
    { orderId, event: true },
  );
}

export async function sendInternalNotification(orderId: string): Promise<void> {
  const order = await requireOrder(orderId);
  const mail = internalNotificationEmail(order, await siteUrl());
  await sendLogged(
    {
      to: serverEnv().EMAIL_REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      category: "internal",
      template: "order_internal_notification",
      idempotencyKey: `order_internal:${order.id}`,
    },
    { orderId, event: false },
  );
}

/**
 * Rechnung über den Rechnungsanbieter (Lexware Office, bis zum Key Mock). Bis zur Freigabe nur
 * als Entwurf (LEXWARE_INVOICE_MODE=draft): Die Rechnungsnummer vergibt Lexware erst beim
 * Finalisieren, der Shop vergibt keine eigenen Nummern (Briefing Abschnitt 5).
 */
export async function createInvoiceForOrder(orderId: string): Promise<void> {
  const db = checkoutDb();
  const { data: row } = await db
    .from("orders")
    .select("id, lexware_invoice_id, discount_code")
    .eq("id", orderId)
    .maybeSingle();
  if (!row) throw new Error(`Bestellung ${orderId} nicht gefunden`);
  if (row.lexware_invoice_id) return; // schon erzeugt (Retry)

  const order = await requireOrder(orderId);
  const { data: items } = await db
    .from("order_items")
    .select(
      "product_title, variant_title, quantity, unit_price_cents, unit_deposit_cents, discount_cents, tax_rate_bp",
    )
    .eq("order_id", orderId)
    .order("position");
  const invoicing = integrations().invoicing;
  const billing = order.billingAddress ?? order.shippingAddress;

  try {
    const { contactId } = await invoicing.ensureContact({
      email: order.email,
      firstName: billing.first_name,
      lastName: billing.last_name,
      company: billing.company ?? undefined,
      address: {
        street: [billing.street, billing.house_number].filter(Boolean).join(" "),
        zip: billing.postal_code,
        city: billing.city,
        countryCode: billing.country_code,
        supplement: billing.address_addition ?? undefined,
      },
    });

    const lines: InvoiceLine[] = [];
    const discountByRate = new Map<number, number>();
    const depositByRate = new Map<number, number>();
    for (const i of items ?? []) {
      lines.push({
        name: i.product_title,
        description: i.variant_title ?? undefined,
        quantity: i.quantity,
        unitGrossCents: i.unit_price_cents,
        taxRateBp: i.tax_rate_bp,
        type: "material",
      });
      if (i.discount_cents > 0) {
        discountByRate.set(
          i.tax_rate_bp,
          (discountByRate.get(i.tax_rate_bp) ?? 0) + i.discount_cents,
        );
      }
      if (i.unit_deposit_cents > 0) {
        depositByRate.set(
          i.tax_rate_bp,
          (depositByRate.get(i.tax_rate_bp) ?? 0) + i.unit_deposit_cents * i.quantity,
        );
      }
    }
    for (const [rate, cents] of depositByRate) {
      lines.push({
        name: order.depositLabel,
        quantity: 1,
        unitGrossCents: cents,
        taxRateBp: rate,
        type: "custom",
      });
    }
    for (const [rate, cents] of discountByRate) {
      lines.push({
        name: `Rabatt${row.discount_code ? ` (${row.discount_code})` : ""}`,
        quantity: 1,
        unitGrossCents: -cents,
        taxRateBp: rate,
        type: "custom",
      });
    }
    if (order.shippingCents > 0) {
      lines.push({
        name: `Versand (${order.shippingName})`,
        quantity: 1,
        unitGrossCents: order.shippingCents,
        taxRateBp: order.taxLines[0]?.rateBp ?? 1900,
        type: "service",
      });
    }

    const mode = serverEnv().LEXWARE_INVOICE_MODE;
    const ref = await invoicing.createInvoice({
      orderId,
      orderNumber: order.orderNumber,
      contactId,
      lines,
      mode,
      remark: `Bestellung ${order.orderNumber}${order.isTest ? " (TEST)" : ""}`,
      shippingDate: new Date(order.placedAt),
      paymentTermsLabel: "Bereits bezahlt",
    });

    let pdfPath: string | null = null;
    if (mode === "final") {
      const pdf = await invoicing.downloadInvoicePdf(ref.providerInvoiceId);
      pdfPath = `${new Date(order.placedAt).getUTCFullYear()}/${order.orderNumber}.pdf`;
      const upload = await db.storage
        .from("invoices")
        .upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
      if (upload.error && !upload.error.message.includes("exists")) throw upload.error;
      await sendLogged(
        {
          to: order.email,
          subject: `Deine Rechnung ${ref.invoiceNumber ?? ""} zu ${order.orderNumber}`.replace(
            "  ",
            " ",
          ),
          html: `<p>Hallo ${billing.first_name},</p><p>anbei deine Rechnung zur Bestellung ${order.orderNumber}.</p><p>Viele Grüße<br>provibe</p>`,
          text: `Hallo ${billing.first_name},\n\nanbei deine Rechnung zur Bestellung ${order.orderNumber}.\n\nViele Grüße\nprovibe`,
          category: "transactional",
          template: "invoice",
          attachments: [
            { filename: `${order.orderNumber}.pdf`, content: pdf, contentType: "application/pdf" },
          ],
          idempotencyKey: `invoice:${order.id}`,
        },
        { orderId, event: true },
      );
    }

    await db
      .from("orders")
      .update({
        lexware_contact_id: contactId,
        lexware_invoice_id: ref.providerInvoiceId,
        invoice_number: ref.invoiceNumber,
        invoice_pdf_path: pdfPath,
        invoice_status: mode === "final" ? (pdfPath ? "sent" : "finalized") : "draft",
        invoice_error: null,
      })
      .eq("id", orderId);
    await db.from("order_events").insert({
      order_id: orderId,
      kind: "invoice_created",
      message:
        mode === "final"
          ? `Rechnung ${ref.invoiceNumber ?? ""} erstellt (${invoicing.name})`
          : `Rechnungsentwurf erstellt (${invoicing.name})`,
      data: asJson({
        provider: invoicing.name,
        invoice_id: ref.providerInvoiceId,
        deeplink: ref.deeplinkUrl,
        mode,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("orders")
      .update({ invoice_status: "failed", invoice_error: message.slice(0, 1000) })
      .eq("id", orderId);
    throw error;
  }
}

/** Newsletter-Häkchen im Checkout: Double Opt-in wie im Footer (src/lib/newsletter/actions). */
export async function subscribeNewsletterFromCheckout(orderId: string): Promise<void> {
  const order = await requireOrder(orderId);
  if (!order.marketingOptIn) return;
  const form = new FormData();
  form.set("email", order.email);
  form.set("website", "");
  const result = await subscribeToNewsletter({ status: "idle", message: "" }, form);
  if (result.status === "error") throw new Error(result.message);
}

export async function trackPurchase(orderId: string): Promise<void> {
  const order = await requireOrder(orderId);
  await emitTrackingEvent(buildPurchaseEvent(order));
}

/** Abgelaufene Session aufräumen: Reservierung freigeben, Status expired, Intent abbrechen. */
export async function releaseExpiredSession(sessionId: string): Promise<void> {
  const db = checkoutDb();
  const { data: session } = await db
    .from("checkout_sessions")
    .select("id, status, expires_at, order_id, payment_intent_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.order_id) return;
  if (!["open", "failed"].includes(session.status)) return;
  if (new Date(session.expires_at).getTime() > Date.now()) return; // verlängert, späterer Job übernimmt

  await db.rpc("release_reservations", { p_checkout_session_id: sessionId });
  await db
    .from("checkout_sessions")
    .update({ status: "expired" })
    .eq("id", sessionId)
    .in("status", ["open", "failed"]);
  if (session.payment_intent_id) {
    try {
      await integrations().payments.cancelPaymentIntent(session.payment_intent_id);
    } catch {
      // bereits abgebrochen oder dem Mock unbekannt
    }
  }
}
