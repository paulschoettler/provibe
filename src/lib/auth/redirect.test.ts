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

  it("packt das Ziel aus einer Callback-Adresse aus (Supabase-Vorlagen mit next={{ .RedirectTo }})", () => {
    expect(
      safeNextPath("https://www.provibe-drinks.de/auth/callback?next=%2Fcheckout%3Fschritt%3D2"),
    ).toBe("/checkout?schritt=2");
    expect(safeNextPath("https://evil.example/auth/callback?next=https%3A%2F%2Fevil.example")).toBe(
      "/account",
    );
    expect(safeNextPath("https://www.provibe-drinks.de/auth/callback?x=1")).toBe("/account");
    expect(safeNextPath("https://www.provibe-drinks.de/account")).toBe("/account");
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
