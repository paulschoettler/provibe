import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  deliveryWindowText,
  orderSteps,
  paymentMethodLabel,
  reachedStep,
  statusBadge,
  statusSentence,
  type OrderTimeline,
} from "./order-status";

const base: OrderTimeline = {
  status: "pending",
  paymentStatus: "unpaid",
  placedAt: "2026-10-17T10:00:00Z", // Samstag
  paidAt: null,
  shippedAt: null,
  deliveredAt: null,
};

describe("reachedStep", () => {
  it("folgt Status und Zeitstempeln", () => {
    expect(reachedStep(base)).toBe(0);
    expect(reachedStep({ ...base, status: "paid", paymentStatus: "paid" })).toBe(1);
    expect(reachedStep({ ...base, status: "processing" })).toBe(1);
    expect(reachedStep({ ...base, status: "paid", shippedAt: "2026-10-19T08:00:00Z" })).toBe(2);
    expect(reachedStep({ ...base, status: "delivered" })).toBe(3);
  });
});

describe("orderSteps", () => {
  it("zeigt den Figma-Zustand Versendet", () => {
    const steps = orderSteps({
      ...base,
      status: "shipped",
      paymentStatus: "paid",
      paidAt: "2026-10-17T10:01:00Z",
      shippedAt: "2026-10-19T08:00:00Z",
    });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "open"]);
    expect(steps.map((s) => s.dateText)).toEqual(["17.10.", "17.10.", "19.10.", "erwartet"]);
  });

  it("markiert bei Zustellung alle Schritte als erledigt", () => {
    const steps = orderSteps({ ...base, status: "delivered", deliveredAt: "2026-10-21T12:00:00Z" });
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });

  it("beginnt mit Bestellt als aktuellem Schritt", () => {
    expect(orderSteps(base).map((s) => s.state)).toEqual(["current", "open", "open", "open"]);
  });
});

describe("Zustellfenster", () => {
  it("überspringt Wochenenden", () => {
    expect(addBusinessDays("2026-10-17T10:00:00Z", 3).toISOString().slice(0, 10)).toBe(
      "2026-10-21",
    );
    expect(addBusinessDays("2026-10-17T10:00:00Z", 5).toISOString().slice(0, 10)).toBe(
      "2026-10-23",
    );
  });

  it("formatiert wie im Entwurf", () => {
    expect(deliveryWindowText({ ...base, status: "shipped" })).toBe(
      "Mi., 21.10. bis Fr., 23.10.2026",
    );
    expect(deliveryWindowText({ ...base, status: "delivered" })).toBeNull();
    expect(deliveryWindowText({ ...base, status: "cancelled" })).toBeNull();
  });

  it("baut den Statussatz", () => {
    expect(statusSentence({ ...base, status: "shipped" })).toBe(
      "Mit DHL unterwegs. Zustellung voraussichtlich Mi., 21.10. bis Fr., 23.10.2026.",
    );
    expect(statusSentence({ ...base, status: "cancelled" })).toBe(
      "Diese Bestellung wurde storniert.",
    );
  });
});

describe("Beschriftungen", () => {
  it("liefert Badge und Zahlart", () => {
    expect(statusBadge({ status: "shipped" })).toEqual({ label: "Versendet", tone: "butter" });
    expect(paymentMethodLabel("sepa_debit")).toBe("SEPA-Lastschrift");
    expect(paymentMethodLabel("unbekannt")).toBe("unbekannt");
  });
});
