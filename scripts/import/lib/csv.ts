/**
 * CSV-Leser nach RFC 4180 (Shopify-Exporte: UTF-8, oft mit BOM, Komma als Trenner, Felder mit
 * Zeilenumbrüchen in Anführungszeichen). Keine externe Abhängigkeit, damit package.json nur die
 * Skripteinträge bekommt. JSON-Dateien (Array flacher Objekte, z.B. aus der Admin-API) werden
 * auf dasselbe Zeilenformat abgebildet.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export type RawRow = Record<string, string>;

export interface Table {
  headers: string[];
  /** Datenzeilen; `line` ist die Zeilennummer in der Datei (Kopfzeile = 1) */
  rows: { line: number; data: RawRow }[];
}

/** Zerlegt CSV-Text in Datensätze (Arrays von Feldern) samt Startzeile. */
export function parseCsvRecords(
  text: string,
  delimiter = ",",
): { line: number; fields: string[] }[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: { line: number; fields: string[] }[] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let fieldStarted = false;

  const endRecord = () => {
    fields.push(field);
    // Leerzeilen (ein einziges leeres Feld) überspringen
    if (!(fields.length === 1 && fields[0] === "")) records.push({ line: recordLine, fields });
    fields = [];
    field = "";
    fieldStarted = false;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (c === delimiter) {
      fields.push(field);
      field = "";
      fieldStarted = false;
    } else if (c === "\r") {
      if (src[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else if (c === "\n") {
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (inQuotes) throw new Error(`CSV: Anführungszeichen ab Zeile ${recordLine} nicht geschlossen`);
  if (field !== "" || fields.length > 0) endRecord();
  return records;
}

/** Erkennt das Trennzeichen an der Kopfzeile (Komma, Semikolon aus deutschem Excel, Tab). */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

export function parseCsv(text: string): Table {
  const records = parseCsvRecords(text, detectDelimiter(text));
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].fields.map((h) => h.trim());
  const seen = new Set<string>();
  for (const h of headers) {
    if (h && seen.has(h)) throw new Error(`CSV: Spalte "${h}" kommt doppelt vor`);
    seen.add(h);
  }
  const rows = records.slice(1).map((r) => {
    const data: RawRow = {};
    headers.forEach((h, i) => {
      if (h) data[h] = r.fields[i] ?? "";
    });
    return { line: r.line, data };
  });
  return { headers, rows };
}

/** JSON: Array von Objekten oder { <name>: [...] } mit genau einem Array. */
export function parseJsonTable(text: string): Table {
  const parsed: unknown = JSON.parse(text);
  let list: unknown = parsed;
  if (!Array.isArray(list) && list && typeof list === "object") {
    const arrays = Object.values(list).filter(Array.isArray);
    if (arrays.length === 1) list = arrays[0];
  }
  if (!Array.isArray(list)) throw new Error("JSON: erwartet wird ein Array von Objekten");
  const headers = new Set<string>();
  const rows = list.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`JSON: Eintrag ${i + 1} ist kein Objekt`);
    }
    const data: RawRow = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      headers.add(k);
      data[k] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    return { line: i + 1, data };
  });
  return { headers: [...headers], rows };
}

export interface LoadedFile {
  path: string;
  name: string;
  sha256: string;
  table: Table;
}

export function loadTable(filePath: string): LoadedFile {
  const buf = readFileSync(filePath);
  const text = buf.toString("utf8");
  const table = filePath.toLowerCase().endsWith(".json") ? parseJsonTable(text) : parseCsv(text);
  return {
    path: path.resolve(filePath),
    name: path.basename(filePath),
    sha256: createHash("sha256").update(buf).digest("hex"),
    table,
  };
}

/** CSV schreiben (Aktivierungsliste). Felder mit Trenner, Anführungszeichen oder Umbruch werden gequotet. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
