import { describe, expect, it } from "vitest";
import {
  ERASED_NAME,
  ERASURE_RULES,
  checkoutSessionPatch,
  contactMessagePatch,
  emailsMatch,
  erasureBlockers,
  isPseudonymEmail,
  leadPatch,
  newsletterContactPatch,
  orderPatch,
  pseudonymEmail,
  scrubsEmailMessage,
} from "./erasure";

const ID = "6a1f0c2e-1111-4222-8333-944445555666";

const base = {
  customerEmail: "Lena.Hoffmann@beispiel.de",
  confirmEmail: "lena.hoffmann@beispiel.de ",
  anonymizedAt: null,
  orders: [] as { order_number: string; status: string; is_test: boolean }[],
  subscriptions: [] as { status: string }[],
};

describe("pseudonymEmail", () => {
  it("erzeugt eine eindeutige, nicht zustellbare Adresse wie anonymize_customer", () => {
    expect(pseudonymEmail(ID)).toBe(`geloescht+${ID}@invalid.provibe-drinks.de`);
    expect(isPseudonymEmail(pseudonymEmail(ID))).toBe(true);
    expect(isPseudonymEmail("lena@beispiel.de")).toBe(false);
  });
});

describe("erasureBlockers", () => {
  it("erlaubt die Löschung bei bestätigter Adresse ohne offene Vorgänge", () => {
    expect(erasureBlockers(base)).toEqual([]);
  });

  it("vergleicht die Bestätigung ohne Groß- und Kleinschreibung, leer zählt nie", () => {
    expect(emailsMatch("A@B.de", " a@b.de ")).toBe(true);
    expect(emailsMatch("", "")).toBe(false);
    expect(erasureBlockers({ ...base, confirmEmail: "andere@beispiel.de" })).toEqual([
      "Die eingegebene E-Mail-Adresse stimmt nicht mit dem Kunden überein.",
    ]);
  });

  it("verhindert die Löschung bei laufendem Abo und offenen Bestellungen", () => {
    const blockers = erasureBlockers({
      ...base,
      subscriptions: [{ status: "paused" }],
      orders: [
        { order_number: "PV-10001", status: "paid", is_test: false },
        { order_number: "PV-10002", status: "delivered", is_test: false },
        { order_number: "PV-10003", status: "processing", is_test: true },
      ],
    });
    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain("laufendes Abo");
    expect(blockers[1]).toContain("PV-10001");
    expect(blockers[1]).not.toContain("PV-10002");
    expect(blockers[1]).not.toContain("PV-10003");
  });

  it("lässt gekündigte Abos und abgeschlossene Bestellungen zu", () => {
    expect(
      erasureBlockers({
        ...base,
        subscriptions: [{ status: "cancelled" }],
        orders: [
          { order_number: "PV-1", status: "cancelled", is_test: false },
          { order_number: "PV-2", status: "refunded", is_test: false },
          { order_number: "PV-3", status: "shipped", is_test: false },
        ],
      }),
    ).toEqual([]);
  });

  it("meldet bereits gelöschte Kunden", () => {
    expect(erasureBlockers({ ...base, anonymizedAt: "2026-10-01T10:00:00Z" })[0]).toContain(
      "bereits gelöscht",
    );
  });
});

describe("Anonymisierungsregeln", () => {
  it("behält Bestellungen, entfernt aber Telefon und Kundennotiz", () => {
    expect(orderPatch()).toEqual({ phone: null, customer_note: null });
    const orders = ERASURE_RULES.find((r) => r.table === "orders");
    expect(orders?.action).toBe("behalten");
    expect(orders?.detail).toContain("§ 147 AO");
  });

  it("meldet Newsletter-Kontakte ab und entfernt den Opt-in-Nachweis mit Personenbezug", () => {
    const patch = newsletterContactPatch(ID, "2026-10-17T10:00:00.000Z");
    expect(patch.status).toBe("unsubscribed");
    expect(patch.email).toBe(pseudonymEmail(ID));
    expect(patch.first_name).toBeNull();
    expect(patch.confirm_ip).toBeNull();
    expect(patch.confirm_user_agent).toBeNull();
    expect(patch.resend_contact_id).toBeNull();
    expect(patch.unsubscribed_at).toBe("2026-10-17T10:00:00.000Z");
  });

  it("pseudonymisiert Kontakt- und Partneranfragen vollständig", () => {
    const m = contactMessagePatch(ID);
    expect(m.name).toBe(ERASED_NAME);
    expect(m.email).toBe(pseudonymEmail(ID));
    expect(m.phone).toBeNull();
    expect(m.message).not.toContain("@");
    const l = leadPatch(ID);
    expect(l.contact_name).toBe(ERASED_NAME);
    expect(l.email).toBe(pseudonymEmail(ID));
    expect(l.phone).toBeNull();
    expect(l.message).toBeNull();
    expect(l.attribution).toEqual({});
  });

  it("leert abgebrochene Checkouts", () => {
    expect(checkoutSessionPatch()).toEqual({
      email: null,
      phone: null,
      shipping_address: null,
      billing_address: null,
    });
  });

  it("ersetzt im Versandprotokoll nur Werbe- und Konto-Mails", () => {
    expect(scrubsEmailMessage("marketing")).toBe(true);
    expect(scrubsEmailMessage("auth")).toBe(true);
    expect(scrubsEmailMessage("transactional")).toBe(false);
    expect(scrubsEmailMessage("internal")).toBe(false);
  });

  it("deckt jede Tabelle mit Kundenbezug genau einmal ab", () => {
    const tables = ERASURE_RULES.map((r) => r.table);
    expect(new Set(tables).size).toBe(tables.length);
    for (const t of [
      "customers",
      "customer_addresses",
      "customer_notes",
      "customer_events",
      "customer_payment_methods",
      "newsletter_contacts",
      "campaign_recipients",
      "automation_runs",
      "email_messages",
      "carts",
      "checkout_sessions",
      "orders",
      "discount_redemptions",
      "reviews",
      "consent_logs",
      "contact_messages",
      "leads",
      "withdrawal_requests",
      "subscriptions",
      "b2b_applications",
    ])
      expect(tables).toContain(t);
  });
});
