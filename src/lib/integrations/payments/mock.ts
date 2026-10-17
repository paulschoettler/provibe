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

/**
 * Verhalten gespeicherter Testkarten bei Abbuchungen ohne Kunde (wie im Stripe-Testmodus):
 *   …4242, …3155  Abbuchung erfolgreich (3155 braucht 3-D Secure nur beim Einrichten)
 *   …0341         Einrichten klappt, jede spätere Abbuchung wird abgelehnt (card_declined)
 *   …3184         jede Abbuchung verlangt eine Bestätigung (authentication_required)
 */
export const MOCK_OFF_SESSION_OUTCOME: Record<string, "declined" | "requires_action"> = {
  "0341": "declined",
  "0002": "declined",
  "9995": "declined",
  "3184": "requires_action",
};

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
  private setupIntents = new Map<string, SetupIntentRef>();

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

  async createSetupIntent(input: CreateSetupIntentInput): Promise<SetupIntentRef> {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    if (existing && this.setupIntents.has(existing)) return this.setupIntents.get(existing)!;
    const id = `seti_mock_${randomId()}`;
    const ref: SetupIntentRef = {
      id,
      clientSecret: `${id}_secret_${randomId()}`,
      status: "requires_payment_method",
      paymentMethodId: null,
      metadata: { ...input.metadata, provider_customer_id: input.providerCustomerId },
    };
    this.setupIntents.set(id, ref);
    this.byIdempotency.set(input.idempotencyKey, id);
    return ref;
  }

  async retrieveSetupIntent(id: string): Promise<SetupIntentRef> {
    const ref = this.setupIntents.get(id);
    if (!ref) throw new Error(`SetupIntent ${id} unbekannt (mock)`);
    return ref;
  }

  /**
   * Testhilfe (nur Mock): gespeichertes Zahlungsmittel aus einer Testkarte oder einer Wallet
   * erzeugen. Die ID trägt Art, Endziffern, Ablauf und Marke, damit retrievePaymentMethod und
   * chargeOffSession ohne Speicher auskommen (der Mock lebt nur im Prozess).
   */
  createTestPaymentMethod(input: {
    type?: "card" | "paypal";
    last4?: string | null;
    brand?: string | null;
    expMonth?: number | null;
    expYear?: number | null;
  }): SavedPaymentMethod {
    const type = input.type ?? "card";
    const last4 = (input.last4 ?? "").replace(/\D/g, "").slice(-4) || "4242";
    const expMonth = input.expMonth ?? 12;
    const expYear = input.expYear ?? new Date().getUTCFullYear() + 3;
    const brand = (input.brand ?? (type === "paypal" ? "PayPal" : "Visa")).slice(0, 30);
    const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const mmyy = `${String(expMonth).padStart(2, "0")}${String(expYear % 100).padStart(2, "0")}`;
    return {
      id: `pm_mock_${type}_${type === "paypal" ? "0000" : last4}_${mmyy}_${brandSlug}_${randomId()}`,
      type,
      brand,
      last4: type === "paypal" ? null : last4,
      expMonth: type === "paypal" ? null : expMonth,
      expYear: type === "paypal" ? null : expYear,
    };
  }

  /** Testhilfe (nur Mock): SetupIntent mit einem Testzahlungsmittel bestätigen. */
  completeTestSetup(setupIntentId: string, method: SavedPaymentMethod): SetupIntentRef {
    const ref = this.setupIntents.get(setupIntentId) ?? {
      id: setupIntentId,
      clientSecret: "",
      status: "requires_payment_method",
      paymentMethodId: null,
      metadata: {},
    };
    ref.status = "succeeded";
    ref.paymentMethodId = method.id;
    this.setupIntents.set(setupIntentId, ref);
    return ref;
  }

  async retrievePaymentMethod(id: string): Promise<SavedPaymentMethod> {
    const match = /^pm_mock_(card|paypal)_(\d{4})_(\d{2})(\d{2})_([a-z0-9-]+)_/.exec(id);
    if (!match) throw new Error(`Zahlungsmittel ${id} unbekannt (mock)`);
    const type = match[1];
    const brand = match[5].replace(/-/g, " ").replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase());
    return {
      id,
      type,
      brand: type === "paypal" ? "PayPal" : brand,
      last4: type === "paypal" ? null : match[2],
      expMonth: type === "paypal" ? null : Number(match[3]),
      expYear: type === "paypal" ? null : 2000 + Number(match[4]),
    };
  }

  async detachPaymentMethod(): Promise<void> {
    // Mock: nichts zu tun
  }

  async chargeOffSession(input: OffSessionPaymentInput): Promise<OffSessionPaymentResult> {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    const method = await this.retrievePaymentMethod(input.paymentMethodId);
    const outcome = method.last4 ? MOCK_OFF_SESSION_OUTCOME[method.last4] : undefined;
    const id = existing ?? `pi_mock_${randomId()}`;
    if (!existing) {
      this.intents.set(id, {
        id,
        clientSecret: `${id}_secret_${randomId()}`,
        amountCents: input.amountCents,
        status:
          outcome === "requires_action"
            ? "requires_action"
            : outcome
              ? "requires_payment_method"
              : "succeeded",
        metadata: input.metadata,
        paymentMethodType: method.type,
      });
      this.byIdempotency.set(input.idempotencyKey, id);
    }
    const ref = this.intents.get(id)!;
    if (outcome === "declined") {
      return {
        status: "declined",
        intentId: id,
        code: "card_declined",
        message: "Die Karte wurde abgelehnt.",
      };
    }
    if (outcome === "requires_action" && ref.status !== "succeeded") {
      return { status: "requires_action", intentId: id, clientSecret: ref.clientSecret };
    }
    ref.status = "succeeded";
    return {
      status: "succeeded",
      intentId: id,
      amountCents: ref.amountCents,
      paymentMethodType: method.type,
    };
  }

  /** Testhilfe: Ist der PaymentIntent im Speicher dieses Prozesses bekannt? */
  hasIntent(id: string): boolean {
    return this.intents.has(id);
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
