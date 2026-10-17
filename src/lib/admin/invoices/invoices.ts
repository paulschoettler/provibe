import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { addOrderEvent, ordersDb } from "@/lib/admin/orders/db";
import { AdminOrderError } from "@/lib/admin/orders/errors";
import { readAddress } from "@/lib/checkout/session";
import { loadOrderView } from "@/lib/checkout/orders";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import { buildInvoiceLines, paymentTermsLabel } from "./lines";
import { placeholderPdf } from "./pdf";

/**
 * Rechnungen über den Rechnungsanbieter (Lexware Office, bis zum Key Mock). Entscheidung H21:
 * Lexware vergibt die Nummern, der Shop keinen eigenen Kreis. orders.invoice_number wird nur
 * geschrieben, wenn der Anbieter eine Nummer liefert (finalisierte Rechnung). Entwürfe bekommen
 * im Mock-Betrieb ein Platzhalter-PDF unter invoices/entwuerfe/, damit der Knopf "Rechnung PDF"
 * im Backoffice schon funktioniert; echte Lexware-Entwürfe haben kein PDF.
 */

export const INVOICE_BUCKET = "invoices";
const SIGNED_URL_SECONDS = 600;

export interface EnsureInvoiceResult {
  created: boolean;
  status: string;
  providerInvoiceId: string | null;
  invoiceNumber: string | null;
  pdfPath: string | null;
}

function pdfPathFor(orderNumber: string, placedAt: string, final: boolean): string {
  const year = new Date(placedAt).getUTCFullYear();
  return final ? `${year}/${orderNumber}.pdf` : `entwuerfe/${year}/${orderNumber}.pdf`;
}

/**
 * Rechnung sicherstellen: anlegen, falls noch keine existiert, und das PDF ablegen, falls der
 * Anbieter eins liefert. Idempotent (Job invoice.create, Knopf im Backoffice, Retries).
 * actor null = Aufruf aus einem Job.
 */
export async function ensureInvoice(
  orderId: string,
  actor: StaffSession | null = null,
): Promise<EnsureInvoiceResult> {
  const db = ordersDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_number, email, placed_at, is_test, payment_provider, payment_status, shipping_cents, shipping_rate_name, discount_code, tax_lines, shipping_address, billing_address, lexware_contact_id, lexware_invoice_id, invoice_number, invoice_pdf_path, invoice_status",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");

  const invoicing = integrations().invoicing;
  const mode = serverEnv().LEXWARE_INVOICE_MODE;
  let created = false;
  let providerInvoiceId = order.lexware_invoice_id;
  let invoiceNumber = order.invoice_number;
  let status: string = order.invoice_status;

  try {
    if (!providerInvoiceId) {
      const [{ data: items }, view] = await Promise.all([
        db
          .from("order_items")
          .select(
            "product_title, variant_title, quantity, unit_price_cents, unit_deposit_cents, discount_cents, tax_rate_bp",
          )
          .eq("order_id", orderId)
          .order("position"),
        loadOrderView(orderId),
      ]);
      const billing = readAddress(order.billing_address) ?? readAddress(order.shipping_address);
      if (!billing)
        throw new AdminOrderError("validation", "Die Bestellung hat keine gültige Adresse.");
      const taxLines = (order.tax_lines ?? []) as { rate_bp?: number }[];

      const { contactId } = await invoicing.ensureContact({
        email: order.email,
        firstName: billing.first_name,
        lastName: billing.last_name,
        company: billing.company ?? undefined,
        address: {
          street: [billing.street, billing.house_number].filter(Boolean).join(" "),
          zip: billing.postal_code,
          city: billing.city,
          countryCode: billing.country_code,
          supplement: billing.address_addition ?? undefined,
        },
      });
      const ref = await invoicing.createInvoice({
        orderId,
        orderNumber: order.order_number,
        contactId,
        lines: buildInvoiceLines(items ?? [], {
          shippingCents: order.shipping_cents,
          shippingName: order.shipping_rate_name,
          discountCode: order.discount_code,
          depositLabel: view?.depositLabel ?? "Pfand",
          shippingTaxRateBp: taxLines[0]?.rate_bp ?? 1900,
        }),
        mode,
        remark: `Bestellung ${order.order_number}${order.is_test ? " (TEST)" : ""}`,
        shippingDate: new Date(order.placed_at),
        paymentTermsLabel: paymentTermsLabel({
          paymentProvider: order.payment_provider,
          paymentStatus: order.payment_status,
        }),
      });

      status = mode === "final" ? "finalized" : "draft";
      // Nur schreiben, wenn noch niemand (Checkout-Job lexware.create_invoice) schneller war
      const { data: won } = await db
        .from("orders")
        .update({
          lexware_contact_id: contactId,
          lexware_invoice_id: ref.providerInvoiceId,
          ...(ref.invoiceNumber ? { invoice_number: ref.invoiceNumber } : {}),
          invoice_status: status as "draft" | "finalized",
          invoice_error: null,
        })
        .eq("id", orderId)
        .is("lexware_invoice_id", null)
        .select("id");
      if (!won || won.length === 0) {
        const { data: fresh } = await db
          .from("orders")
          .select("lexware_invoice_id, invoice_number, invoice_status, invoice_pdf_path")
          .eq("id", orderId)
          .single();
        console.warn(
          "[admin/invoices] Rechnung parallel angelegt, verwende vorhandene",
          order.order_number,
        );
        providerInvoiceId = fresh?.lexware_invoice_id ?? null;
        invoiceNumber = fresh?.invoice_number ?? null;
        status = fresh?.invoice_status ?? status;
        order.invoice_pdf_path = fresh?.invoice_pdf_path ?? null;
      } else {
        created = true;
        providerInvoiceId = ref.providerInvoiceId;
        invoiceNumber = ref.invoiceNumber;
        await addOrderEvent(orderId, {
          kind: "invoice_created",
          message: ref.invoiceNumber
            ? `Rechnung ${ref.invoiceNumber} erstellt (${invoicing.name})`
            : `Rechnungsentwurf erstellt (${invoicing.name})`,
          data: {
            provider: invoicing.name,
            invoice_id: ref.providerInvoiceId,
            deeplink: ref.deeplinkUrl,
            mode,
          },
          actor,
        });
      }
    }

    // PDF ablegen, falls noch keins da ist
    let pdfPath = order.invoice_pdf_path;
    if (!pdfPath && providerInvoiceId) {
      const final = Boolean(invoiceNumber);
      let pdf: Buffer | null = null;
      try {
        pdf = await invoicing.downloadInvoicePdf(providerInvoiceId);
      } catch (error) {
        if (invoicing.name !== "mock" && final) throw error;
        // Lexware-Entwürfe haben kein PDF; der Mock kennt Rechnungen nur im eigenen Prozess
      }
      if (!pdf && invoicing.name === "mock") {
        pdf = placeholderPdf({
          title: final ? `Rechnung ${invoiceNumber}` : "Rechnungsentwurf (Platzhalter)",
          lines: [
            `Bestellung ${order.order_number}${order.is_test ? " (TEST)" : ""}`,
            `Anbieter: ${invoicing.name}, Beleg ${providerInvoiceId}`,
            "Platzhalter aus dem Mock-Betrieb. Die echte Rechnung erzeugt Lexware Office,",
            "sobald der API-Key hinterlegt ist (Entscheidung H21).",
          ],
        });
      }
      if (pdf) {
        const path = pdfPathFor(order.order_number, order.placed_at, final);
        const upload = await db.storage
          .from(INVOICE_BUCKET)
          .upload(path, pdf, { contentType: "application/pdf", upsert: !final });
        if (upload.error && !/exists|duplicate/i.test(upload.error.message)) throw upload.error;
        await db.from("orders").update({ invoice_pdf_path: path }).eq("id", orderId);
        pdfPath = path;
      }
    }

    if (actor) {
      await writeAudit(actor, {
        action: "order.invoice_ensure",
        entityType: "order",
        entityId: orderId,
        after: {
          created,
          invoice_status: status,
          invoice_number: invoiceNumber,
          pdf: Boolean(pdfPath),
        },
      });
    }
    return { created, status, providerInvoiceId, invoiceNumber, pdfPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!providerInvoiceId) {
      await db
        .from("orders")
        .update({ invoice_status: "failed", invoice_error: message.slice(0, 1000) })
        .eq("id", orderId);
    }
    if (error instanceof AdminOrderError) throw error;
    throw new AdminOrderError("provider", `Rechnung konnte nicht erstellt werden: ${message}`);
  }
}

export interface InvoicePdfLink {
  url: string;
  expiresAt: string;
  isDraft: boolean;
  invoiceNumber: string | null;
}

/**
 * Signierte URL (10 Minuten) auf das Rechnungs-PDF. Mit ensure (Standard) wird die Rechnung
 * vorher sichergestellt. null, wenn es (noch) kein PDF gibt, zum Beispiel bei Lexware-Entwürfen.
 */
export async function getInvoicePdfUrl(
  orderId: string,
  options: { ensure?: boolean; actor?: StaffSession | null } = {},
): Promise<InvoicePdfLink | null> {
  const db = ordersDb();
  const { data: order } = await db
    .from("orders")
    .select("id, invoice_pdf_path, invoice_number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new AdminOrderError("not_found", "Bestellung nicht gefunden.");
  let path = order.invoice_pdf_path;
  let invoiceNumber = order.invoice_number;
  if (!path && options.ensure !== false) {
    const ensured = await ensureInvoice(orderId, options.actor ?? null);
    path = ensured.pdfPath;
    invoiceNumber = ensured.invoiceNumber;
  }
  if (!path) return null;
  const { data, error } = await db.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) {
    throw new AdminOrderError(
      "provider",
      `PDF-Link konnte nicht erzeugt werden: ${error?.message}`,
    );
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString(),
    isDraft: path.startsWith("entwuerfe/"),
    invoiceNumber,
  };
}
