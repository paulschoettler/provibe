import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  allowedVendors,
  consentAction,
  consentCategories,
  consentIdFromBytes,
  decideConsent,
  hasMarketingConsent,
  isCurrentConsent,
  mayLoad,
  parseConsent,
  revokedVendors,
  serializeConsent,
  type ConsentState,
} from "./consent";

const ID = "k3j4h5g6f7d8s9a0q1w2";
const base: ConsentState = {
  version: CONSENT_VERSION,
  id: ID,
  ts: 1760702400,
  analytics: false,
  vendors: ["meta", "tiktok"],
};
const ids = { meta: "1372318701489027", google: "AW-123456789", tiktok: "C1234567890ABCDEFGHI" };

describe("Consent-Cookie", () => {
  it("serialisiert ohne personenbezogene Daten in fester Reihenfolge", () => {
    expect(serializeConsent(base)).toBe(`${CONSENT_VERSION}~${ID}~1760702400~mt`);
    expect(serializeConsent({ ...base, vendors: ["tiktok", "meta", "google"] })).toBe(
      `${CONSENT_VERSION}~${ID}~1760702400~mgt`,
    );
    expect(serializeConsent({ ...base, vendors: [] })).toBe(
      `${CONSENT_VERSION}~${ID}~1760702400~-`,
    );
  });

  it("liest den eigenen Wert verlustfrei zurück", () => {
    expect(parseConsent(serializeConsent(base))).toEqual(base);
    expect(parseConsent(serializeConsent({ ...base, vendors: [] }))?.vendors).toEqual([]);
    expect(parseConsent(encodeURIComponent(serializeConsent(base)))).toEqual(base);
  });

  it("verwirft alles, was nicht exakt passt", () => {
    for (const raw of [
      "",
      null,
      undefined,
      "true",
      `${CONSENT_VERSION}~${ID}~1760702400`,
      `${CONSENT_VERSION}~${ID}~1760702400~`,
      `${CONSENT_VERSION}~${ID}~1760702400~x`,
      `${CONSENT_VERSION}~${ID}~1760702400~tm`,
      `${CONSENT_VERSION}~KURZ~1760702400~m`,
      `${CONSENT_VERSION}~${ID}~abc~m`,
      `17.10.2026~${ID}~1760702400~m`,
      `${CONSENT_VERSION}~${ID}~1760702400~m~extra`,
      "%E0%A4%A",
      "a".repeat(200),
    ]) {
      expect(parseConsent(raw)).toBeNull();
    }
  });

  it("gilt nur mit aktueller Textversion", () => {
    expect(isCurrentConsent(base)).toBe(true);
    expect(isCurrentConsent({ ...base, version: "2025-01-01" })).toBe(false);
    expect(hasMarketingConsent({ ...base, version: "2025-01-01" })).toBe(false);
    expect(hasMarketingConsent({ ...base, vendors: [] })).toBe(false);
    expect(hasMarketingConsent(base)).toBe(true);
  });
});

describe("Entscheidung", () => {
  const ctx = { id: "neuekennung000000000", now: 1760702400123 };

  it("alle, notwendig und Auswahl", () => {
    expect(decideConsent("alle", [], null, ctx).vendors).toEqual(["meta", "google", "tiktok"]);
    expect(decideConsent("notwendig", ["meta"], null, ctx).vendors).toEqual([]);
    expect(decideConsent("auswahl", ["tiktok", "evil", "meta", "meta"], null, ctx).vendors).toEqual(
      ["meta", "tiktok"],
    );
  });

  it("Statistik bleibt aus, Zeitpunkt in Sekunden, Kennung bleibt erhalten", () => {
    const next = decideConsent("alle", [], base, ctx);
    expect(next.analytics).toBe(false);
    expect(next.ts).toBe(1760702400);
    expect(next.id).toBe(ID);
    expect(decideConsent("alle", [], null, ctx).id).toBe(ctx.id);
  });

  it("Art für consent_logs", () => {
    const all = decideConsent("alle", [], null, ctx);
    const none = decideConsent("notwendig", [], null, ctx);
    const some = decideConsent("auswahl", ["google"], null, ctx);
    expect(consentAction(null, all)).toBe("accept_all");
    expect(consentAction(null, none)).toBe("reject_all");
    expect(consentAction(null, some)).toBe("custom");
    expect(consentAction(base, none)).toBe("withdraw");
    expect(consentCategories(some)).toEqual({
      necessary: true,
      analytics: false,
      marketing: true,
      vendors: { meta: false, google: true, tiktok: false },
    });
  });

  it("erkennt entzogene Dienste", () => {
    expect(revokedVendors(base, { ...base, vendors: ["meta"] })).toEqual(["tiktok"]);
    expect(revokedVendors(null, { ...base, vendors: [] })).toEqual([]);
  });

  it("Kennung aus Zufallsbytes passt zum Format", () => {
    const id = consentIdFromBytes(new Uint8Array(20).map((_, i) => i * 37));
    expect(id).toMatch(/^[a-z0-9]{20}$/);
  });
});

describe("Darf laden", () => {
  it("ohne Entscheidung lädt nichts", () => {
    expect(allowedVendors(null, ids)).toEqual([]);
  });

  it("nur eingewilligte Dienste mit eingetragener ID", () => {
    expect(allowedVendors(base, ids)).toEqual(["meta", "tiktok"]);
    expect(allowedVendors(base, { ...ids, tiktok: null })).toEqual(["meta"]);
    expect(mayLoad("google", base, ids)).toBe(false);
  });

  it("nie ohne IDs, mit alter Textversion oder auf Token-Seiten", () => {
    expect(allowedVendors(base, null)).toEqual([]);
    expect(allowedVendors(base, { meta: null, google: null, tiktok: null })).toEqual([]);
    expect(allowedVendors({ ...base, version: "2025-01-01" }, ids)).toEqual([]);
    expect(allowedVendors(base, ids, { sensitivePath: true })).toEqual([]);
  });
});
