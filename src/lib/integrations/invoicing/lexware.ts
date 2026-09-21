import type {
  CreateInvoiceInput,
  InvoiceContact,
  InvoiceLine,
  InvoiceProvider,
  InvoiceRef,
} from "./types";

/**
 * Lexware Office Public API (https://developers.lexware.io). Implementierung folgt in Phase 6
 * gegen die dann aktuelle API-Dokumentation. Hier nur Gerüst und Fehlermeldung, damit niemand
 * versehentlich ohne Key gegen Live läuft.
 */
export class LexwareInvoiceProvider implements InvoiceProvider {
  readonly name = "lexware" as const;
  readonly rateLimitPerSecond = 2;

  constructor(
    private apiKey: string,
    private baseUrl = "https://api.lexware.io/v1",
  ) {}

  async ensureContact(_input: InvoiceContact): Promise<{ contactId: string }> {
    throw new Error("LexwareInvoiceProvider: noch nicht implementiert (Phase 6)");
  }
  async createInvoice(_input: CreateInvoiceInput): Promise<InvoiceRef> {
    throw new Error("LexwareInvoiceProvider: noch nicht implementiert (Phase 6)");
  }
  async downloadInvoicePdf(_id: string): Promise<Buffer> {
    throw new Error("LexwareInvoiceProvider: noch nicht implementiert (Phase 6)");
  }
  async createCreditNote(_input: {
    originalInvoiceId: string;
    contactId: string;
    lines: InvoiceLine[];
    mode: "draft" | "final";
  }): Promise<InvoiceRef> {
    throw new Error("LexwareInvoiceProvider: noch nicht implementiert (Phase 6)");
  }

  protected headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }
  protected url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
