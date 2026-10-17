import { describe, expect, it } from "vitest";
import {
  accountStatus,
  buildTimeline,
  customerKpis,
  displayName,
  initials,
  normalizeTags,
  optInProof,
  type NewsletterContactRow,
} from "./profile";

const contact = (over: Partial<NewsletterContactRow> = {}): NewsletterContactRow => ({
  id: "n1",
  email: "a@b.de",
  status: "subscribed",
  source: "checkout",
  opt_in_sent_at: "2026-10-17T12:33:00Z",
  confirmed_at: "2026-10-17T12:35:00Z",
  confirm_ip: "203.0.113.24",
  confirm_user_agent: "Mozilla",
  consent_text: "Mit dem Absenden …",
  consent_version: "2026-09",
  imported_consent_at: null,
  unsubscribed_at: null,
  unsubscribe_reason: null,
  created_at: "2026-10-17T12:33:00Z",
  ...over,
});

describe("customerKpis", () => {
  it("rechnet Ø Bestellwert, Stornos und Nummern der ersten und letzten Bestellung", () => {
    const k = customerKpis(
      {
        orders_count: 2,
        total_spent_cents: 12381,
        first_order_at: "2026-09-01T10:00:00Z",
        last_order_at: "2026-10-17T10:00:00Z",
      },
      [
        {
          orderNumber: "PV-10003",
          placedAt: "2026-10-17T10:00:00Z",
          status: "paid",
          paymentStatus: "paid",
          totalCents: 6190,
          isTest: false,
        },
        {
          orderNumber: "PV-10002",
          placedAt: "2026-09-20T10:00:00Z",
          status: "cancelled",
          paymentStatus: "refunded",
          totalCents: 100,
          isTest: false,
        },
        {
          orderNumber: "PV-10001",
          placedAt: "2026-09-01T10:00:00Z",
          status: "delivered",
          paymentStatus: "paid",
          totalCents: 6191,
          isTest: false,
        },
        {
          orderNumber: "PV-10009",
          placedAt: "2026-08-01T10:00:00Z",
          status: "paid",
          paymentStatus: "paid",
          totalCents: 1,
          isTest: true,
        },
      ],
    );
    expect(k.averageOrderCents).toBe(6191);
    expect(k.cancelledCount).toBe(1);
    expect(k.firstOrder).toEqual({ at: "2026-09-01T10:00:00Z", orderNumber: "PV-10001" });
    expect(k.lastOrder).toEqual({ at: "2026-10-17T10:00:00Z", orderNumber: "PV-10003" });
  });

  it("liefert 0 ohne Bestellungen", () => {
    const k = customerKpis(
      { orders_count: 0, total_spent_cents: 0, first_order_at: null, last_order_at: null },
      [],
    );
    expect(k.averageOrderCents).toBe(0);
    expect(k.firstOrder).toBeNull();
  });
});

describe("optInProof", () => {
  it("zeigt Double Opt-in mit IP und Version", () => {
    const p = optInProof(contact());
    expect(p.kind).toBe("double_opt_in");
    expect(p.sendable).toBe(true);
    expect(p.ip).toBe("203.0.113.24");
    expect(p.sourceLabel).toBe("Checkout");
    expect(p.note).toContain("Version 2026-09");
  });

  it("kennzeichnet den Shopify-Import mit Zeitstempel", () => {
    const p = optInProof(
      contact({
        source: "import_shopify",
        opt_in_sent_at: null,
        confirm_ip: null,
        consent_text: null,
        consent_version: null,
        imported_consent_at: "2025-05-01T08:00:00Z",
        confirmed_at: "2025-05-01T08:00:00Z",
      }),
    );
    expect(p.kind).toBe("shopify_import");
    expect(p.sendable).toBe(true);
    expect(p.note).toContain("nur mit Zeitstempel");
  });

  it("ist ohne Bestätigung nicht versandfähig", () => {
    const p = optInProof(contact({ status: "pending", confirmed_at: null, confirm_ip: null }));
    expect(p.kind).toBe("pending");
    expect(p.sendable).toBe(false);
    expect(optInProof(null).kind).toBe("none");
  });
});

describe("Hilfen", () => {
  it("bestimmt den Kontostatus", () => {
    expect(accountStatus({ anonymized_at: null, blocked_at: null, auth_user_id: "u" })).toBe(
      "active",
    );
    expect(accountStatus({ anonymized_at: null, blocked_at: null, auth_user_id: null })).toBe(
      "not_activated",
    );
    expect(accountStatus({ anonymized_at: null, blocked_at: "x", auth_user_id: "u" })).toBe(
      "blocked",
    );
    expect(accountStatus({ anonymized_at: "x", blocked_at: "x", auth_user_id: null })).toBe(
      "anonymized",
    );
  });

  it("bereinigt Tags", () => {
    expect(
      normalizeTags(["  Pre-Sale ", "pre-sale", "Founder  Bundle", "", "x".repeat(60)]),
    ).toEqual(["Pre-Sale", "Founder Bundle", "x".repeat(40)]);
  });

  it("baut Namen und Initialen", () => {
    expect(displayName({ first_name: "Paul", last_name: "Schöttler", email: "p@x.de" })).toBe(
      "Paul Schöttler",
    );
    expect(displayName({ first_name: null, last_name: null, email: "p@x.de" })).toBe("p@x.de");
    expect(initials("Paul Schöttler")).toBe("PS");
    expect(initials("mail@paulschoettler.de")).toBe("M");
  });
});

describe("buildTimeline", () => {
  it("führt alle Quellen absteigend zusammen und vermeidet doppelte Bestellmails", () => {
    const t = buildTimeline({
      customerEvents: [
        {
          id: 1,
          kind: "tags_changed",
          data: { tags: ["VIP"] },
          created_at: "2026-10-17T15:10:00Z",
        },
      ],
      orders: [
        {
          id: "o1",
          order_number: "PV-10001",
          placed_at: "2026-10-17T14:32:00Z",
          total_cents: 6190,
        },
      ],
      orderEvents: [
        {
          id: 5,
          order_id: "o1",
          order_number: "PV-10001",
          kind: "created",
          message: null,
          created_at: "2026-10-17T14:32:00Z",
        },
        {
          id: 6,
          order_id: "o1",
          order_number: "PV-10001",
          kind: "email_sent",
          message: "Bestellbestätigung (sent)",
          created_at: "2026-10-17T14:33:10Z",
        },
      ],
      emails: [
        {
          id: "m1",
          subject: "Bestellbestätigung",
          template: "order_confirmation",
          status: "sent",
          to_email: "a@b.de",
          created_at: "2026-10-17T14:33:05Z",
          order_id: "o1",
        },
        {
          id: "m2",
          subject: "Willkommen",
          template: "newsletter_welcome",
          status: "sent",
          to_email: "a@b.de",
          created_at: "2026-10-17T14:40:00Z",
          order_id: null,
        },
      ],
      newsletter: contact(),
      notes: [
        {
          id: "x",
          body: "Hat nach der Lieferzeit gefragt.",
          author: "Paul",
          created_at: "2026-10-17T15:02:00Z",
        },
      ],
    });
    expect(t[0].title).toBe("Tags geändert");
    expect(t[0].detail).toBe("VIP");
    expect(t.find((e) => e.id === "em:m1")).toBeUndefined();
    expect(t.find((e) => e.id === "em:m2")?.title).toBe("E-Mail: Willkommen");
    expect(t.find((e) => e.kind === "newsletter_confirmed")?.detail).toContain("IP 203.0.113.24");
    expect(t.at(-1)?.kind).toBe("newsletter_requested");
    expect(t.find((e) => e.kind === "order_placed")?.orderId).toBe("o1");
    expect(t.some((e) => e.kind === "created")).toBe(false);
    for (let i = 1; i < t.length; i++) expect(t[i - 1].at >= t[i].at).toBe(true);
  });
});
