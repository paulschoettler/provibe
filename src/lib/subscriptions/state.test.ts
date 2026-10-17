import { describe, expect, it } from "vitest";
import {
  allowedFrom,
  canTransition,
  isEditable,
  nextStatus,
  SubscriptionStateError,
} from "./state";

describe("Zustandsmaschine", () => {
  it("draft → active → paused → active", () => {
    expect(nextStatus("draft", "activate")).toBe("active");
    expect(nextStatus("active", "pause")).toBe("paused");
    expect(nextStatus("paused", "resume")).toBe("active");
  });
  it("Zahlungsfehler: active → past_due → active oder nach dem letzten Versuch paused", () => {
    expect(nextStatus("active", "payment_failed")).toBe("past_due");
    expect(nextStatus("past_due", "payment_failed")).toBe("past_due");
    expect(nextStatus("past_due", "payment_succeeded")).toBe("active");
    expect(nextStatus("past_due", "payment_exhausted")).toBe("paused");
    expect(nextStatus("active", "payment_action_required")).toBe("past_due");
  });
  it("kündigen geht aus jedem offenen Zustand, danach ist Schluss", () => {
    for (const s of ["draft", "active", "paused", "past_due"] as const) {
      expect(nextStatus(s, "cancel")).toBe("cancelled");
    }
    for (const e of [
      "activate",
      "pause",
      "resume",
      "skip",
      "change",
      "cancel",
      "payment_succeeded",
    ] as const) {
      expect(canTransition("cancelled", e)).toBe(false);
    }
  });
  it("verbietet unsinnige Übergänge", () => {
    expect(() => nextStatus("active", "resume")).toThrow(SubscriptionStateError);
    expect(() => nextStatus("paused", "skip")).toThrow(SubscriptionStateError);
    expect(() => nextStatus("draft", "pause")).toThrow(SubscriptionStateError);
    expect(canTransition("active", "payment_exhausted")).toBe(false);
  });
  it("liefert die Ausgangszustände für subscription_apply", () => {
    expect(allowedFrom("resume")).toEqual(["paused"]);
    expect(allowedFrom("change").sort()).toEqual(["active", "past_due", "paused"]);
    expect(isEditable("cancelled")).toBe(false);
    expect(isEditable("past_due")).toBe(true);
  });
});
