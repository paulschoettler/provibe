import "server-only";
import { readAddress } from "@/lib/checkout/session";
import { formatAddressLines } from "@/lib/checkout/snapshot";
import { paymentLabel } from "@/lib/checkout/order-view";
import { carrierLabel } from "@/lib/admin/fulfilment/tracking";
import { loadLegalEntity, ordersDb } from "./db";
import { refundEmail, shippingEmail } from "./emails";
import { mailAlreadySent, sendOrderMail } from "./mail";
import { MANUAL_PAYMENT_PROVIDER } from "./status";

/**
 * Handler der Mail-Jobs order.shipping_mail und order.refund_mail. Idempotent für Retries:
 * Versandmail über shipments.customer_notified_at, Erstattungsmail über email_messages.metadata.
 */

export interface MailSendOptions {
  /** Erneut senden (Backoffice "Mail erneut senden"): ignoriert die Idempotenz-Sperre */
  force?: boolean;
}

export async function sendShippingMail(
  shipmentId: string,
  options: MailSendOptions = {},
): Promise<void> {
  const db = ordersDb();
  const { data: shipment } = await db
    .from("shipments")
    .select("id, order_id, carrier, tracking_number, tracking_url, customer_notified_at")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!shipment) throw new Error(`Sendung ${shipmentId} nicht gefunden`);
  if (shipment.customer_notified_at && !options.force) return;
  if (!shipment.tracking_number) throw new Error(`Sendung ${shipmentId} ohne Trackingnummer`);

  const [{ data: order }, { data: items }, entity] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, email, customer_id, shipping_address, is_test")
      .eq("id", shipment.order_id)
      .maybeSingle(),
    db
      .from("order_items")
      .select("product_title, variant_title, quantity")
      .eq("order_id", shipment.order_id)
      .order("position"),
    loadLegalEntity(),
  ]);
  if (!order) throw new Error(`Bestellung ${shipment.order_id} nicht gefunden`);
  const address = readAddress(order.shipping_address);

  const mail = shippingEmail({
    orderNumber: order.order_number,
    firstName: address?.first_name ?? null,
    carrierLabel: carrierLabel(shipment.carrier),
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
    items: (items ?? []).map((i) => ({
      title: i.product_title,
      description: i.variant_title,
      quantity: i.quantity,
    })),
    addressLines: address ? formatAddressLines(address) : [],
    isTest: order.is_test,
    entity,
  });
  const result = await sendOrderMail(
    {
      to: order.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      category: "transactional",
      template: "shipping_confirmation",
      idempotencyKey: `shipping_confirmation:${shipment.id}${options.force ? `:erneut:${Date.now()}` : ""}`,
    },
    {
      orderId: order.id,
      customerId: order.customer_id,
      eventMessage: options.force
        ? "Versandbestätigung erneut gesendet"
        : "Versandbestätigung an Kunden gesendet",
      metadata: { shipment_id: shipment.id },
    },
  );
  if (result.status === "sent" || result.status === "blocked_allowlist") {
    await db
      .from("shipments")
      .update({ customer_notified_at: new Date().toISOString() })
      .eq("id", shipment.id);
  }
}

export async function sendRefundMail(
  refundId: string,
  options: MailSendOptions = {},
): Promise<void> {
  const db = ordersDb();
  const { data: refund } = await db
    .from("refunds")
    .select("id, order_id, amount_cents, items, status")
    .eq("id", refundId)
    .maybeSingle();
  if (!refund) throw new Error(`Erstattung ${refundId} nicht gefunden`);
  if (refund.status === "failed" || refund.status === "cancelled") return;
  if (
    !options.force &&
    (await mailAlreadySent(refund.order_id, "refund_confirmation", { refund_id: refund.id }))
  )
    return;

  const [{ data: order }, { data: items }, { data: paid }, entity] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, email, customer_id, shipping_address, billing_address, is_test, payment_status, payment_provider, payment_method_type",
      )
      .eq("id", refund.order_id)
      .maybeSingle(),
    db.from("order_items").select("id, product_title").eq("order_id", refund.order_id),
    db
      .from("order_events")
      .select("data")
      .eq("order_id", refund.order_id)
      .eq("kind", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadLegalEntity(),
  ]);
  if (!order) throw new Error(`Bestellung ${refund.order_id} nicht gefunden`);
  const titleById = new Map((items ?? []).map((i) => [i.id, i.product_title]));
  const stored = (Array.isArray(refund.items) ? refund.items : []) as {
    type?: string;
    order_item_id?: string;
    quantity?: number;
    amount_cents?: number;
  }[];
  const address = readAddress(order.billing_address) ?? readAddress(order.shipping_address);
  const details = (paid?.data ?? {}) as { method?: string; brand?: string; last4?: string };

  const mail = refundEmail({
    orderNumber: order.order_number,
    firstName: address?.first_name ?? null,
    amountCents: refund.amount_cents,
    lines: stored
      .filter((s) => s.type === "item" && s.order_item_id)
      .map((s) => ({
        title: titleById.get(s.order_item_id!) ?? "Artikel",
        quantity: s.quantity ?? 0,
        amountCents: s.amount_cents ?? 0,
      })),
    shippingCents: stored
      .filter((s) => s.type === "shipping")
      .reduce((sum, s) => sum + (s.amount_cents ?? 0), 0),
    isFull: order.payment_status === "refunded",
    paymentLabel: paymentLabel({
      method: details.method ?? order.payment_method_type,
      brand: details.brand,
      last4: details.last4,
    }),
    manualTransfer: order.payment_provider === MANUAL_PAYMENT_PROVIDER,
    isTest: order.is_test,
    entity,
  });
  await sendOrderMail(
    {
      to: order.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      category: "transactional",
      template: "refund_confirmation",
      idempotencyKey: `refund_confirmation:${refund.id}${options.force ? `:erneut:${Date.now()}` : ""}`,
    },
    {
      orderId: order.id,
      customerId: order.customer_id,
      eventMessage: options.force
        ? "Erstattungsbestätigung erneut gesendet"
        : "Erstattungsbestätigung an Kunden gesendet",
      metadata: { refund_id: refund.id },
    },
  );
}
