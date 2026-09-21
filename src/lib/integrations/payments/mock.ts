import type {
  CreatePaymentIntentInput,
  PaymentIntentRef,
  PaymentProvider,
  RefundInput,
  RefundRef,
  VerifiedWebhookEvent,
} from "./types";

/**
 * Mock-Zahlungsanbieter: deterministisch, ohne Netz. Speichert Intents im Prozess.
 * Webhooks werden über eine simple Signatur "mock:<json>" simuliert.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  private intents = new Map<
    string,
    PaymentIntentRef & { metadata: Record<string, string>; paymentMethodType?: string }
  >();
  private refunds = new Map<string, RefundRef>();
  private byIdempotency = new Map<string, string>();

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentRef> {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing) return this.intents.get(existing)!;
    const id = `pi_mock_${randomId()}`;
    const ref = {
      id,
      clientSecret: `${id}_secret_${randomId()}`,
      amountCents: input.amountCents,
      status: "requires_payment_method",
      metadata: input.metadata,
    };
    this.intents.set(id, ref);
    this.byIdempotency.set(input.idempotencyKey, id);
    return ref;
  }

  async updatePaymentIntentAmount(
    id: string,
    amountCents: number,
    metadata?: Record<string, string>,
  ) {
    const ref = this.mustGet(id);
    ref.amountCents = amountCents;
    if (metadata) ref.metadata = { ...ref.metadata, ...metadata };
    return ref;
  }

  async retrievePaymentIntent(id: string) {
    const ref = this.mustGet(id);
    return { ...ref, paymentMethodType: ref.paymentMethodType ?? "card" };
  }

  async cancelPaymentIntent(id: string) {
    this.mustGet(id).status = "canceled";
  }

  async createRefund(input: RefundInput): Promise<RefundRef> {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing && this.refunds.has(existing)) return this.refunds.get(existing)!;
    const id = `re_mock_${randomId()}`;
    const ref: RefundRef = { id, status: "succeeded", amountCents: input.amountCents };
    this.refunds.set(id, ref);
    this.byIdempotency.set(input.idempotencyKey, id);
    return ref;
  }

  async verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (signatureHeader !== "mock") throw new Error("Ungültige Webhook-Signatur (mock)");
    const parsed = JSON.parse(rawBody) as { id: string; type: string; data: unknown };
    return { id: parsed.id, type: parsed.type, created: new Date(), data: parsed.data };
  }

  async ensureCustomer(input: { email: string }) {
    return { id: `cus_mock_${input.email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}` };
  }

  /** Testhilfe: Zahlung als erfolgreich markieren und Webhook-Body erzeugen. */
  simulateSuccess(id: string, paymentMethodType = "card"): { body: string; signature: string } {
    const ref = this.mustGet(id);
    ref.status = "succeeded";
    ref.paymentMethodType = paymentMethodType;
    const event = {
      id: `evt_mock_${randomId()}`,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id,
          amount: ref.amountCents,
          currency: "eur",
          status: "succeeded",
          metadata: ref.metadata,
        },
      },
    };
    return { body: JSON.stringify(event), signature: "mock" };
  }

  private mustGet(id: string) {
    const ref = this.intents.get(id);
    if (!ref) throw new Error(`PaymentIntent ${id} unbekannt (mock)`);
    return ref;
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
