import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

/** Mock-Mailversand: sammelt Mails im Speicher, damit Tests und Previews sie prüfen können. */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock" as const;
  readonly outbox: (SendEmailInput & { id: string; sentAt: Date })[] = [];
  readonly contacts = new Map<string, { firstName?: string; unsubscribed: boolean }>();

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = `mock_${this.outbox.length + 1}`;
    this.outbox.push({ ...input, id, sentAt: new Date() });
    return { status: "sent", providerMessageId: id };
  }

  async upsertContact(input: { email: string; firstName?: string; unsubscribed: boolean }) {
    this.contacts.set(input.email.toLowerCase(), {
      firstName: input.firstName,
      unsubscribed: input.unsubscribed,
    });
    return { id: `contact_mock_${input.email}` };
  }

  async removeContact(email: string) {
    this.contacts.delete(email.toLowerCase());
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | null>) {
    if (headers["svix-signature"] !== "mock") throw new Error("Ungültige Webhook-Signatur (mock)");
    return JSON.parse(rawBody) as { type: string; data: unknown };
  }
}
