import { describe, expect, it } from "vitest";
import {
  matchCancellation,
  normalizeName,
  planCancellation,
  planPortalCancellation,
} from "./cancellation";
import { formatDay } from "./schedule";

const NOW = new Date("2026-10-17T12:32:00Z");
const sub = {
  status: "active" as const,
  next_order_at: "2026-11-14T04:00:00Z",
  paused_until: null,
  skip_next: false,
  interval_count: 4,
};

describe("Kündigung (§ 312k BGB, H23)", () => {
  it("ordentlich zum nächstmöglichen Zeitpunkt: sofort gekündigt, Vertragsende am nächsten Liefertermin", () => {
    const p = planCancellation({
      kind: "ordinary",
      timing: "next_possible",
      now: NOW,
      subscription: sub,
    });
    expect(p.mode).toBe("immediate");
    expect(formatDay(p.effectiveAt)).toBe("14.11.2026");
    if (p.mode === "immediate") expect(p.cancelledAt).toEqual(NOW);
  });
  it("außerordentlich: sofort", () => {
    const p = planCancellation({
      kind: "extraordinary",
      timing: "date",
      desiredDay: "2027-01-01",
      now: NOW,
      subscription: sub,
    });
    expect(p).toEqual({ mode: "immediate", cancelledAt: NOW, effectiveAt: NOW });
  });
  it("Wunschdatum nach der nächsten Lieferung: Abo läuft bis dahin weiter", () => {
    const p = planCancellation({
      kind: "ordinary",
      timing: "date",
      desiredDay: "2026-12-20",
      now: NOW,
      subscription: sub,
    });
    expect(p.mode).toBe("scheduled");
    expect(formatDay(p.effectiveAt)).toBe("20.12.2026");
  });
  it("Wunschdatum vor der nächsten Lieferung oder ungültig: wie nächstmöglich", () => {
    expect(
      planCancellation({
        kind: "ordinary",
        timing: "date",
        desiredDay: "2026-10-30",
        now: NOW,
        subscription: sub,
      }).mode,
    ).toBe("immediate");
    expect(
      planCancellation({
        kind: "ordinary",
        timing: "date",
        desiredDay: "quatsch",
        now: NOW,
        subscription: sub,
      }).mode,
    ).toBe("immediate");
  });
  it("übersprungene Lieferung: Vertragsende am dann nächsten Termin", () => {
    const p = planCancellation({
      kind: "ordinary",
      timing: "next_possible",
      now: NOW,
      subscription: { ...sub, skip_next: true },
    });
    expect(formatDay(p.effectiveAt)).toBe("12.12.2026");
  });
  it("pausiertes Abo ohne Termin oder Zahlung offen: sofort", () => {
    const p = planCancellation({
      kind: "ordinary",
      timing: "next_possible",
      now: NOW,
      subscription: { ...sub, status: "paused", next_order_at: null },
    });
    expect(p.mode).toBe("immediate");
    expect(p.effectiveAt).toEqual(NOW);
  });
  it("Portal: ab sofort keine weiteren Lieferungen", () => {
    expect(planPortalCancellation(sub, NOW).mode).toBe("immediate");
  });
});

describe("Zuordnung ohne Login", () => {
  const subs = [
    { id: "a", number: "ABO-1001", status: "active" as const },
    { id: "b", number: "ABO-1002", status: "paused" as const },
    { id: "c", number: "ABO-1003", status: "cancelled" as const },
  ];
  it("ohne Nummer alle offenen Abos der Adresse", () => {
    expect(matchCancellation(subs, "").map((s) => s.id)).toEqual(["a", "b"]);
  });
  it("mit Nummer genau dieses Abo, Schreibweise egal", () => {
    expect(matchCancellation(subs, "abo 1002").map((s) => s.id)).toEqual(["b"]);
  });
  it("Nummer passt nicht oder ist schon gekündigt: nichts automatisch, interne Prüfung", () => {
    expect(matchCancellation(subs, "ABO-9999")).toEqual([]);
    expect(matchCancellation(subs, "ABO-1003")).toEqual([]);
    expect(matchCancellation(subs, "xx")).toEqual([]);
  });
  it("Namen normalisieren", () => {
    expect(normalizeName("  Jürgen   MÜLLER ")).toBe("jurgen muller");
  });
});
