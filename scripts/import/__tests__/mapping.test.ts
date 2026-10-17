import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadTable } from "../lib/csv";
import { mapCustomerRow, mergeTags, sameAddress } from "../map/customers";
import { mapDiscountKind, mapDiscountRow } from "../map/discounts";
import {
  decideNewsletter,
  mergeSignals,
  readSignal,
  type NewsletterSignal,
} from "../map/newsletter";

const fixture = (name: string) => loadTable(path.join(import.meta.dirname, "..", "fixtures", name));
const NOW = new Date("2026-10-17T12:00:00Z");

describe("Kunden-Mapping", () => {
  const rows = fixture("customers.csv").table.rows;

  it("bildet den aktuellen Shopify-Export ab", () => {
    const r = mapCustomerRow(rows[0].data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      email: "erika.mustermann@example.com",
      shopifyCustomerId: "7001000000001",
      firstName: "Erika",
      lastName: "Mustermann",
      phone: "+491701234567",
      totalSpentCents: 5463,
      ordersCount: 1,
      tags: ["Presale", "VIP", "shopify_import"],
      note: 'Mag Peach am liebsten, bitte "kühl" lagern',
    });
    expect(r.value.address).toEqual({
      first_name: "Erika",
      last_name: "Mustermann",
      company: null,
      street: "Musterstraße",
      house_number: "12a",
      address_addition: "2. OG",
      postal_code: "12345",
      city: "Musterstadt",
      country_code: "DE",
      phone: "+491701234567",
    });
    expect(r.value.details.accepts_email_marketing).toBe(true);
  });

  it("schreibt E-Mails klein und übernimmt die Firma", () => {
    const r = mapCustomerRow(rows[1].data);
    expect(r.ok && r.value.email).toBe("max.beispiel@example.org");
    expect(r.ok && r.value.companyName).toBe("Beispiel GmbH");
  });

  it("überspringt Kunden ohne E-Mail und warnt bei unvollständiger Adresse", () => {
    const noEmail = mapCustomerRow(rows[3].data);
    expect(noEmail).toMatchObject({ ok: false, skip: true });
    const partial = mapCustomerRow(rows[4].data);
    expect(partial.ok && partial.value.address).toBeNull();
    expect(partial.ok && partial.value.warnings[0]).toMatch(/unvollständig/);
  });

  it("versteht das ältere Exportformat", () => {
    const r = mapCustomerRow({
      "First Name": "Ole",
      "Last Name": "Alt",
      Email: "ole@example.com",
      "Accepts Marketing": "no",
      Company: "",
      Address1: "Altweg 2",
      City: "Musterstadt",
      Zip: "12345",
      Country: "Germany",
      "Total Spent": "10.00",
      "Total Orders": "1",
    });
    expect(r.ok && r.value.address?.country_code).toBe("DE");
    expect(r.ok && r.value.shopifyCustomerId).toBeNull();
  });

  it("vergleicht Adressen tolerant und führt Tags zusammen", () => {
    const a = {
      street: "Musterstraße",
      house_number: "12a",
      postal_code: "12345",
      city: "Musterstadt",
      country_code: "DE",
    };
    expect(sameAddress(a, { ...a, street: "musterstr." })).toBe(true);
    expect(sameAddress(a, { ...a, house_number: "12" })).toBe(false);
    expect(mergeTags(["VIP"], ["vip", "shopify_import"])).toEqual(["VIP", "shopify_import"]);
  });
});

describe("Rabatt-Mapping", () => {
  const rows = fixture("discounts.csv").table.rows;
  const mapped = rows.map((r) => mapDiscountRow(r.data, NOW));

  it("Prozent in Basispunkten, Festbetrag in Cent, Vorzeichen egal", () => {
    expect(mapped[0]).toMatchObject({
      ok: true,
      value: { code: "PRESALE10", kind: "percentage", value: 1000, timesUsed: 12 },
    });
    expect(mapped[1]).toMatchObject({
      ok: true,
      value: {
        code: "WELCOME5",
        kind: "fixed_amount",
        value: 500,
        minSubtotalCents: 3000,
        usageLimit: 500,
        usageLimitPerCustomer: 1,
      },
    });
    expect(mapped[1].ok && mapped[1].value.endsAt).toBe("2026-12-31T22:59:59.000Z");
  });

  it("geplante Codes bleiben aktiv, abgelaufene inaktiv", () => {
    expect(mapped[2]).toMatchObject({
      ok: true,
      value: { kind: "free_shipping", value: 0, isActive: true, minSubtotalCents: 4000 },
    });
    expect(mapped[3]).toMatchObject({
      ok: true,
      value: { kind: "percentage", value: 1500, isActive: false },
    });
  });

  it("überspringt nicht abbildbare Typen und Mindestmengen", () => {
    expect(mapped[4]).toMatchObject({ ok: false, skip: true });
    const qty = mapDiscountRow(
      { Code: "X2", Type: "percentage", Value: "10", Minimum: "Minimum quantity of 2 items" },
      NOW,
    );
    expect(qty.ok).toBe(false);
  });

  it("setzt produktbezogene Rabatte inaktiv", () => {
    const r = mapDiscountRow(
      { Code: "SHIRT20", Type: "percentage", Value: "20", "Applies to": "Specific collections" },
      NOW,
    );
    expect(r.ok && r.value.isActive).toBe(false);
    expect(r.ok && r.value.warnings[0]).toMatch(/Backoffice/);
  });

  it("erkennt Typbezeichnungen", () => {
    expect(mapDiscountKind("Fixed amount", "5")).toBe("fixed_amount");
    expect(mapDiscountKind("", "10%")).toBe("percentage");
    expect(mapDiscountKind("Free shipping", "")).toBe("free_shipping");
    expect(mapDiscountKind("buy_x_get_y", "")).toBeNull();
  });
});

describe("Newsletter-Entscheidung (D3)", () => {
  it("abonniert nur mit Ja UND Zeitstempel", () => {
    expect(
      decideNewsletter({ subscribed: true, consentAt: "2026-03-15T09:12:00.000Z" }, NOW),
    ).toEqual({
      status: "subscribed",
      importedConsentAt: "2026-03-15T09:12:00.000Z",
    });
    expect(decideNewsletter({ subscribed: true, consentAt: null }, NOW)).toEqual({
      status: "unsubscribed",
      reason: "ohne_zeitstempel",
    });
    expect(
      decideNewsletter({ subscribed: false, consentAt: "2026-03-15T09:12:00.000Z" }, NOW),
    ).toEqual({
      status: "unsubscribed",
      reason: "keine_einwilligung",
    });
    expect(
      decideNewsletter({ subscribed: true, consentAt: "2027-01-01T00:00:00.000Z" }, NOW),
    ).toMatchObject({
      reason: "zeitstempel_in_zukunft",
    });
  });

  it("die Abonnentenliste hat Vorrang vor dem Kunden-Export", () => {
    const signals: NewsletterSignal[] = [];
    for (const [file, source] of [
      ["customers.csv", "customers"],
      ["newsletter-subscribers.csv", "subscribers"],
    ] as const) {
      for (const r of fixture(file).table.rows) {
        const s = readSignal(r.data, r.line, source);
        if (s.ok) signals.push(s.value);
      }
    }
    const decisions = Object.fromEntries(
      mergeSignals(signals).map((c) => {
        const d = decideNewsletter(c, NOW);
        return [c.email, d.status === "subscribed" ? "subscribed" : d.reason];
      }),
    );
    expect(decisions).toEqual({
      "erika.mustermann@example.com": "subscribed",
      "max.beispiel@example.org": "ohne_zeitstempel",
      "import-test@provibe-drinks.de": "keine_einwilligung",
      "clara.unvollstaendig@example.com": "keine_einwilligung",
      "nora.leser@example.net": "subscribed",
    });
  });

  it("Kunden-Export ohne Zeitstempelspalte macht niemanden versandfähig", () => {
    const s = readSignal(
      { Email: "a@example.com", "Accepts Email Marketing": "yes" },
      2,
      "customers",
    );
    expect(s.ok && decideNewsletter(mergeSignals([s.value])[0], NOW).status).toBe("unsubscribed");
  });

  it("liest den Zeitstempel aus dem Kunden-Export, falls vorhanden", () => {
    const s = readSignal(
      {
        Email: "a@example.com",
        "Accepts Email Marketing": "yes",
        "Accepts Email Marketing Updated At": "2026-01-02 10:00:00 +0100",
      },
      2,
      "customers",
    );
    expect(s.ok && decideNewsletter(mergeSignals([s.value])[0], NOW)).toEqual({
      status: "subscribed",
      importedConsentAt: "2026-01-02T09:00:00.000Z",
    });
    expect(readSignal({ Email: "a@example.com", Status: "irgendwas" }, 2, "subscribers").ok).toBe(
      false,
    );
  });
});
