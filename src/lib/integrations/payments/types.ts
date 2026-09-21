import type { Cents } from "@/lib/money";

/**
 * Zahlungsanbieter-Schnittstelle. Produktion: Stripe (Payment Element). Tests und Previews: Mock.
 * Beträge in Cent, Währung EUR. Der Server legt den PaymentIntent an, der Client bekommt nur das client_secret.
 */
export interface CreatePaymentIntentInput {
  amountCents: Cents;
  currency: "eur";
  checkoutSessionId: string;
  email?: string;
  customerId?: string | null;
  /** Stripe-Kunden-ID, falls bekannt (für gespeicherte Zahlungsmittel, Abo-Vorbereitung) */
  providerCustomerId?: string | null;
  description: string;
  metadata: Record<string, string>;
  /** Idempotenz je Checkout-Session und Betrag */
  idempotencyKey: string;
  /** Zahlungsmittel für später speichern (SetupFutureUsage), nur mit Einwilligung */
  saveForFutureUse?: boolean;
}

export interface PaymentIntentRef {
  id: string;
  clientSecret: string;
  amountCents: Cents;
  status: string;
}

export interface RefundInput {
  paymentIntentId: string;
  amountCents: Cents;
  reason?: "requested_by_customer" | "duplicate" | "fraudulent";
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface RefundRef {
  id: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  amountCents: Cents;
}

export interface VerifiedWebhookEvent {
  id: string;
  type: string;
  created: Date;
  data: unknown;
}

export interface PaymentProvider {
  readonly name: "stripe" | "mock";
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentRef>;
  updatePaymentIntentAmount(
    id: string,
    amountCents: Cents,
    metadata?: Record<string, string>,
  ): Promise<PaymentIntentRef>;
  retrievePaymentIntent(
    id: string,
  ): Promise<
    PaymentIntentRef & { paymentMethodType?: string | null; metadata: Record<string, string> }
  >;
  cancelPaymentIntent(id: string): Promise<void>;
  createRefund(input: RefundInput): Promise<RefundRef>;
  /** Signatur prüfen und Event parsen. Wirft bei ungültiger Signatur. */
  verifyWebhook(rawBody: string, signatureHeader: string | null): Promise<VerifiedWebhookEvent>;
  ensureCustomer(input: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }>;
}
