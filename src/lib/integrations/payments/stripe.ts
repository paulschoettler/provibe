import Stripe from "stripe";
import type {
  CreatePaymentIntentInput,
  CreateSetupIntentInput,
  OffSessionPaymentInput,
  OffSessionPaymentResult,
  PaymentIntentRef,
  PaymentProvider,
  RefundInput,
  RefundRef,
  SavedPaymentMethod,
  SetupIntentRef,
  VerifiedWebhookEvent,
} from "./types";

/** Zahlarten im Abo (H25): Karte (inklusive Apple Pay und Google Pay) und PayPal, kein Klarna. */
const SUBSCRIPTION_METHOD_TYPES = ["card", "paypal"];

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
        ...(input.paymentMethodTypes && input.paymentMethodTypes.length > 0
          ? { payment_method_types: input.paymentMethodTypes }
          : { automatic_payment_methods: { enabled: true } }),
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

  async createSetupIntent(input: CreateSetupIntentInput): Promise<SetupIntentRef> {
    const si = await this.stripe.setupIntents.create(
      {
        customer: input.providerCustomerId,
        usage: "off_session",
        payment_method_types: input.paymentMethodTypes ?? SUBSCRIPTION_METHOD_TYPES,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return toSetupRef(si);
  }

  async retrieveSetupIntent(id: string): Promise<SetupIntentRef> {
    return toSetupRef(await this.stripe.setupIntents.retrieve(id));
  }

  async retrievePaymentMethod(id: string): Promise<SavedPaymentMethod> {
    const pm = await this.stripe.paymentMethods.retrieve(id);
    const card = pm.card;
    return {
      id: pm.id,
      type: pm.type,
      brand: card
        ? cardBrandLabel(card.brand, card.wallet?.type ?? null)
        : pm.type === "paypal"
          ? "PayPal"
          : null,
      last4: card?.last4 ?? null,
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
    };
  }

  async detachPaymentMethod(id: string): Promise<void> {
    await this.stripe.paymentMethods.detach(id);
  }

  /**
   * Abbuchung im Abo-Lauf. Stripe wirft bei Ablehnung einen StripeCardError; bei
   * authentication_required liegt der PaymentIntent mit client_secret im Fehler, der Kunde
   * bestätigt dann im Portal (stripe.confirmCardPayment beziehungsweise handleNextAction).
   */
  async chargeOffSession(input: OffSessionPaymentInput): Promise<OffSessionPaymentResult> {
    try {
      const pi = await this.stripe.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency,
          customer: input.providerCustomerId,
          payment_method: input.paymentMethodId,
          off_session: true,
          confirm: true,
          description: input.description,
          metadata: input.metadata,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (pi.status === "succeeded" || pi.status === "processing") {
        return {
          status: "succeeded",
          intentId: pi.id,
          amountCents: pi.amount,
          paymentMethodType: pi.payment_method_types?.[0] ?? "card",
        };
      }
      if (pi.status === "requires_action") {
        return { status: "requires_action", intentId: pi.id, clientSecret: pi.client_secret ?? "" };
      }
      return {
        status: "declined",
        intentId: pi.id,
        code: pi.last_payment_error?.code ?? pi.status,
        message: pi.last_payment_error?.message ?? "Zahlung nicht abgeschlossen",
      };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        const raw = error.raw as { payment_intent?: Stripe.PaymentIntent } | undefined;
        const pi = raw?.payment_intent;
        if (error.code === "authentication_required" && pi) {
          return {
            status: "requires_action",
            intentId: pi.id,
            clientSecret: pi.client_secret ?? "",
          };
        }
        if (error.type === "StripeCardError") {
          return {
            status: "declined",
            intentId: pi?.id ?? null,
            code: error.decline_code ?? error.code ?? "card_declined",
            message: error.message,
          };
        }
      }
      throw error;
    }
  }
}

function cardBrandLabel(brand: string, wallet: string | null): string {
  const names: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    maestro: "Maestro",
    discover: "Discover",
    unionpay: "UnionPay",
    jcb: "JCB",
    diners: "Diners Club",
  };
  const label = names[brand] ?? "Karte";
  if (wallet === "apple_pay") return `Apple Pay (${label})`;
  if (wallet === "google_pay") return `Google Pay (${label})`;
  return label;
}

function toSetupRef(si: Stripe.SetupIntent): SetupIntentRef {
  return {
    id: si.id,
    clientSecret: si.client_secret ?? "",
    status: si.status,
    paymentMethodId:
      typeof si.payment_method === "string" ? si.payment_method : (si.payment_method?.id ?? null),
    metadata: si.metadata ?? {},
  };
}

function toRef(pi: Stripe.PaymentIntent): PaymentIntentRef {
  return {
    id: pi.id,
    clientSecret: pi.client_secret ?? "",
    amountCents: pi.amount,
    status: pi.status,
  };
}
