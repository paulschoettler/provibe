import { describe, expect, it } from "vitest";
import { isEmailAllowlisted, type AllowlistEnv } from "./allowlist";

const base = {
  APP_STAGE: "local",
  APP_INTEGRATIONS: "mock",
  EMAIL_ALLOWLIST: "@provibe-drinks.de,mail@paulschoettler.de",
} satisfies AllowlistEnv;

describe("E-Mail-Allowlist", () => {
  it("erlaubt Domain-Einträge und einzelne Adressen", () => {
    expect(isEmailAllowlisted("hello@provibe-drinks.de", base)).toBe(true);
    expect(isEmailAllowlisted("Support@Provibe-Drinks.de", base)).toBe(true);
    expect(isEmailAllowlisted("mail@paulschoettler.de", base)).toBe(true);
  });
  it("blockiert alle anderen Empfänger", () => {
    expect(isEmailAllowlisted("kunde@example.com", base)).toBe(false);
    expect(isEmailAllowlisted("hello@provibe-drinks.de.evil.com", base)).toBe(false);
  });
  it("öffnet '*' nur in production mit Live-Integrationen", () => {
    expect(isEmailAllowlisted("kunde@example.com", { ...base, EMAIL_ALLOWLIST: "*" })).toBe(false);
    expect(
      isEmailAllowlisted("kunde@example.com", {
        APP_STAGE: "production",
        APP_INTEGRATIONS: "live",
        EMAIL_ALLOWLIST: "*",
      }),
    ).toBe(true);
  });
});
