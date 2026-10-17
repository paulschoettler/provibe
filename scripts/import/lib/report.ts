/**
 * Bericht eines Importlaufs: Ergebnis je Datensatz (angelegt, aktualisiert, unverändert,
 * übersprungen, Fehler) mit Grund und Hinweisen, Zusatzzahlen je Importart.
 */
import { maskEmail } from "./values";

export type RowStatus = "created" | "updated" | "unchanged" | "skipped" | "error";

export interface RowResult {
  /** Zeile(n) in der Datei, bei Bestellungen die erste Zeile der Bestellung */
  line: number;
  /** Fachlicher Schlüssel: E-Mail, Bestellnummer, Code */
  key: string;
  status: RowStatus;
  reason?: string;
  warnings?: string[];
}

export const STATUS_LABEL: Record<RowStatus, string> = {
  created: "angelegt",
  updated: "aktualisiert",
  unchanged: "unverändert",
  skipped: "übersprungen",
  error: "Fehler",
};

export class Report {
  readonly results: RowResult[] = [];
  readonly notes: string[] = [];
  /** Zusatzzahlen, z.B. "Positionen ohne Variante" oder Newsletter-Status */
  readonly extra: Record<string, number> = {};
  /** Anzahl Dateizeilen (ohne Kopfzeile) */
  inputLines = 0;

  constructor(
    readonly kind: string,
    readonly mode: "dry_run" | "apply",
  ) {}

  add(result: RowResult) {
    this.results.push(result);
  }

  bump(key: string, by = 1) {
    this.extra[key] = (this.extra[key] ?? 0) + by;
  }

  note(text: string) {
    this.notes.push(text);
  }

  counts(): Record<RowStatus, number> {
    const c: Record<RowStatus, number> = {
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      error: 0,
    };
    for (const r of this.results) c[r.status]++;
    return c;
  }

  toJSON() {
    return {
      kind: this.kind,
      mode: this.mode,
      input_lines: this.inputLines,
      records: this.results.length,
      counts: this.counts(),
      extra: this.extra,
      notes: this.notes,
      rows: this.results.filter((r) => r.status !== "created" || r.warnings?.length),
    };
  }

  /** Lesbarer Bericht für die Konsole. E-Mail-Adressen werden gekürzt. */
  format(): string {
    const c = this.counts();
    const out: string[] = [];
    const title = this.mode === "apply" ? "ANWENDUNG" : "PROBELAUF (nichts gespeichert)";
    out.push(`\n=== Import ${this.kind}: ${title} ===`);
    out.push(`Dateizeilen: ${this.inputLines}, Datensätze: ${this.results.length}`);
    out.push((Object.keys(c) as RowStatus[]).map((s) => `${STATUS_LABEL[s]}: ${c[s]}`).join(" | "));
    for (const [k, v] of Object.entries(this.extra)) out.push(`  ${k}: ${v}`);
    const show = (key: string) => (key.includes("@") ? maskEmail(key) : key);
    const problems = this.results.filter((r) => r.status === "error" || r.status === "skipped");
    if (problems.length > 0) {
      out.push("\nFehler und übersprungene Datensätze:");
      for (const r of problems) {
        out.push(`  Zeile ${r.line} [${show(r.key)}] ${STATUS_LABEL[r.status]}: ${r.reason ?? ""}`);
      }
    }
    const warned = this.results.filter((r) => r.warnings && r.warnings.length > 0);
    if (warned.length > 0) {
      out.push("\nHinweise:");
      for (const r of warned) {
        for (const w of r.warnings!) out.push(`  Zeile ${r.line} [${show(r.key)}]: ${w}`);
      }
    }
    if (this.notes.length > 0) {
      out.push("");
      for (const n of this.notes) out.push(n);
    }
    return out.join("\n");
  }
}
