import { describe, expect, it } from "vitest";
import {
  buildInvoiceLines,
  invoiceLinesTotal,
  paymentTermsLabel,
} from "@/lib/admin/invoices/lines";
import { placeholderPdf } from "@/lib/admin/invoices/pdf";
import { renderPackingSlipHtml, renderPackingSlipsHtml } from "./packing-slip-html";
import {
  carrierLabel,
  isValidTrackingNumber,
  normalizeTrackingNumber,
  trackingUrl,
} from "./tracking";

describe("Sendungsverfolgung", () => {
  it("baut den DHL-Link wie die Shipping-Integration", () => {
    expect(trackingUrl("dhl", "0034 0434 1610 9400 0000")).toBe(
      "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434161094000000",
    );
    expect(trackingUrl("dpd", "abc123456")).toBe(
      "https://tracking.dpd.de/status/de_DE/parcel/ABC123456",
    );
    expect(trackingUrl("other", "123456")).toBeNull();
  });

  it("prüft und normalisiert Trackingnummern", () => {
    expect(normalizeTrackingNumber(" jj 1234 5678 ")).toBe("JJ12345678");
    expect(isValidTrackingNumber("00340434161094000000")).toBe(true);
    expect(isValidTrackingNumber("123")).toBe(false);
    expect(isValidTrackingNumber("<script>")).toBe(false);
    expect(carrierLabel("dhl")).toBe("DHL");
    expect(carrierLabel("fedex")).toBe("FEDEX");
  });
});

describe("Lieferschein", () => {
  const html = renderPackingSlipHtml({
    orderNumber: "PV-10001",
    placedAt: "2026-10-17T12:31:00Z",
    shippingAddressLines: [
      "Paul <b>Schöttler</b>",
      "Musterstraße 12",
      "10115 Berlin",
      "Deutschland",
    ],
    billingAddressLines: null,
    email: "test-orders@provibe-drinks.de",
    shippingName: "DHL Paket",
    items: [
      {
        title: "Wildberry Eistee",
        variantTitle: "9 Dosen",
        sku: "PV-WB-9",
        quantity: 2,
        components: null,
      },
      {
        title: "Founder Bundle I",
        variantTitle: null,
        sku: "PV-FB1",
        quantity: 1,
        components: [
          { title: "Wildberry, Dose", sku: "PV-WB-1", quantity: 2 },
          { title: "Clear Cup", sku: null, quantity: 1 },
        ],
      },
    ],
    customerNote: "Bitte beim Nachbarn abgeben",
    isTest: true,
    entity: null,
  });

  it("enthält Kopf, Positionen und Bundle-Inhalt, aber keine Preise", () => {
    expect(html).toContain("<title>Lieferschein PV-10001</title>");
    expect(html).toContain("Bestelldatum 17.10.2026");
    expect(html).toContain("PV-WB-9");
    expect(html).toContain("2 × Wildberry, Dose");
    expect(html).toContain("3 Artikel");
    expect(html).toContain("@page { size: A4");
    expect(html).toContain("TESTBESTELLUNG");
    expect(html).toContain("Bitte beim Nachbarn abgeben");
    expect(html).not.toMatch(/€/);
  });

  it("escaped Kundendaten", () => {
    expect(html).toContain("Paul &lt;b&gt;Schöttler&lt;/b&gt;");
    expect(html).not.toContain("<b>Schöttler</b>");
  });
});

describe("Rechnung", () => {
  it("ergibt exakt den Bestellbetrag (Pfand, Rabatt, Versand als eigene Positionen)", () => {
    // 2 × 9er à 23,85 € + 2,25 € Pfand, 10 % Rabatt auf Ware (4,77 €), Versand 4,90 €
    const items = [
      {
        product_title: "Wildberry",
        variant_title: "9 Dosen",
        quantity: 2,
        unit_price_cents: 2385,
        unit_deposit_cents: 225,
        discount_cents: 477,
        tax_rate_bp: 1900,
      },
      {
        product_title: "Shirt",
        variant_title: "M",
        quantity: 1,
        unit_price_cents: 2990,
        unit_deposit_cents: 0,
        discount_cents: 0,
        tax_rate_bp: 1900,
      },
    ];
    const lines = buildInvoiceLines(items, {
      shippingCents: 490,
      shippingName: "DHL Paket",
      discountCode: "VIBE10",
      depositLabel: "Pfand (18 Dosen à 0,25 €)",
      shippingTaxRateBp: 1900,
    });
    const total = 2 * (2385 + 225) - 477 + 2990 + 490;
    expect(invoiceLinesTotal(lines)).toBe(total);
    expect(lines.map((l) => l.name)).toEqual([
      "Wildberry",
      "Shirt",
      "Pfand (18 Dosen à 0,25 €)",
      "Rabatt (VIBE10)",
      "Versand (DHL Paket)",
    ]);
    expect(lines.find((l) => l.type === "service")?.unitGrossCents).toBe(490);
  });

  it("wählt die Zahlungsbedingung nach Zahlart", () => {
    expect(paymentTermsLabel({ paymentProvider: "stripe", paymentStatus: "paid" })).toBe(
      "Bereits bezahlt",
    );
    expect(paymentTermsLabel({ paymentProvider: "manual", paymentStatus: "unpaid" })).toContain(
      "14 Tagen",
    );
    expect(paymentTermsLabel({ paymentProvider: "manual", paymentStatus: "paid" })).toBe(
      "Bereits bezahlt",
    );
  });

  it("erzeugt ein gültiges Platzhalter-PDF mit korrekten xref-Offsets", () => {
    const pdf = placeholderPdf({
      title: "Rechnungsentwurf",
      lines: ["Bestellung PV-10001 (TEST)", "Größe: Ä Ö Ü ß, 61,90 €"],
    });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(6);
    offsets.forEach((off, i) =>
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`),
    );
    expect(text).toContain("(Gr\xF6\xDFe: \xC4 \xD6 \xDC \xDF, 61,90 EUR) Tj");
    const len = Number(/\/Length (\d+)/.exec(text)![1]);
    const streamStart = text.indexOf("stream\n") + "stream\n".length;
    expect(text.slice(streamStart + len, streamStart + len + "\nendstream".length)).toBe(
      "\nendstream",
    );
  });

  it("escaped Klammern im PDF-Text", () => {
    const text = placeholderPdf({ title: "A (B) \\ C", lines: [] }).toString("latin1");
    expect(text).toContain("(A \\(B\\) \\\\ C) Tj");
  });
});

describe("Lieferscheine im Sammeldruck", () => {
  const slip = (orderNumber: string) => ({
    orderNumber,
    placedAt: "2026-10-17T12:31:00Z",
    shippingAddressLines: ["Test Kunde", "Musterstraße 1", "86150 Augsburg"],
    billingAddressLines: null,
    email: "test-orders@provibe-drinks.de",
    shippingName: "DHL Paket",
    items: [
      { title: "Peach", variantTitle: "9 Dosen", sku: "PV-PE-9", quantity: 1, components: null },
    ],
    customerNote: null,
    isTest: true,
    entity: null,
  });

  it("legt jede Bestellung auf eine eigene Seite in einem Dokument", () => {
    const html = renderPackingSlipsHtml([slip("PV-10001"), slip("PV-10002")]);
    expect(html.match(/<!doctype html>/g)).toHaveLength(1);
    expect(html.match(/<main class="sheet">/g)).toHaveLength(2);
    expect(html).toContain("<title>Lieferscheine (2)</title>");
    expect(html).toContain("break-before: page");
    expect(renderPackingSlipsHtml([slip("PV-10003")])).toContain(
      "<title>Lieferschein PV-10003</title>",
    );
  });
});
