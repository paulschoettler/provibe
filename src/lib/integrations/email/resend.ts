import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";

/** Resend-Implementierung. Die Allowlist-Prüfung passiert davor im Mail-Service, nicht hier. */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private client: Resend;

  constructor(
    apiKey: string,
    private defaults: {
      from: string;
      replyTo: string;
      audienceId?: string;
      webhookSecret?: string;
    },
  ) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const headers: Record<string, string> = { ...(input.headers ?? {}) };
    if (input.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${input.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const { data, error } = await this.client.emails.send(
      {
        from: input.from ?? this.defaults.from,
        to: input.to,
        replyTo: input.replyTo ?? this.defaults.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        tags: input.tags
          ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
          : undefined,
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    return { status: "sent", providerMessageId: data?.id ?? null };
  }

  async upsertContact(input: { email: string; firstName?: string; unsubscribed: boolean }) {
    if (!this.defaults.audienceId) return { id: null };
    const { data, error } = await this.client.contacts.create({
      audienceId: this.defaults.audienceId,
      email: input.email,
      firstName: input.firstName,
      unsubscribed: input.unsubscribed,
    });
    if (error) throw new Error(`Resend contacts: ${error.message}`);
    return { id: data?.id ?? null };
  }

  async removeContact(email: string) {
    if (!this.defaults.audienceId) return;
    await this.client.contacts.remove({ audienceId: this.defaults.audienceId, email });
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string | null>) {
    if (!this.defaults.webhookSecret) throw new Error("RESEND_WEBHOOK_SECRET fehlt");
    const { Webhook } = await import("svix");
    const wh = new Webhook(this.defaults.webhookSecret);
    const payload = wh.verify(rawBody, {
      "svix-id": headers["svix-id"] ?? "",
      "svix-timestamp": headers["svix-timestamp"] ?? "",
      "svix-signature": headers["svix-signature"] ?? "",
    }) as unknown as { type: string; data: unknown };
    return payload;
  }
}
