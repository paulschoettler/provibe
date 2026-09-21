import Stripe from "stripe";
import type {
  CreatePaymentIntentInput,
  PaymentIntentRef,
  PaymentProvider,
  RefundInput,
  RefundRef,
  VerifiedWebhookEvent,
} from "./types";

/** Stripe-Implementierung. Nur serverseitig instanziieren (Secret Key). */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  private stripe: Stripe;

  constructor(
    secretKey: string,
    private webhookSecret: string,
  ) {
    this.stripe = new Stripe(secretKey, { appInfo: { name: "provibe-shop" } });
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentRef> {
    const pi = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: input.email,
        customer: input.providerCustomerId ?? undefined,
        description: input.description,
        metadata: { ...input.metadata, checkout_session_id: input.checkoutSessionId },
        setup_future_usage: input.saveForFutureUse ? "off_session" : undefined,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return toRef(pi);
  }

  async updatePaymentIntentAmount(
    id: string,
    amountCents: number,
    metadata?: Record<string, string>,
  ) {
    return toRef(await this.stripe.paymentIntents.update(id, { amount: amountCents, metadata }));
  }

  async retrievePaymentIntent(id: string) {
    const pi = await this.stripe.paymentIntents.retrieve(id, { expand: ["payment_method"] });
    const pm = pi.payment_method;
    return {
      ...toRef(pi),
      paymentMethodType: pm && typeof pm !== "string" ? pm.type : null,
      metadata: pi.metadata ?? {},
    };
  }

  async cancelPaymentIntent(id: string) {
    await this.stripe.paymentIntents.cancel(id);
  }

  async createRefund(input: RefundInput): Promise<RefundRef> {
    const r = await this.stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        amount: input.amountCents,
        reason: input.reason,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return {
      id: r.id,
      status: (r.status as RefundRef["status"]) ?? "pending",
      amountCents: r.amount,
    };
  }

  async verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signatureHeader) throw new Error("Stripe-Signatur fehlt");
    const event = await this.stripe.webhooks.constructEventAsync(
      rawBody,
      signatureHeader,
      this.webhookSecret,
    );
    return {
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000),
      data: event.data,
    };
  }

  async ensureCustomer(input: { email: string; name?: string; metadata?: Record<string, string> }) {
    const existing = await this.stripe.customers.list({ email: input.email, limit: 1 });
    if (existing.data[0]) return { id: existing.data[0].id };
    const created = await this.stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: input.metadata,
    });
    return { id: created.id };
  }
}

function toRef(pi: Stripe.PaymentIntent): PaymentIntentRef {
  return {
    id: pi.id,
    clientSecret: pi.client_secret ?? "",
    amountCents: pi.amount,
    status: pi.status,
  };
}
