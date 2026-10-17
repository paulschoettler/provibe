import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../lib/args";
import { detectDelimiter, parseCsv, parseCsvRecords, parseJsonTable, toCsv } from "../lib/csv";
import { isLocalUrl, LOCAL_DATABASE_URL, resolveConnection } from "../lib/db";
import {
  cleanText,
  countryCode,
  maskEmail,
  normalizeEmail,
  parseIntOrNull,
  parseMoneyCents,
  parseShopifyDate,
  parseShopifyId,
  parseTags,
  parseYesNo,
  pick,
  rateBpFromTaxName,
  splitFullName,
} from "../lib/values";

describe("CSV-Parser", () => {
  it("liest Anführungszeichen, verdoppelte Anführungszeichen und Umbrüche im Feld", () => {
    const text = '﻿Name,Note\r\n#1001,"Bitte ""kühl"", danke"\r\n#1002,"Zeile 1\nZeile 2"\r\n';
    const t = parseCsv(text);
    expect(t.headers).toEqual(["Name", "Note"]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0].data.Note).toBe('Bitte "kühl", danke');
    expect(t.rows[1].data.Note).toBe("Zeile 1\nZeile 2");
    expect(t.rows[0].line).toBe(2);
    expect(t.rows[1].line).toBe(3);
  });

  it("überspringt Leerzeilen und füllt fehlende Felder mit Leerstring", () => {
    const t = parseCsv("a,b,c\n1,2\n\n4,5,6\n");
    expect(t.rows.map((r) => r.data)).toEqual([
      { a: "1", b: "2", c: "" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("erkennt Semikolon aus deutschem Excel", () => {
    expect(detectDelimiter("Code;Type;Value\nA;B;C")).toBe(";");
    expect(parseCsv("Code;Value\nPRESALE10;10,0").rows[0].data).toEqual({
      Code: "PRESALE10",
      Value: "10,0",
    });
  });

  it("meldet offene Anführungszeichen und doppelte Spalten", () => {
    expect(() => parseCsvRecords('a,b\n1,"offen')).toThrow(/nicht geschlossen/);
    expect(() => parseCsv("Email,Email\nx,y")).toThrow(/doppelt/);
  });

  it("liest JSON-Arrays aus der Admin-API", () => {
    const t = parseJsonTable(
      JSON.stringify({ discounts: [{ code: "A", value: -10, once_per_customer: true }] }),
    );
    expect(t.rows[0].data).toEqual({ code: "A", value: "-10", once_per_customer: "true" });
  });

  it("schreibt CSV mit Quoting", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x,y", 'q"z'],
          [null, 3],
        ],
      ),
    ).toBe('a,b\n"x,y","q""z"\n,3\n');
  });
});

describe("Werte", () => {
  it("rechnet Beträge exakt in Cent", () => {
    expect(parseMoneyCents("26.10")).toBe(2610);
    expect(parseMoneyCents("26,10")).toBe(2610);
    expect(parseMoneyCents("€132.00")).toBe(13200);
    expect(parseMoneyCents("1,234.56")).toBe(123456);
    expect(parseMoneyCents("1.234,56")).toBe(123456);
    expect(parseMoneyCents("-10.0")).toBe(-1000);
    expect(parseMoneyCents("0.1")).toBe(10);
    expect(parseMoneyCents("4.905")).toBe(491);
    expect(parseMoneyCents("1,234")).toBe(123400);
    expect(parseMoneyCents("")).toBeNull();
    expect(() => parseMoneyCents("zehn")).toThrow();
  });

  it("liest Shopify-Datumswerte und speichert UTC", () => {
    expect(parseShopifyDate("2026-05-10 14:03:15 +0200")).toBe("2026-05-10T12:03:15.000Z");
    expect(parseShopifyDate("2026-02-20T18:45:00Z")).toBe("2026-02-20T18:45:00.000Z");
    expect(parseShopifyDate("2026-02-20T18:45:00+01:00")).toBe("2026-02-20T17:45:00.000Z");
    expect(parseShopifyDate("2026-01-15 10:00:00 UTC")).toBe("2026-01-15T10:00:00.000Z");
    // ohne Zone: Shop-Zeitzone Europe/Berlin, Winter- und Sommerzeit
    expect(parseShopifyDate("2026-01-15 10:00")).toBe("2026-01-15T09:00:00.000Z");
    expect(parseShopifyDate("2026-07-15")).toBe("2026-07-14T22:00:00.000Z");
    expect(parseShopifyDate("15.03.2026 14:23")).toBe("2026-03-15T13:23:00.000Z");
    expect(parseShopifyDate("")).toBeNull();
    expect(() => parseShopifyDate("gestern")).toThrow();
    expect(() => parseShopifyDate("2026-13-01")).toThrow();
  });

  it("entfernt das Excel-Apostroph vor IDs und Telefonnummern", () => {
    expect(cleanText("'+491701234567")).toBe("+491701234567");
    expect(cleanText("'7001000000001")).toBe("7001000000001");
    expect(cleanText("O'Brien")).toBe("O'Brien");
    expect(parseShopifyId("'7001000000001")).toBe("7001000000001");
    expect(parseShopifyId("gid://shopify/Customer/42")).toBe("42");
    expect(() => parseShopifyId("abc")).toThrow();
  });

  it("findet Spalten über Aliase ohne Groß/Kleinschreibung", () => {
    expect(
      pick({ "accepts marketing": "yes" }, ["Accepts Email Marketing", "Accepts Marketing"]),
    ).toBe("yes");
    expect(pick({ A: "", B: "x" }, ["A", "B"])).toBe("x");
  });

  it("normalisiert E-Mails und Namen", () => {
    expect(normalizeEmail(" Max.Beispiel@Example.org ")).toBe("max.beispiel@example.org");
    expect(normalizeEmail("")).toBeNull();
    expect(() => normalizeEmail("kein-at")).toThrow();
    expect(splitFullName("Erika Maria Mustermann")).toEqual({
      firstName: "Erika Maria",
      lastName: "Mustermann",
    });
    expect(splitFullName("Mustermann")).toEqual({ firstName: "", lastName: "Mustermann" });
    expect(maskEmail("erika@example.com")).toBe("e***@example.com");
  });

  it("liest Ja/Nein, Zahlen, Länder, Steuersätze und Tags", () => {
    expect(parseYesNo("yes")).toBe(true);
    expect(parseYesNo("no")).toBe(false);
    expect(() => parseYesNo("vielleicht")).toThrow();
    expect(parseIntOrNull("12")).toBe(12);
    expect(parseIntOrNull("")).toBeNull();
    expect(countryCode("de")).toBe("DE");
    expect(countryCode("Germany")).toBe("DE");
    expect(countryCode("Atlantis")).toBeNull();
    expect(rateBpFromTaxName("DE MwSt 19%")).toBe(1900);
    expect(rateBpFromTaxName("MwSt. 7 %")).toBe(700);
    expect(rateBpFromTaxName("Steuer")).toBeNull();
    expect(parseTags("Presale, VIP, presale,")).toEqual(["Presale", "VIP"]);
  });
});

describe("Argumente und Schutz der Live-Datenbank", () => {
  it("Probelauf ist Standard, pnpm-Trenner wird ignoriert", () => {
    const a = parseArgs(["--", "--file", "x.csv"]);
    expect(a.apply).toBe(false);
    expect(a.batchSize).toBe(200);
    expect(parseArgs(["--file=x.csv", "--apply"]).apply).toBe(true);
    expect(() => parseArgs(["--apply", "--dry-run", "--file", "x"])).toThrow();
    expect(() => parseArgs([])).toThrow(/--file/);
  });

  it("nimmt ohne DATABASE_URL die lokale Datenbank", () => {
    expect(resolveConnection({}, { remote: false, backup: null })).toEqual({
      url: LOCAL_DATABASE_URL,
      isLocal: true,
    });
    expect(isLocalUrl("postgres://postgres@127.0.0.1:54329/x")).toBe(true);
    expect(isLocalUrl("postgres://u@db.abc.supabase.co:5432/postgres")).toBe(false);
  });

  it("verweigert entfernte Datenbanken ohne --remote und frisches Backup", () => {
    const env = { DATABASE_URL: "postgres://u@db.abc.supabase.co:5432/postgres" };
    expect(() => resolveConnection(env, { remote: false, backup: null })).toThrow(/nur lokal/);
    expect(() => resolveConnection(env, { remote: true, backup: null })).toThrow(/--backup/);
    const dir = mkdtempSync(path.join(os.tmpdir(), "import-test-"));
    const backup = path.join(dir, "dump.sql");
    writeFileSync(backup, "-- dump");
    expect(resolveConnection(env, { remote: true, backup }).isLocal).toBe(false);
    const old = (Date.now() - 2 * 86_400_000) / 1000;
    utimesSync(backup, old, old);
    expect(() => resolveConnection(env, { remote: true, backup })).toThrow(/24 Stunden/);
  });
});
