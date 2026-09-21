import type {
  CreateInvoiceInput,
  InvoiceContact,
  InvoiceLine,
  InvoiceProvider,
  InvoiceRef,
} from "./types";

export class MockInvoiceProvider implements InvoiceProvider {
  readonly name = "mock" as const;
  readonly rateLimitPerSecond = 1000;
  private seq = 1000;
  readonly invoices = new Map<
    string,
    InvoiceRef & { input: CreateInvoiceInput | { originalInvoiceId: string; lines: InvoiceLine[] } }
  >();

  async ensureContact(input: InvoiceContact) {
    return { contactId: `contact_mock_${input.email.toLowerCase()}` };
  }

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceRef> {
    const id = `inv_mock_${++this.seq}`;
    const ref: InvoiceRef = {
      providerInvoiceId: id,
      invoiceNumber: input.mode === "final" ? `RE-${this.seq}` : null,
      status: input.mode === "final" ? "open" : "draft",
      deeplinkUrl: `https://app.lexware.de/mock/invoices/${id}`,
    };
    this.invoices.set(id, { ...ref, input });
    return ref;
  }

  async downloadInvoicePdf(providerInvoiceId: string): Promise<Buffer> {
    if (!this.invoices.has(providerInvoiceId))
      throw new Error(`Rechnung ${providerInvoiceId} unbekannt (mock)`);
    return Buffer.from(`%PDF-1.4\n% mock invoice ${providerInvoiceId}\n%%EOF\n`, "utf8");
  }

  async createCreditNote(input: {
    originalInvoiceId: string;
    contactId: string;
    lines: InvoiceLine[];
    mode: "draft" | "final";
  }): Promise<InvoiceRef> {
    const id = `cn_mock_${++this.seq}`;
    const ref: InvoiceRef = {
      providerInvoiceId: id,
      invoiceNumber: input.mode === "final" ? `GS-${this.seq}` : null,
      status: input.mode === "final" ? "open" : "draft",
      deeplinkUrl: `https://app.lexware.de/mock/credit-notes/${id}`,
    };
    this.invoices.set(id, {
      ...ref,
      input: { originalInvoiceId: input.originalInvoiceId, lines: input.lines },
    });
    return ref;
  }
}
