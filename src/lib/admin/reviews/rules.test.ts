import { describe, expect, it } from "vitest";
import { buildRejectionReason, excerpt, rejectionLabel, stars, statusFromTab } from "./rules";

describe("Bewertungsregeln", () => {
  it("liest Tabs", () => {
    expect(statusFromTab(undefined)).toBe("pending");
    expect(statusFromTab("abgelehnt")).toBe("rejected");
    expect(statusFromTab("unsinn")).toBe("pending");
  });
  it("verlangt einen Regelverstoß als Grund", () => {
    expect(buildRejectionReason("", "").ok).toBe(false);
    expect(buildRejectionReason("schlecht", "").ok).toBe(false);
    expect(buildRejectionReason("sonstiges", "kurz").ok).toBe(false);
    expect(buildRejectionReason("werbung", " Link zu Shop ")).toEqual({
      ok: true,
      value: "werbung: Link zu Shop",
    });
    expect(rejectionLabel("werbung: Link zu Shop")).toBe("Werbung, Spam oder Links: Link zu Shop");
    expect(rejectionLabel("werbung")).toBe("Werbung, Spam oder Links");
  });
  it("kürzt Texte und zeigt Sterne", () => {
    expect(excerpt("a ".repeat(100), 20).endsWith("…")).toBe(true);
    expect(excerpt("kurz")).toBe("kurz");
    expect(stars(4)).toBe("★★★★☆");
  });
});
