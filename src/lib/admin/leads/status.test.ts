import { describe, expect, it } from "vitest";
import { LEAD_STATUS_LABELS, canChangeLeadStatus, isOpenLead } from "./status";

describe("Lead-Status", () => {
  it("zeigt qualified als Qualifiziert (H18)", () => {
    expect(LEAD_STATUS_LABELS.qualified).toBe("Qualifiziert");
  });
  it("erlaubt Vorwärtswechsel und Wiederaufnahme, keine Nullwechsel", () => {
    expect(canChangeLeadStatus("new", "qualified")).toBe(true);
    expect(canChangeLeadStatus("contacted", "lost")).toBe(true);
    expect(canChangeLeadStatus("won", "qualified")).toBe(true);
    expect(canChangeLeadStatus("lost", "new")).toBe(false);
    expect(canChangeLeadStatus("new", "new")).toBe(false);
  });
  it("erkennt offene Leads", () => {
    expect(isOpenLead("new")).toBe(true);
    expect(isOpenLead("won")).toBe(false);
  });
});
