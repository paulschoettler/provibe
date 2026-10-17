import { describe, expect, it } from "vitest";
import { prefillEmail } from "./prefill";

describe("prefillEmail", () => {
  it("übernimmt eine gültige Adresse (getrimmt, klein)", () => {
    expect(prefillEmail(" Anna@Example.org ")).toBe("anna@example.org");
    expect(prefillEmail("a+b@provibe-drinks.de")).toBe("a+b@provibe-drinks.de");
  });

  it("nimmt bei Mehrfachwerten den ersten", () => {
    expect(prefillEmail(["eins@example.org", "zwei@example.org"])).toBe("eins@example.org");
  });

  it("ignoriert Leeres und Ungültiges", () => {
    expect(prefillEmail(undefined)).toBeUndefined();
    expect(prefillEmail("")).toBeUndefined();
    expect(prefillEmail("keine-mail")).toBeUndefined();
    expect(prefillEmail('"><script>@x')).toBeUndefined();
    expect(prefillEmail(`${"a".repeat(260)}@example.org`)).toBeUndefined();
  });
});
