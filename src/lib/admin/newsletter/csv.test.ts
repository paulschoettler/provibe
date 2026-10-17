import { describe, expect, it } from "vitest";
import {
  mergeImportRow,
  normalizeImportStatus,
  parseConsentTimestamp,
  parseCsv,
  prepareNewsletterImport,
} from "./csv";

const NOW = new Date("2026-10-17T12:00:00Z");

describe("parseCsv", () => {
  it("erkennt Semikolon, Anführungszeichen, BOM und Umbrüche in Feldern", () => {
    const rows = parseCsv('﻿E-Mail;Vorname\r\n"a@b.de";"Max ""M"""\r\n"c@d.de";"Zeile\neins"\n');
    expect(rows).toEqual([
      ["E-Mail", "Vorname"],
      ["a@b.de", 'Max "M"'],
      ["c@d.de", "Zeile\neins"],
    ]);
  });
  it("nimmt Komma, wenn kein anderer Trenner vorkommt", () => {
    expect(parseCsv("Email,First Name\nx@y.de,Anna")).toEqual([
      ["Email", "First Name"],
      ["x@y.de", "Anna"],
    ]);
  });
});

describe("Status und Zeitstempel", () => {
  it("normalisiert Status aus Shopify und deutsch", () => {
    expect(normalizeImportStatus("subscribed")).toBe("subscribed");
    expect(normalizeImportStatus("Yes")).toBe("subscribed");
    expect(normalizeImportStatus("abonniert")).toBe("subscribed");
    expect(normalizeImportStatus("pending")).toBe("pending");
    expect(normalizeImportStatus("not_subscribed")).toBe("unsubscribed");
    expect(normalizeImportStatus("")).toBe("unsubscribed");
  });
  it("liest ISO, Shopify und deutsche Zeitstempel (ohne Zone Europe/Berlin)", () => {
    expect(parseConsentTimestamp("2025-05-01T08:00:00Z", NOW)).toBe("2025-05-01T08:00:00.000Z");
    expect(parseConsentTimestamp("2025-05-01 08:00:00 +0200", NOW)).toBe(
      "2025-05-01T06:00:00.000Z",
    );
    expect(parseConsentTimestamp("01.05.2025 08:00", NOW)).toBe("2025-05-01T06:00:00.000Z");
    expect(parseConsentTimestamp("15.01.2025", NOW)).toBe("2025-01-14T23:00:00.000Z");
  });
  it("verwirft ungültige und zukünftige Zeitstempel", () => {
    expect(parseConsentTimestamp("gestern", NOW)).toBeNull();
    expect(parseConsentTimestamp("2027-01-01T00:00:00Z", NOW)).toBeNull();
    expect(parseConsentTimestamp("", NOW)).toBeNull();
  });
});

describe("prepareNewsletterImport", () => {
  const csv = [
    "E-Mail;Vorname;Status;Einwilligungszeitpunkt",
    "anna@example.com;Anna;subscribed;2025-05-01 08:00:00 +0200",
    "ben@example.com;Ben;subscribed;",
    "cara@example.com;;not_subscribed;2025-05-01T08:00:00Z",
    "kaputt;X;subscribed;2025-05-01T08:00:00Z",
    "ANNA@example.com;Anna;subscribed;2025-05-01T08:00:00Z",
    "dora@example.com;Dora;pending;",
  ].join("\n");

  it("macht nur subscribed mit Zeitstempel versandfähig", () => {
    const r = prepareNewsletterImport(csv, NOW);
    expect(r.columns).toEqual({
      email: "E-Mail",
      firstName: "Vorname",
      status: "Status",
      consent: "Einwilligungszeitpunkt",
    });
    expect(r.summary).toEqual({ total: 4, subscribed: 1, pending: 2, unsubscribed: 1 });
    expect(r.rows[0]).toMatchObject({
      email: "anna@example.com",
      status: "subscribed",
      sendable: true,
      consentAt: "2025-05-01T06:00:00.000Z",
    });
    expect(r.rows[1]).toMatchObject({
      email: "ben@example.com",
      status: "pending",
      sendable: false,
    });
    expect(r.rows[1].issues[0]).toContain("Kein Einwilligungszeitpunkt");
    expect(r.rows[2]).toMatchObject({ status: "unsubscribed", consentAt: null });
    expect(r.errors).toEqual([{ line: 5, message: "Ungültige E-Mail-Adresse: kaputt" }]);
    expect(r.duplicates).toBe(1);
  });

  it("versteht Shopify-Spalten", () => {
    const r = prepareNewsletterImport(
      "Email,First Name,Accepts Email Marketing,Email Marketing Consent Updated At\nx@y.de,Xa,yes,2024-03-02 10:00:00 +0100",
      NOW,
    );
    expect(r.rows[0]).toMatchObject({
      status: "subscribed",
      consentAt: "2024-03-02T09:00:00.000Z",
    });
  });

  it("meldet fehlende Pflichtspalten", () => {
    expect(prepareNewsletterImport("Vorname\nAnna", NOW).errors[0].message).toContain("E-Mail");
    expect(prepareNewsletterImport("E-Mail\na@b.de", NOW).errors[0].message).toContain("Status");
    expect(prepareNewsletterImport("", NOW).errors[0].message).toContain("leer");
  });
});

describe("mergeImportRow", () => {
  const row = {
    line: 2,
    email: "a@b.de",
    firstName: "A",
    status: "subscribed" as const,
    consentAt: "2025-05-01T06:00:00.000Z",
    sendable: true,
    issues: [],
  };
  const now = NOW.toISOString();

  it("legt neue Kontakte mit Import-Nachweis an", () => {
    const d = mergeImportRow(null, row, now);
    expect(d).toEqual({
      action: "insert",
      values: {
        email: "a@b.de",
        first_name: "A",
        status: "subscribed",
        source: "import_shopify",
        confirmed_at: row.consentAt,
        imported_consent_at: row.consentAt,
        unsubscribed_at: null,
      },
    });
  });
  it("überschreibt nie Abmeldungen, Sperren oder bestehende Abos", () => {
    expect(mergeImportRow({ status: "unsubscribed", confirmed_at: null }, row, now).action).toBe(
      "skip",
    );
    expect(mergeImportRow({ status: "complained", confirmed_at: null }, row, now).action).toBe(
      "skip",
    );
    expect(mergeImportRow({ status: "subscribed", confirmed_at: now }, row, now).action).toBe(
      "skip",
    );
  });
  it("hebt unbestätigte Kontakte nur mit Nachweis an", () => {
    expect(mergeImportRow({ status: "pending", confirmed_at: null }, row, now).action).toBe(
      "update",
    );
    expect(
      mergeImportRow(
        { status: "pending", confirmed_at: null },
        { ...row, status: "pending", consentAt: null },
        now,
      ).action,
    ).toBe("skip");
  });
});
