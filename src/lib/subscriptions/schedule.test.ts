import { describe, expect, it } from "vitest";
import {
  addDeliveryWeeks,
  berlinDay,
  deliveryDayAt,
  effectiveNextDelivery,
  firstNextOrderAt,
  formatDay,
  formatDayTime,
  nextOrderAfterDelivery,
  nextOrderAfterSkip,
  pauseSuggestions,
  reminderDue,
  remainingRetryDates,
  resumeNextOrderAt,
  retryDecision,
  validatePauseUntil,
} from "./schedule";

const NOW = new Date("2026-10-17T12:32:00Z"); // Sa., 17.10.2026, 14:32 Uhr in Berlin

describe("Liefertage", () => {
  it("speichert den Berliner Kalendertag als 04:00 UTC", () => {
    expect(deliveryDayAt("2026-11-14").toISOString()).toBe("2026-11-14T04:00:00.000Z");
    expect(() => deliveryDayAt("2026-02-30")).toThrow(RangeError);
    expect(berlinDay(new Date("2026-10-16T22:30:00Z"))).toBe("2026-10-17");
  });
  it("erste Folgelieferung: Bestelltag plus Intervall (Figma: 17.10. + 4 Wochen = 14.11.)", () => {
    expect(formatDay(firstNextOrderAt(NOW, 4))).toBe("14.11.2026");
    expect(formatDay(firstNextOrderAt(NOW, 2))).toBe("31.10.2026");
    expect(formatDay(firstNextOrderAt(NOW, 8))).toBe("12.12.2026");
  });
  it("bleibt über die Zeitumstellung beim selben Kalendertag", () => {
    // 25.10.2026 endet die Sommerzeit
    const d = addDeliveryWeeks(deliveryDayAt("2026-10-20"), 1);
    expect(berlinDay(d)).toBe("2026-10-27");
    expect(d.toISOString()).toBe("2026-10-27T04:00:00.000Z");
  });
  it("formatiert Datum und Uhrzeit für die Kündigungsbestätigung", () => {
    expect(formatDayTime(NOW)).toBe("17.10.2026 um 14:32 Uhr");
  });
});

describe("Termin nach einer Lieferung", () => {
  it("hält den Rhythmus bei pünktlicher Lieferung", () => {
    const scheduled = deliveryDayAt("2026-11-14");
    const now = new Date("2026-11-14T05:41:00Z");
    expect(formatDay(nextOrderAfterDelivery(scheduled, now, 4))).toBe("12.12.2026");
  });
  it("Lieferung nach Wiederholung an Tag 7 bleibt im Rhythmus, sofern genug Abstand ist", () => {
    const scheduled = deliveryDayAt("2026-11-14");
    const now = new Date("2026-11-21T08:00:00Z");
    expect(formatDay(nextOrderAfterDelivery(scheduled, now, 4))).toBe("12.12.2026");
  });
  it("zählt ab heute, wenn der alte Rhythmus zu knapp würde", () => {
    const scheduled = deliveryDayAt("2026-10-01");
    const now = new Date("2026-10-20T08:00:00Z");
    expect(formatDay(nextOrderAfterDelivery(scheduled, now, 4))).toBe("17.11.2026");
  });
  it("Überspringen verschiebt um genau ein Intervall", () => {
    expect(formatDay(nextOrderAfterSkip(deliveryDayAt("2026-11-14"), 4))).toBe("12.12.2026");
    expect(formatDay(nextOrderAfterSkip(deliveryDayAt("2026-11-14"), 6))).toBe("26.12.2026");
  });
});

describe("Anzeige der nächsten Lieferung", () => {
  const base = {
    status: "active",
    next_order_at: "2026-11-14T04:00:00Z",
    paused_until: null,
    skip_next: false,
    interval_count: 4,
  };
  it("aktiv, übersprungen, pausiert, gekündigt", () => {
    expect(formatDay(effectiveNextDelivery(base)!)).toBe("14.11.2026");
    expect(formatDay(effectiveNextDelivery({ ...base, skip_next: true })!)).toBe("12.12.2026");
    expect(
      formatDay(
        effectiveNextDelivery({ ...base, status: "paused", paused_until: "2026-12-05T04:00:00Z" })!,
      ),
    ).toBe("05.12.2026");
    expect(effectiveNextDelivery({ ...base, status: "cancelled" })).toBeNull();
  });
  it("eine geplante Kündigung vor dem Termin beendet die Lieferungen", () => {
    expect(
      effectiveNextDelivery({ ...base, cancel_effective_at: "2026-11-10T04:00:00Z" }),
    ).toBeNull();
    expect(
      effectiveNextDelivery({ ...base, cancel_effective_at: "2026-12-01T04:00:00Z" }),
    ).not.toBeNull();
  });
});

describe("Pause", () => {
  it("frühestens morgen, höchstens 183 Tage (6 Monate, H25)", () => {
    expect(validatePauseUntil("2026-10-17", NOW, 183).ok).toBe(false);
    expect(validatePauseUntil("2026-10-18", NOW, 183).ok).toBe(true);
    expect(validatePauseUntil("2027-04-18", NOW, 183).ok).toBe(true);
    const tooLate = validatePauseUntil("2027-04-19", NOW, 183);
    expect(tooLate.ok).toBe(false);
    if (!tooLate.ok) expect(tooLate.message).toContain("6 Monate");
    expect(validatePauseUntil("kein-datum", NOW, 183).ok).toBe(false);
  });
  it("Vorschläge 2, 4 und 8 Wochen ab der geplanten Lieferung (Figma 68:1101)", () => {
    const s = pauseSuggestions(deliveryDayAt("2026-11-14"), NOW, 183);
    expect(s.map((x) => formatDay(x.until))).toEqual(["28.11.2026", "12.12.2026", "09.01.2027"]);
    expect(pauseSuggestions(deliveryDayAt("2027-03-01"), NOW, 183).map((x) => x.weeks)).toEqual([
      2, 4,
    ]);
  });
  it("Fortsetzen: nächste Lieferung morgen", () => {
    expect(formatDay(resumeNextOrderAt(NOW))).toBe("18.10.2026");
  });
});

describe("Wiederholungen nach abgelehnter Zahlung", () => {
  const first = new Date("2026-10-15T05:41:00Z");
  it("Tag 3 und Tag 7 nach dem ersten Fehlschlag, danach Pause", () => {
    const a = retryDecision([3, 7], 1, first);
    expect(a.action).toBe("retry");
    if (a.action === "retry") expect(formatDay(a.at)).toBe("18.10.2026");
    const b = retryDecision([3, 7], 2, first);
    if (b.action === "retry") expect(formatDay(b.at)).toBe("22.10.2026");
    expect(retryDecision([3, 7], 3, first)).toEqual({ action: "pause" });
    expect(retryDecision([], 1, first)).toEqual({ action: "pause" });
    expect(() => retryDecision([3, 7], 0, first)).toThrow(RangeError);
  });
  it("nennt die noch offenen Versuche (Mail: am 18.10., danach 22.10.)", () => {
    expect(remainingRetryDates([3, 7], 1, first).map((d) => formatDay(d))).toEqual([
      "18.10.2026",
      "22.10.2026",
    ]);
    expect(remainingRetryDates([3, 7], 2, first).map((d) => formatDay(d))).toEqual(["22.10.2026"]);
    expect(remainingRetryDates([3, 7], 3, first)).toEqual([]);
  });
});

describe("Erinnerung drei Tage vorher", () => {
  const s = {
    status: "active",
    next_order_at: "2026-10-20T04:00:00Z",
    paused_until: null,
    skip_next: false,
    interval_count: 4,
    reminder_sent_for: null,
  };
  it("fällig im Fenster, nicht doppelt, nicht bei übersprungener oder pausierter Lieferung", () => {
    expect(reminderDue(s, NOW, 3)).toBe(true);
    expect(reminderDue({ ...s, next_order_at: "2026-10-25T04:00:00Z" }, NOW, 3)).toBe(false);
    expect(reminderDue({ ...s, reminder_sent_for: "2026-10-20T04:00:00Z" }, NOW, 3)).toBe(false);
    expect(reminderDue({ ...s, reminder_sent_for: "2026-10-20T04:00:00.000Z" }, NOW, 3)).toBe(
      false,
    );
    expect(reminderDue({ ...s, skip_next: true }, NOW, 3)).toBe(false);
    expect(reminderDue({ ...s, status: "paused" }, NOW, 3)).toBe(false);
    expect(reminderDue({ ...s, cancel_effective_at: "2026-10-19T00:00:00Z" }, NOW, 3)).toBe(false);
  });
});
