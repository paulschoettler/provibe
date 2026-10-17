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
  /**
   * Erlaubte Zahlarten (Stripe payment_method_types). Ohne Angabe gelten die automatischen
   * Zahlarten des Kontos. Abo: ["card", "paypal"] (Karte inklusive Apple Pay und Google Pay, H25).
   */
  paymentMethodTypes?: string[];
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

/* ---------- Gespeicherte Zahlungsmittel (Abo) ---------- */

/** Gespeichertes Zahlungsmittel, wie es in customer_payment_methods landet. */
export interface SavedPaymentMethod {
  /** Stripe pm_... (Mock: pm_mock_...) */
  id: string;
  /** card, paypal, sepa_debit */
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface CreateSetupIntentInput {
  /** Stripe-Kunde (cus_...), an den das Zahlungsmittel gebunden wird */
  providerCustomerId: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
  /** Standard ["card", "paypal"] */
  paymentMethodTypes?: string[];
}

export interface SetupIntentRef {
  id: string;
  clientSecret: string;
  /** requires_payment_method, requires_action, succeeded, canceled, ... */
  status: string;
  paymentMethodId: string | null;
  metadata: Record<string, string>;
}

export interface OffSessionPaymentInput {
  amountCents: Cents;
  currency: "eur";
  providerCustomerId: string;
  paymentMethodId: string;
  description: string;
  /** muss checkout_session_id enthalten (Bestellanlage über den gemeinsamen Webhook-Weg) */
  metadata: Record<string, string>;
  /** je Abo, Termin und Versuch eindeutig: verhindert doppelte Abbuchung */
  idempotencyKey: string;
}

/** Ergebnis einer Abbuchung ohne Anwesenheit des Kunden (Abo-Lauf). */
export type OffSessionPaymentResult =
  | { status: "succeeded"; intentId: string; amountCents: Cents; paymentMethodType: string }
  | {
      /** Bank verlangt eine Bestätigung (3-D Secure): Kunde bestätigt im Portal */
      status: "requires_action";
      intentId: string;
      clientSecret: string;
    }
  | {
      status: "declined";
      intentId: string | null;
      /** Stripe-Fehlercode, z.B. card_declined, insufficient_funds, expired_card */
      code: string;
      message: string;
    };

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
  /** SetupIntent (usage off_session) zum Speichern eines Zahlungsmittels ohne Zahlung */
  createSetupIntent(input: CreateSetupIntentInput): Promise<SetupIntentRef>;
  retrieveSetupIntent(id: string): Promise<SetupIntentRef>;
  /** Details eines gespeicherten Zahlungsmittels (Marke, Endziffern, Ablauf) */
  retrievePaymentMethod(id: string): Promise<SavedPaymentMethod>;
  /** Zahlungsmittel vom Stripe-Kunden lösen (nach einem Wechsel) */
  detachPaymentMethod(id: string): Promise<void>;
  /** PaymentIntent mit gespeichertem Zahlungsmittel, off_session, sofort bestätigt */
  chargeOffSession(input: OffSessionPaymentInput): Promise<OffSessionPaymentResult>;
}
