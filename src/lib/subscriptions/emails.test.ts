import { describe, expect, it } from "vitest";
import {
  cancellationReceiptEmail,
  nextDeliveryEmail,
  paymentFailedEmail,
  subscriptionCancelledEmail,
  type AboMailBase,
  type AboMailSubscription,
} from "./emails";

const base: AboMailBase = {
  siteUrl: "https://www.provibe-drinks.de",
  entity: null,
  isTest: true,
  firstName: "Paul",
};
const sub: AboMailSubscription = {
  number: "ABO-1001",
  productTitle: "Wildberry",
  variantTitle: "9 Dosen",
  quantity: 1,
  intervalWeeks: 4,
  totalCents: 2861,
  depositCents: 225,
  shippingCents: 490,
  basePriceText: "7,23 € / l",
  imageUrl: "/images/cans/wildberry.webp",
};

describe("Abo-Mails", () => {
  it("Erinnerung mit Links zum Ändern, Überspringen und Pausieren", () => {
    const m = nextDeliveryEmail(base, sub, {
      deliveryDate: new Date("2026-11-14T04:00:00Z"),
      daysBefore: 3,
      addressLine: "Paul Muster, Musterstraße 12, 10115 Berlin",
      paymentLabel: "Visa ···· 4242",
      subscriptionId: "abc",
    });
    expect(m.subject).toBe("Deine nächste Lieferung kommt am 14.11.2026");
    expect(m.html).toContain("/account/abo/abc?aktion=ueberspringen");
    expect(m.html).toContain("/abo-kuendigen");
    expect(m.text).toMatch(/28,61\s€ je Lieferung/);
    expect(m.html).toContain("TEST");
  });
  it("Zahlung fehlgeschlagen nennt die Wiederholungen", () => {
    const m = paymentFailedEmail(base, sub, {
      paymentLabel: "Visa ···· 0341",
      dueSince: new Date("2026-10-15T05:41:00Z"),
      retryDates: [new Date("2026-10-18T05:41:00Z"), new Date("2026-10-22T05:41:00Z")],
      paused: false,
      subscriptionId: "abc",
    });
    expect(m.text).toContain("18.10.2026, danach 22.10.2026");
    expect(m.html).toContain("Zahlungsmittel aktualisieren");
  });
  it("escaped Kundendaten", () => {
    const m = cancellationReceiptEmail(
      base,
      {
        name: "<script>alert(1)</script>",
        email: "a@b.de",
        subscriptionNumber: null,
        kind: "ordinary",
        reason: null,
        timing: "next_possible",
        desiredDay: null,
        receivedAt: new Date("2026-10-17T12:32:00Z"),
        requestId: "8ec7fda9-0000-0000-0000-000000000000",
      },
      [],
    );
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.text).toContain("17.10.2026 um 14:32 Uhr");
    expect(m.text).toContain("Vorgangsnummer: 8EC7FDA9");
    expect(m.text).toContain("melden wir uns");
  });
  it("Kündigungsbestätigung: sofort ohne weitere Abbuchung", () => {
    const now = new Date("2026-10-17T12:32:00Z");
    const m = subscriptionCancelledEmail(base, sub, {
      receivedAt: now,
      effectiveAt: now,
      immediate: true,
      lastOrder: { number: "PV-10009", date: now },
    });
    expect(m.subject).toBe("Dein Abo ist gekündigt");
    expect(m.text).toContain("Wirksam: sofort");
    expect(m.text).toContain("Weitere Abbuchungen: keine");
  });
});
