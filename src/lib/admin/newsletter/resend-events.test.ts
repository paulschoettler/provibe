import { describe, expect, it } from "vitest";
import {
  aggregateRecipientStats,
  mapResendEvent,
  nextMessageStatus,
  timestampFields,
  type RecipientStatRow,
} from "./resend-events";

describe("mapResendEvent", () => {
  it("liest Typ, Nachricht, Empfänger und Zeitpunkt", () => {
    expect(
      mapResendEvent({
        type: "email.delivered",
        created_at: "2026-10-17T10:00:00.000Z",
        data: { email_id: "re_1", to: ["Test-CRM@provibe-drinks.de"] },
      }),
    ).toEqual({
      kind: "delivered",
      messageId: "re_1",
      at: "2026-10-17T10:00:00.000Z",
      recipients: ["test-crm@provibe-drinks.de"],
      permanentBounce: false,
    });
  });
  it("unterscheidet harte und weiche Bounces", () => {
    expect(
      mapResendEvent({
        type: "email.bounced",
        data: { email_id: "x", to: "a@b.de", bounce: { type: "Permanent" } },
      })?.permanentBounce,
    ).toBe(true);
    expect(
      mapResendEvent({
        type: "email.bounced",
        data: { email_id: "x", to: "a@b.de", bounce: { type: "Transient" } },
      })?.permanentBounce,
    ).toBe(false);
  });
  it("ignoriert unbekannte Ereignisse und fehlende IDs", () => {
    expect(mapResendEvent({ type: "contact.created", data: {} })).toBeNull();
    expect(mapResendEvent({ type: "email.opened", data: {} })).toBeNull();
  });
});

describe("nextMessageStatus", () => {
  it("geht nie zurück und wertet Öffnen als Zustellung", () => {
    expect(nextMessageStatus("sent", "opened")).toBe("delivered");
    expect(nextMessageStatus("delivered", "sent")).toBe("delivered");
    expect(nextMessageStatus("bounced", "delivered")).toBe("bounced");
    expect(nextMessageStatus("delivered", "complained")).toBe("complained");
    expect(nextMessageStatus("sent", "delayed")).toBe("sent");
    expect(nextMessageStatus("sent", "bounced", false)).toBe("sent");
  });
  it("setzt passende Zeitstempel", () => {
    expect(timestampFields("clicked")).toEqual(["delivered_at", "opened_at", "clicked_at"]);
    expect(timestampFields("sent")).toEqual([]);
  });
});

describe("aggregateRecipientStats", () => {
  const base: RecipientStatRow = {
    status: "sent",
    delivered_at: null,
    opened_at: null,
    clicked_at: null,
    bounced_at: null,
    complained_at: null,
    unsubscribed_at: null,
  };
  it("zählt Zustellung, Öffnungen, Klicks, Bounces, Abmeldungen und Blockierte", () => {
    const s = aggregateRecipientStats([
      { ...base, status: "delivered", delivered_at: "x", opened_at: "x", clicked_at: "x" },
      { ...base, status: "delivered", delivered_at: "x", opened_at: "x", unsubscribed_at: "x" },
      { ...base, status: "delivered", delivered_at: "x" },
      { ...base, status: "delivered", delivered_at: "x" },
      { ...base, status: "bounced", bounced_at: "x" },
      { ...base, status: "blocked_allowlist" },
      { ...base, status: "queued" },
    ]);
    expect(s).toMatchObject({
      recipients: 7,
      sent: 5,
      delivered: 4,
      opened: 2,
      clicked: 1,
      bounced: 1,
      unsubscribed: 1,
      blocked: 1,
      queued: 1,
      openRate: 50,
      clickRate: 25,
      bounceRate: 20,
    });
  });
});
