import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, hashIp, rateLimitKey, toInterval } from "./rate-limit-core";

describe("rate-limit-core", () => {
  it("hasht IPs stabil, gesalzen und ohne Klartext", () => {
    const a = hashIp("203.0.113.7", "salz");
    expect(a).toHaveLength(32);
    expect(a).toBe(hashIp(" 203.0.113.7 ", "salz"));
    expect(a).not.toBe(hashIp("203.0.113.7", "anderes-salz"));
    expect(a).not.toContain("203");
  });

  it("baut Schlüssel aus Aktion und Hash", () => {
    expect(rateLimitKey("contact", "abc")).toBe("contact:abc");
    expect(() => rateLimitKey("Kontakt Formular", "abc")).toThrow();
  });

  it("wandelt Sekunden in ein Intervall", () => {
    expect(toInterval(3600)).toBe("3600 seconds");
    expect(() => toInterval(0)).toThrow();
    expect(() => toInterval(1.5)).toThrow();
  });

  it("liest die Client-IP aus den Headern", () => {
    const h = (map: Record<string, string>) => (n: string) => map[n] ?? null;
    expect(clientIpFromHeaders(h({ "x-nf-client-connection-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(h({}))).toBe("unbekannt");
  });
});
