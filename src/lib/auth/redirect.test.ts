import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("lässt interne Pfade durch", () => {
    expect(safeNextPath("/account/bestellungen/PV-010001")).toBe("/account/bestellungen/PV-010001");
    expect(safeNextPath("/checkout?schritt=2")).toBe("/checkout?schritt=2");
  });

  it("weist fremde Ziele ab", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/javascript:alert(1)",
      "account",
      "",
      "/auth/callback",
      "/account/login?next=/account",
      "/account\u0000",
    ]) {
      expect(safeNextPath(bad)).toBe("/account");
    }
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath(42)).toBe("/account");
  });

  it("nutzt den Fallback", () => {
    expect(safeNextPath("//x", "/")).toBe("/");
  });
});

describe("loginUrl", () => {
  it("hängt ein gültiges Ziel an", () => {
    expect(loginUrl("/account/daten")).toBe("/account/login?next=%2Faccount%2Fdaten");
    expect(loginUrl("https://evil.example")).toBe("/account/login");
    expect(loginUrl()).toBe("/account/login");
  });
});
