import type { Cents } from "@/lib/money";

/**
 * Rechnungsstellung. Führendes System: Lexware Office. Die Rechnungsnummer kommt aus Lexware,
 * der Shop vergibt keine eigenen Nummern. Lexware versendet keine E-Mails, das übernimmt Resend.
 */
export interface InvoiceContact {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  vatId?: string;
  address: { street: string; zip: string; city: string; countryCode: string; supplement?: string };
}

export interface InvoiceLine {
  name: string;
  description?: string;
  quantity: number;
  /** Bruttopreis je Einheit in Cent */
  unitGrossCents: Cents;
  taxRateBp: number;
  /** service | material | custom (Pfand, Versand, Rabatt als eigene Positionen) */
  type: "material" | "service" | "custom";
}

export interface CreateInvoiceInput {
  orderId: string;
  orderNumber: string;
  contactId: string;
  lines: InvoiceLine[];
  /** Rabatt als negative eigene Position */
  introduction?: string;
  remark?: string;
  /** draft = Entwurf (bis zur Freigabe), final = sofort finalisiert */
  mode: "draft" | "final";
  shippingDate?: Date;
  paymentTermsLabel?: string;
}

export interface InvoiceRef {
  providerInvoiceId: string;
  invoiceNumber: string | null; // bei Entwürfen noch null
  status: "draft" | "open" | "paid" | "voided";
  deeplinkUrl: string;
}

export interface InvoiceProvider {
  readonly name: "lexware" | "mock";
  ensureContact(input: InvoiceContact): Promise<{ contactId: string }>;
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceRef>;
  downloadInvoicePdf(providerInvoiceId: string): Promise<Buffer>;
  createCreditNote(input: {
    originalInvoiceId: string;
    contactId: string;
    lines: InvoiceLine[];
    mode: "draft" | "final";
    remark?: string;
  }): Promise<InvoiceRef>;
  /** Lexware erlaubt 2 Requests je Sekunde; der Aufrufer drosselt über die Job-Queue */
  readonly rateLimitPerSecond: number;
}
