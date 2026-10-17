import { describe, expect, it } from "vitest";
import {
  buildOrdersCsv,
  CSV_BOM,
  escapeCsvCell,
  formatCentsDe,
  formatDateTimeDe,
  toCsv,
  type OrderCsvRow,
} from "./csv";
import { refundEmail, shippingEmail } from "./emails";
import { classifySearch, parseOrderFilter, rangeEnd, sanitizeSearch, sortColumn } from "./filters";

describe("CSV-Export", () => {
  it("formatiert Cent mit Dezimalkomma", () => {
    expect(formatCentsDe(6190)).toBe("61,90");
    expect(formatCentsDe(5)).toBe("0,05");
    expect(formatCentsDe(-250)).toBe("-2,50");
    expect(formatCentsDe(123456)).toBe("1234,56");
  });

  it("formatiert Datum in Europe/Berlin", () => {
    expect(formatDateTimeDe("2026-10-17T12:31:00Z")).toBe("17.10.2026 14:31");
    expect(formatDateTimeDe("2026-01-05T23:30:00Z")).toBe("06.01.2026 00:30");
    expect(formatDateTimeDe(null)).toBe("");
  });

  it("maskiert Trenner, Anführungszeichen und Formeln", () => {
    expect(escapeCsvCell("Müller; GmbH")).toBe('"Müller; GmbH"');
    expect(escapeCsvCell('Sag "hi"')).toBe('"Sag ""hi"""');
    expect(escapeCsvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(escapeCsvCell("@SUM")).toBe("'@SUM");
    expect(escapeCsvCell({ cents: -250 })).toBe("-2,50");
    expect(escapeCsvCell(true)).toBe("ja");
    expect(escapeCsvCell(null)).toBe("");
  });

  it("schreibt UTF-8 mit BOM, Semikolon und CRLF", () => {
    const csv = toCsv(["A", "B"], [["ä", 1]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}A;B\r\nä;1\r\n`);
  });

  it("baut eine Bestellzeile", () => {
    const row: OrderCsvRow = {
      orderNumber: "PV-10001",
      placedAt: "2026-10-17T12:31:00Z",
      status: "In Bearbeitung",
      paymentBadge: "Bezahlt",
      fulfilmentBadge: "In Bearbeitung",
      customerName: "Paul Schöttler",
      email: "test-orders@provibe-drinks.de",
      itemCount: 2,
      subtotalCents: 5965,
      discountCents: 0,
      discountCode: null,
      depositCents: 225,
      shippingCents: 0,
      taxCents: 988,
      totalCents: 6190,
      refundedCents: 0,
      paymentMethod: "Karte",
      invoiceNumber: null,
      trackingNumbers: "",
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
      source: "web",
      isTest: true,
    };
    const lines = buildOrdersCsv([row]).slice(1).split("\r\n");
    expect(lines[0].split(";")[0]).toBe("Bestellnummer");
    expect(lines[1]).toBe(
      "PV-10001;17.10.2026 14:31;In Bearbeitung;Bezahlt;In Bearbeitung;Paul Schöttler;test-orders@provibe-drinks.de;2;59,65;0,00;;2,25;0,00;9,88;61,90;0,00;Karte;;;10115;Berlin;DE;web;ja",
    );
  });
});

describe("Filter der Bestellliste", () => {
  it("parst tolerant und verwirft Ungültiges", () => {
    const f = parseOrderFilter({
      status: "paid",
      page: "2",
      pageSize: "500",
      sort: "quatsch",
      test: "only",
      from: "2026-10-01",
    });
    expect(f.status).toBe("paid");
    expect(f.page).toBe(2);
    expect(f.pageSize).toBe(25);
    expect(f.sort).toBe("placed_desc");
    expect(f.test).toBe("only");
    expect(f.from).toBe("2026-10-01");
    const all = parseOrderFilter({ status: "all", paymentMethod: "invoice" });
    expect(all.status).toBeUndefined();
    expect(all).toMatchObject({ paymentMethod: "invoice", test: "include" });
    expect(parseOrderFilter({ status: ["shipped", "paid"] }).status).toBe("shipped");
  });

  it("entschärft Suchbegriffe für PostgREST", () => {
    expect(sanitizeSearch("a,b(c)*%\\:d")).toBe("a b c d");
    expect(sanitizeSearch("  Paul   Schöttler ")).toBe("Paul Schöttler");
    expect(sanitizeSearch(undefined)).toBe("");
  });

  it("erkennt Bestellnummern", () => {
    expect(classifySearch("PV-10001")).toEqual({ kind: "order_number", value: "10001" });
    expect(classifySearch("10001")).toEqual({ kind: "order_number", value: "10001" });
    expect(classifySearch("#1042")).toEqual({ kind: "order_number", value: "1042" });
    expect(classifySearch("mail@x.de")).toEqual({ kind: "text", value: "mail@x.de" });
    expect(classifySearch("")).toEqual({ kind: "none" });
  });

  it("rechnet Zeitraumgrenzen und Sortierung", () => {
    expect(rangeEnd("2026-10-17")).toBe("2026-10-17T23:59:59.999Z");
    expect(rangeEnd("2026-10-17T10:00:00Z")).toBe("2026-10-17T10:00:00Z");
    expect(sortColumn("total_asc")).toEqual({ column: "total_cents", ascending: true });
    expect(sortColumn("placed_desc")).toEqual({ column: "placed_at", ascending: false });
  });
});

describe("Mails aus dem Backoffice", () => {
  it("Versandmail mit Tracking-Link und escaped Kundendaten", () => {
    const mail = shippingEmail({
      orderNumber: "PV-10001",
      firstName: "<Paul>",
      carrierLabel: "DHL",
      trackingNumber: "00340434161094000000",
      trackingUrl:
        "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434161094000000",
      items: [{ title: "Wildberry", description: "9 Dosen", quantity: 1 }],
      addressLines: ["Paul Schöttler", "Musterstraße 12", "10115 Berlin"],
      isTest: true,
      entity: null,
    });
    expect(mail.subject).toBe("Deine Bestellung PV-10001 ist unterwegs");
    expect(mail.html).toContain("piececode=00340434161094000000");
    expect(mail.html).toContain("&lt;Paul&gt;");
    expect(mail.html).not.toContain("<Paul>");
    expect(mail.html).toContain("TESTBESTELLUNG");
    expect(mail.text).toContain("Sendung verfolgen: https://www.dhl.de");
  });

  it("Erstattungsmail ohne internen Grund", () => {
    const mail = refundEmail({
      orderNumber: "PV-10001",
      firstName: "Paul",
      amountCents: 2610,
      lines: [{ title: "Wildberry Eistee", quantity: 1, amountCents: 2610 }],
      shippingCents: 0,
      isFull: false,
      paymentLabel: "Karte, Visa endet auf 4242",
      isTest: false,
      entity: null,
    });
    expect(mail.subject).toBe("Erstattung zu deiner Bestellung PV-10001");
    expect(mail.html).toContain("26,10");
    expect(mail.html).toContain("Visa endet auf 4242");
    expect(mail.html).not.toContain("TESTBESTELLUNG");
    const manual = refundEmail({
      orderNumber: "PV-10002",
      firstName: null,
      amountCents: 100,
      lines: [],
      shippingCents: 100,
      isFull: true,
      paymentLabel: "Rechnung",
      manualTransfer: true,
      isTest: false,
      entity: null,
    });
    expect(manual.text).toContain("Wir überweisen dir den Betrag.");
    expect(manual.text).toContain("Versandkosten");
  });
});
