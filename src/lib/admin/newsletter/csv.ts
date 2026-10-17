/**
 * Import-Vorbereitung für Newsletter-Kontakte aus CSV (Shopify-Export oder eigene Liste).
 * Spalten: E-Mail, Vorname, Status, Einwilligungszeitpunkt (deutsche und Shopify-Bezeichnungen).
 * Regel (Briefing 13, D3): Nur Status "subscribed" MIT Zeitstempel wird versandfähig, alles andere
 * wird pending (abonniert ohne Nachweis) oder unsubscribed. Bestehende Abmeldungen und Sperren
 * werden nie überschrieben. Rein, getestet in csv.test.ts.
 */

export type ImportStatus = "subscribed" | "pending" | "unsubscribed";

export interface ImportRow {
  line: number;
  email: string;
  firstName: string | null;
  status: ImportStatus;
  consentAt: string | null;
  sendable: boolean;
  issues: string[];
}

export interface ImportPreparation {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  duplicates: number;
  columns: {
    email: string | null;
    firstName: string | null;
    status: string | null;
    consent: string | null;
  };
  summary: { total: number; subscribed: number; pending: number; unsubscribed: number };
}

/** CSV mit Anführungszeichen, "" als Escape, Zeilenumbrüchen in Feldern, BOM; Trenner automatisch. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch as keyof typeof counts]++;
  }
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delimiter = bestCount > 0 ? best : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function norm(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIASES = {
  email: ["e mail", "email", "e mail adresse", "email adresse", "email address", "mail"],
  firstName: ["vorname", "first name", "firstname", "first"],
  status: [
    "status",
    "newsletter status",
    "email marketing status",
    "accepts email marketing",
    "accepts marketing",
    "email marketing",
  ],
  consent: [
    "einwilligungszeitpunkt",
    "einwilligung",
    "einwilligung am",
    "zeitstempel",
    "consent",
    "consent at",
    "consented at",
    "email marketing consent updated at",
    "accepts email marketing updated at",
    "accepts marketing updated at",
  ],
} as const;

function findColumn(headers: string[], aliases: readonly string[]): number {
  const normalized = headers.map(norm);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

const SUBSCRIBED = new Set([
  "subscribed",
  "abonniert",
  "yes",
  "ja",
  "true",
  "1",
  "opted in",
  "angemeldet",
]);
const PENDING = new Set(["pending", "unbestaetigt", "ausstehend", "unconfirmed"]);

export function normalizeImportStatus(raw: string): ImportStatus {
  const v = norm(raw);
  if (SUBSCRIBED.has(v)) return "subscribed";
  if (PENDING.has(v)) return "pending";
  return "unsubscribed";
}

/** Offset von Europe/Berlin in Minuten für einen UTC-Zeitpunkt (Sommer-/Winterzeit). */
function berlinOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utcMs) / 60000);
}

/**
 * Zeitstempel lesen: ISO 8601 (mit oder ohne Zone), Shopify "2025-05-01 08:00:00 +0200",
 * deutsch "01.05.2025 08:00". Ohne Zonenangabe gilt Europe/Berlin. Ungültig oder in der Zukunft: null.
 */
export function parseConsentTimestamp(raw: string, now: Date = new Date()): string | null {
  const v = raw.trim();
  if (!v) return null;
  let ms: number | null = null;
  const de = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const isoLocal = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  const shopify = v.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?\s*([+-])(\d{2}):?(\d{2})$/,
  );
  const local = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    return guess - berlinOffsetMinutes(guess) * 60000;
  };
  if (de) {
    ms = local(+de[3], +de[2], +de[1], +(de[4] ?? 0), +(de[5] ?? 0), +(de[6] ?? 0));
  } else if (shopify) {
    const sign = shopify[7] === "-" ? -1 : 1;
    const offset = sign * (+shopify[8] * 60 + +shopify[9]);
    ms =
      Date.UTC(
        +shopify[1],
        +shopify[2] - 1,
        +shopify[3],
        +shopify[4],
        +shopify[5],
        +(shopify[6] ?? 0),
      ) -
      offset * 60000;
  } else if (isoLocal) {
    ms = local(
      +isoLocal[1],
      +isoLocal[2],
      +isoLocal[3],
      +(isoLocal[4] ?? 0),
      +(isoLocal[5] ?? 0),
      +(isoLocal[6] ?? 0),
    );
  } else if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(v)) {
    const parsed = Date.parse(v);
    ms = Number.isNaN(parsed) ? null : parsed;
  }
  if (ms === null || Number.isNaN(ms)) return null;
  if (ms > now.getTime() + 5 * 60000) return null;
  if (ms < Date.UTC(2000, 0, 1)) return null;
  return new Date(ms).toISOString();
}

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

export function prepareNewsletterImport(text: string, now: Date = new Date()): ImportPreparation {
  const rows = parseCsv(text);
  const empty: ImportPreparation = {
    rows: [],
    errors: [],
    duplicates: 0,
    columns: { email: null, firstName: null, status: null, consent: null },
    summary: { total: 0, subscribed: 0, pending: 0, unsubscribed: 0 },
  };
  if (rows.length === 0) return { ...empty, errors: [{ line: 1, message: "Die Datei ist leer." }] };
  const headers = rows[0];
  const col = {
    email: findColumn(headers, ALIASES.email),
    firstName: findColumn(headers, ALIASES.firstName),
    status: findColumn(headers, ALIASES.status),
    consent: findColumn(headers, ALIASES.consent),
  };
  const columns = {
    email: col.email >= 0 ? headers[col.email].trim() : null,
    firstName: col.firstName >= 0 ? headers[col.firstName].trim() : null,
    status: col.status >= 0 ? headers[col.status].trim() : null,
    consent: col.consent >= 0 ? headers[col.consent].trim() : null,
  };
  if (col.email < 0)
    return { ...empty, columns, errors: [{ line: 1, message: "Spalte „E-Mail“ fehlt." }] };
  if (col.status < 0)
    return { ...empty, columns, errors: [{ line: 1, message: "Spalte „Status“ fehlt." }] };

  const out: ImportRow[] = [];
  const errors: ImportPreparation["errors"] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const email = (cells[col.email] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.push({ line, message: `Ungültige E-Mail-Adresse: ${email || "(leer)"}` });
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);
    const rawStatus = normalizeImportStatus(cells[col.status] ?? "");
    const consentRaw = col.consent >= 0 ? (cells[col.consent] ?? "") : "";
    const consentAt = parseConsentTimestamp(consentRaw, now);
    const issues: string[] = [];
    let status: ImportStatus = rawStatus;
    if (rawStatus === "subscribed" && !consentAt) {
      status = "pending";
      issues.push(
        consentRaw.trim()
          ? "Einwilligungszeitpunkt ungültig, nicht versandfähig"
          : "Kein Einwilligungszeitpunkt, nicht versandfähig",
      );
    }
    const firstName =
      col.firstName >= 0 ? (cells[col.firstName] ?? "").trim().slice(0, 80) || null : null;
    out.push({
      line,
      email,
      firstName,
      status,
      consentAt: status === "subscribed" ? consentAt : null,
      sendable: status === "subscribed",
      issues,
    });
  });
  const summary = {
    total: out.length,
    subscribed: out.filter((r) => r.status === "subscribed").length,
    pending: out.filter((r) => r.status === "pending").length,
    unsubscribed: out.filter((r) => r.status === "unsubscribed").length,
  };
  return { rows: out, errors, duplicates, columns, summary };
}

export interface ExistingContact {
  status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained";
  confirmed_at: string | null;
}

export type MergeDecision =
  | { action: "insert"; values: ContactValues }
  | { action: "update"; values: ContactValues }
  | { action: "skip"; reason: string };

export interface ContactValues {
  email: string;
  first_name: string | null;
  status: ImportStatus;
  source: "import_shopify";
  confirmed_at: string | null;
  imported_consent_at: string | null;
  unsubscribed_at: string | null;
}

/** Entscheidet je Zeile, ob angelegt, aktualisiert oder übersprungen wird. */
export function mergeImportRow(
  existing: ExistingContact | null,
  row: ImportRow,
  now: string,
): MergeDecision {
  const values: ContactValues = {
    email: row.email,
    first_name: row.firstName,
    status: row.status,
    source: "import_shopify",
    confirmed_at: row.status === "subscribed" ? row.consentAt : null,
    imported_consent_at: row.status === "subscribed" ? row.consentAt : null,
    unsubscribed_at: row.status === "unsubscribed" ? now : null,
  };
  if (!existing) return { action: "insert", values };
  if (
    existing.status === "unsubscribed" ||
    existing.status === "bounced" ||
    existing.status === "complained"
  )
    return { action: "skip", reason: "Abgemeldet oder gesperrt, bleibt unverändert" };
  if (existing.status === "subscribed") return { action: "skip", reason: "Bereits abonniert" };
  // existing pending
  if (row.status === "subscribed") return { action: "update", values };
  return { action: "skip", reason: "Bleibt unbestätigt" };
}
