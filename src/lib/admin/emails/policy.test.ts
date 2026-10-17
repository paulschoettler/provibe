import { describe, expect, it } from "vitest";
import { canSendTo, isContactSendable, suppressionBlocks } from "./policy";

const env = {
  APP_STAGE: "production" as const,
  APP_INTEGRATIONS: "live" as const,
  EMAIL_ALLOWLIST: "@provibe-drinks.de,mail@paulschoettler.de,*",
};

describe("canSendTo", () => {
  it("ignoriert * solange die Allowlist aktiv ist", () => {
    expect(canSendTo("kunde@example.com", env, true)).toBe(false);
    expect(canSendTo("test-crm@provibe-drinks.de", env, true)).toBe(true);
    expect(canSendTo("mail@paulschoettler.de", env, true)).toBe(true);
  });
  it("öffnet erst nach dem Abschalten in production mit Live-Integrationen", () => {
    expect(canSendTo("kunde@example.com", env, false)).toBe(true);
    expect(canSendTo("kunde@example.com", { ...env, APP_STAGE: "preview" }, false)).toBe(false);
  });
  it("lehnt Unsinn ab", () => {
    expect(canSendTo("keine-adresse", env, false)).toBe(false);
  });
});

describe("suppressionBlocks", () => {
  it("sperrt Werbung bei jedem Grund, Transaktionales nur bei Bounce oder manuell", () => {
    expect(suppressionBlocks("complaint", "marketing")).toBe(true);
    expect(suppressionBlocks("unsubscribe", "marketing")).toBe(true);
    expect(suppressionBlocks("complaint", "transactional")).toBe(false);
    expect(suppressionBlocks("bounce", "transactional")).toBe(true);
    expect(suppressionBlocks("manual", "auth")).toBe(true);
  });
});

describe("isContactSendable", () => {
  it("verlangt subscribed und Bestätigungszeitpunkt", () => {
    expect(isContactSendable({ status: "subscribed", confirmed_at: "2026-10-01T10:00:00Z" })).toBe(
      true,
    );
    expect(isContactSendable({ status: "subscribed", confirmed_at: null })).toBe(false);
    expect(isContactSendable({ status: "pending", confirmed_at: "2026-10-01T10:00:00Z" })).toBe(
      false,
    );
  });
});
