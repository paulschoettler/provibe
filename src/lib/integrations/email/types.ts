export type EmailCategory = "transactional" | "marketing" | "auth" | "internal";

export interface SendEmailInput {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  category: EmailCategory;
  /** Vorlagen-Schlüssel für das Protokoll (z.B. order_confirmation) */
  template: string;
  headers?: Record<string, string>;
  /** Pflicht bei marketing: List-Unsubscribe-URL */
  unsubscribeUrl?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  /** blocked_allowlist: Empfänger nicht auf der Go-live-Allowlist, Mail wurde nur protokolliert */
  status: "sent" | "blocked_allowlist" | "suppressed";
  providerMessageId: string | null;
}

export interface EmailProvider {
  readonly name: "resend" | "mock";
  send(input: SendEmailInput): Promise<SendEmailResult>;
  /** Kontakt in der Marketing-Audience anlegen/aktualisieren (nur mit bestätigtem Opt-in aufrufen) */
  upsertContact(input: {
    email: string;
    firstName?: string;
    unsubscribed: boolean;
  }): Promise<{ id: string | null }>;
  removeContact(email: string): Promise<void>;
  /** Webhook-Signatur prüfen (Resend nutzt Svix) */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | null>,
  ): Promise<{ type: string; data: unknown }>;
}
