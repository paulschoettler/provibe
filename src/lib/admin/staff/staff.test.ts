import { describe, expect, it } from "vitest";
import {
  findMatchingRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyRecoveryCode,
} from "./recovery-codes";
import { adminLoginUrl, adminTwoFactorUrl, safeAdminNext } from "./redirect";
import {
  checkActiveChange,
  checkMfaReset,
  checkRoleChange,
  initials,
  mfaDisplay,
  type StaffLike,
} from "./rules";

describe("safeAdminNext", () => {
  it("lässt Backoffice-Pfade durch", () => {
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin/bestellungen?status=paid")).toBe(
      "/admin/bestellungen?status=paid",
    );
  });
  it("verwirft fremde Ziele und Anmelde-Routen", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil",
      "/account",
      "/administrator",
      "/admin/login",
      "/admin/2fa?next=/admin",
      "/admin/logout",
      "/admin/callback",
      "/admin/../account",
      "/admin/\u0000",
      "",
      42,
    ]) {
      expect(safeAdminNext(bad)).toBe("/admin");
    }
  });
  it("baut Login- und 2FA-Links", () => {
    expect(adminLoginUrl("/admin/kunden")).toBe("/admin/login?next=%2Fadmin%2Fkunden");
    expect(adminLoginUrl("/admin")).toBe("/admin/login");
    expect(adminLoginUrl("https://x.y")).toBe("/admin/login");
    expect(adminTwoFactorUrl(null, { modus: "wiederherstellung" })).toBe(
      "/admin/2fa?modus=wiederherstellung",
    );
  });
});

describe("Wiederherstellungscodes", () => {
  it("erzeugt zehn verschiedene Codes im Format XXXXX-XXXXX", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  });
  it("normalisiert tolerant und lehnt Fremdzeichen ab", () => {
    expect(normalizeRecoveryCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(normalizeRecoveryCode("ABCDE FGHJK")).toBe("ABCDEFGHJK");
    expect(normalizeRecoveryCode("ABCDE-FGHJ0")).toBeNull(); // 0 ist nicht im Alphabet
    expect(normalizeRecoveryCode("ABC")).toBeNull();
  });
  it("speichert nur den Hash und prüft korrekt", async () => {
    const [code] = generateRecoveryCodes(1);
    const hash = await hashRecoveryCode(code);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(code.replace("-", ""));
    expect(await verifyRecoveryCode(code.toLowerCase(), hash)).toBe(true);
    expect(await verifyRecoveryCode("22222-22222", hash)).toBe(false);
    expect(await verifyRecoveryCode(code, "md5$x$y")).toBe(false);
  });
  it("findet den passenden offenen Code", async () => {
    const codes = generateRecoveryCodes(3);
    const candidates = await Promise.all(
      codes.map(async (c, i) => ({ id: `id${i}`, code_hash: await hashRecoveryCode(c) })),
    );
    expect(await findMatchingRecoveryCode(codes[2], candidates)).toBe("id2");
    expect(await findMatchingRecoveryCode("ZZZZZ-ZZZZZ", candidates)).toBeNull();
    expect(await findMatchingRecoveryCode("kein code", candidates)).toBeNull();
  });
});

describe("Regeln der Benutzerverwaltung", () => {
  const owner = { userId: "o1", role: "owner" as const };
  const all: StaffLike[] = [
    { userId: "o1", role: "owner", isActive: true },
    { userId: "a1", role: "admin", isActive: true },
    { userId: "s1", role: "support", isActive: true },
  ];

  it("nur Owner ändern Rollen", () => {
    expect(checkRoleChange({ userId: "a1", role: "admin" }, all[2], "fulfillment", all).ok).toBe(
      false,
    );
    expect(checkRoleChange(owner, all[2], "fulfillment", all).ok).toBe(true);
  });
  it("letzter Owner bleibt Owner", () => {
    const r = checkRoleChange(owner, all[0], "admin", all);
    expect(r).toEqual({ ok: false, reason: "Es muss mindestens ein aktiver Owner bleiben." });
  });
  it("Owner kann sich bei zwei Owners nicht selbst herabstufen", () => {
    const two = [...all, { userId: "o2", role: "owner" as const, isActive: true }];
    expect(checkRoleChange(owner, two[0], "admin", two).ok).toBe(false);
    expect(checkRoleChange(owner, two[3], "admin", two).ok).toBe(true);
  });
  it("Deaktivieren: nicht sich selbst, nicht den letzten Owner", () => {
    expect(checkActiveChange(owner, all[0], false, all).ok).toBe(false);
    expect(checkActiveChange(owner, all[1], false, all).ok).toBe(true);
    expect(checkActiveChange(owner, all[1], true, all).ok).toBe(false);
    expect(checkActiveChange({ userId: "a1", role: "admin" }, all[2], false, all).ok).toBe(false);
  });
  it("Zwei-Faktor zurücksetzen nur durch einen anderen Owner", () => {
    expect(checkMfaReset(owner, all[1]).ok).toBe(true);
    expect(checkMfaReset(owner, all[0]).ok).toBe(false);
    expect(checkMfaReset({ userId: "a1", role: "admin" }, all[2]).ok).toBe(false);
  });
  it("Zwei-Faktor-Anzeige und Initialen", () => {
    expect(mfaDisplay({ verifiedFactors: 1, invitePending: false })).toBe("active");
    expect(mfaDisplay({ verifiedFactors: 0, invitePending: false })).toBe("pending");
    expect(mfaDisplay({ verifiedFactors: 0, invitePending: true })).toBe("invite");
    expect(initials("Paul Schöttler", "mail@paulschoettler.de")).toBe("PS");
    expect(initials("PROVIBE Team", "hello@provibe-drinks.de")).toBe("PT");
    expect(initials(null, "support@provibe-drinks.de")).toBe("SU");
    expect(initials("hello", "hello@provibe-drinks.de")).toBe("HE");
  });
});
