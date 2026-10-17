import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  checkTransition,
  deriveOrderBadges,
  pathToShipped,
  type BadgeInput,
  type OrderStatus,
} from "./status";

const stripe = { paymentProvider: "stripe", paymentStatus: "paid" as const };
const manualUnpaid = { paymentProvider: "manual", paymentStatus: "unpaid" as const };

describe("Statusfluss", () => {
  it("erlaubt den Hauptweg offen → bezahlt → in Bearbeitung → versendet → zugestellt", () => {
    expect(checkTransition("pending", "paid", manualUnpaid).ok).toBe(true);
    expect(checkTransition("paid", "processing", stripe).ok).toBe(true);
    expect(checkTransition("processing", "shipped", stripe).ok).toBe(true);
    expect(checkTransition("shipped", "delivered", stripe).ok).toBe(true);
  });

  it("erlaubt Storno nur aus offen, bezahlt und in Bearbeitung", () => {
    const from: OrderStatus[] = ["pending", "paid", "processing"];
    for (const f of from) expect(checkTransition(f, "cancelled", stripe).ok).toBe(true);
    for (const f of ["shipped", "delivered", "refunded"] as OrderStatus[]) {
      expect(checkTransition(f, "cancelled", stripe).ok).toBe(false);
    }
  });

  it("verbietet Sprünge und Rückschritte", () => {
    expect(checkTransition("paid", "delivered", stripe).ok).toBe(false);
    expect(checkTransition("shipped", "processing", stripe).ok).toBe(false);
    expect(checkTransition("delivered", "shipped", stripe).ok).toBe(false);
    expect(checkTransition("refunded", "paid", stripe).ok).toBe(false);
  });

  it("meldet gleichen Status verständlich", () => {
    const r = checkTransition("paid", "paid", stripe);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("bereits bezahlt");
  });

  it("markiert Online-Zahlungen nie von Hand als bezahlt", () => {
    const r = checkTransition("pending", "paid", {
      paymentProvider: "stripe",
      paymentStatus: "unpaid",
    });
    expect(r.ok).toBe(false);
    expect(
      checkTransition("pending", "processing", {
        paymentProvider: "stripe",
        paymentStatus: "unpaid",
      }).ok,
    ).toBe(false);
  });

  it("erlaubt Bearbeitung ohne Zahlung bei manuellen Bestellungen (Rechnung)", () => {
    expect(checkTransition("pending", "processing", manualUnpaid).ok).toBe(true);
  });

  it("setzt erstattet nur nach vollständiger Erstattung", () => {
    expect(
      checkTransition("shipped", "refunded", {
        paymentProvider: "stripe",
        paymentStatus: "partially_refunded",
      }).ok,
    ).toBe(false);
    expect(
      checkTransition("shipped", "refunded", {
        paymentProvider: "stripe",
        paymentStatus: "refunded",
      }).ok,
    ).toBe(true);
    expect(
      checkTransition("cancelled", "refunded", {
        paymentProvider: "stripe",
        paymentStatus: "refunded",
      }).ok,
    ).toBe(true);
  });

  it("liefert Aktionsknöpfe ohne erstattet", () => {
    expect(allowedTransitions("paid", stripe)).toEqual(["processing", "cancelled"]);
    expect(
      allowedTransitions("pending", { paymentProvider: "stripe", paymentStatus: "unpaid" }),
    ).toEqual(["cancelled"]);
    expect(allowedTransitions("pending", manualUnpaid)).toEqual([
      "paid",
      "processing",
      "cancelled",
    ]);
    expect(allowedTransitions("refunded", stripe)).toEqual([]);
  });

  it("findet den Weg zu versendet", () => {
    expect(pathToShipped("paid", stripe)).toEqual(["processing", "shipped"]);
    expect(pathToShipped("processing", stripe)).toEqual(["shipped"]);
    expect(pathToShipped("shipped", stripe)).toEqual([]);
    expect(pathToShipped("pending", manualUnpaid)).toEqual(["processing", "shipped"]);
    expect(
      pathToShipped("pending", { paymentProvider: "stripe", paymentStatus: "unpaid" }),
    ).toBeNull();
    expect(pathToShipped("cancelled", stripe)).toBeNull();
  });
});

describe("deriveOrderBadges (H16)", () => {
  const base: BadgeInput = { status: "paid", paymentStatus: "paid", paymentProvider: "stripe" };
  const labels = (i: BadgeInput) => {
    const b = deriveOrderBadges(i);
    return [b.payment.label, b.fulfilment.label];
  };

  it("entspricht den Beispielen der Bestellliste (Figma)", () => {
    // PV-10008: offen / offen
    expect(
      labels({ status: "pending", paymentStatus: "unpaid", paymentProvider: "stripe" }),
    ).toEqual(["Offen", "Offen"]);
    // PV-10007: bezahlt / offen
    expect(labels(base)).toEqual(["Bezahlt", "Offen"]);
    // PV-10006: bezahlt / in Bearbeitung
    expect(labels({ ...base, status: "processing" })).toEqual(["Bezahlt", "In Bearbeitung"]);
    // PV-10005: bezahlt / versendet
    expect(
      labels({
        ...base,
        status: "shipped",
        shipments: [{ status: "shipped", shippedAt: "2026-10-22T10:00:00Z" }],
      }),
    ).toEqual(["Bezahlt", "Versendet"]);
    // PV-10004: bezahlt / zugestellt
    expect(labels({ ...base, status: "delivered" })).toEqual(["Bezahlt", "Zugestellt"]);
    // PV-10003: erstattet / storniert (storniert und danach voll erstattet)
    expect(labels({ ...base, status: "refunded", paymentStatus: "refunded" })).toEqual([
      "Erstattet",
      "Storniert",
    ]);
    // PV-10002: storniert / storniert (unbezahlt storniert)
    expect(
      labels({ status: "cancelled", paymentStatus: "unpaid", paymentProvider: "stripe" }),
    ).toEqual(["Storniert", "Storniert"]);
  });

  it("zeigt offene Erstattung nach Storno einer bezahlten Bestellung", () => {
    const b = deriveOrderBadges({ ...base, status: "cancelled" });
    expect(b.payment.key).toBe("refund_due");
    expect(b.payment.hollow).toBe(true);
    expect(b.fulfilment.key).toBe("cancelled");
  });

  it("unterscheidet Teil- und Vollerstattung", () => {
    expect(
      deriveOrderBadges({ ...base, status: "shipped", paymentStatus: "partially_refunded" }).payment
        .label,
    ).toBe("Teilweise erstattet");
    const full = deriveOrderBadges({
      ...base,
      status: "refunded",
      paymentStatus: "refunded",
      shipments: [{ status: "delivered", shippedAt: "x", deliveredAt: "y" }],
    });
    expect(full.payment.label).toBe("Erstattet");
    expect(full.fulfilment.label).toBe("Zugestellt");
  });

  it("leitet aus Sendungen ab, auch wenn der Status nachhinkt", () => {
    expect(
      deriveOrderBadges({ ...base, shipments: [{ status: "label_created" }] }).fulfilment.label,
    ).toBe("In Bearbeitung");
    expect(
      deriveOrderBadges({
        ...base,
        status: "shipped",
        shipments: [{ status: "delivered", shippedAt: "a", deliveredAt: "b" }],
      }).fulfilment.label,
    ).toBe("Zugestellt");
    expect(
      deriveOrderBadges({
        ...base,
        status: "shipped",
        shipments: [
          { status: "delivered", shippedAt: "a", deliveredAt: "b" },
          { status: "shipped", shippedAt: "a" },
        ],
      }).fulfilment.label,
    ).toBe("Versendet");
    expect(
      deriveOrderBadges({
        ...base,
        status: "shipped",
        shipments: [{ status: "returned", shippedAt: "a" }],
      }).fulfilment.label,
    ).toBe("Retoure");
  });

  it("ignoriert stornierte Labels und Retouren beim Versandstatus", () => {
    expect(
      deriveOrderBadges({
        ...base,
        shipments: [
          { status: "cancelled" },
          { status: "delivered", isReturn: true, deliveredAt: "x" },
        ],
      }).fulfilment.label,
    ).toBe("Offen");
  });

  it("zeigt Rechnung offen bei manuellen Bestellungen und markiert Testbestellungen", () => {
    const b = deriveOrderBadges({
      status: "pending",
      paymentStatus: "unpaid",
      paymentProvider: "manual",
      isTest: true,
    });
    expect(b.payment.label).toBe("Rechnung offen");
    expect(b.test?.label).toBe("Test");
    expect(deriveOrderBadges(base).test).toBeNull();
  });

  it("vergibt Figma-Farben", () => {
    const paid = deriveOrderBadges({
      ...base,
      status: "shipped",
      shipments: [{ status: "shipped", shippedAt: "x" }],
    });
    expect(paid.payment.tone).toBe("green");
    expect(paid.fulfilment.tone).toBe("blue");
    const open = deriveOrderBadges({ status: "pending", paymentStatus: "unpaid" });
    expect(open.payment).toMatchObject({ tone: "yellow", hollow: true });
  });
});
