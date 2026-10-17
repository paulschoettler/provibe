/**
 * Gemeinsame Kommandozeilen-Optionen der Importskripte.
 *   --file <pfad>          Exportdatei (CSV, bei Rabatten auch JSON)
 *   --dry-run              Probelauf (Standard): rechnet alles in einer Transaktion durch und rollt zurück
 *   --apply                schreibt (Transaktion je 200 Datensätze) und protokolliert in import_runs
 *   --batch-size <n>       Datensätze je Transaktion (Standard 200)
 *   --report <pfad>        Bericht zusätzlich als JSON speichern
 *   --remote --backup <pfad>  nur für die Live-Datenbank nach dem Go-live-Plan (docs/import.md)
 */
export interface CommonArgs {
  file: string;
  apply: boolean;
  batchSize: number;
  report: string | null;
  remote: boolean;
  backup: string | null;
  flags: Set<string>;
  values: Map<string, string>;
}

const VALUE_OPTIONS = new Set([
  "file",
  "batch-size",
  "report",
  "backup",
  "out",
  "rate",
  "subscribers",
  "run",
  "limit",
]);

export function parseArgs(argv: string[], { requireFile = true } = {}): CommonArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue; // pnpm reicht "--" teilweise durch
    if (!arg.startsWith("--")) throw new Error(`Unbekanntes Argument: ${arg}`);
    const [name, inline] = arg.slice(2).split("=", 2);
    if (VALUE_OPTIONS.has(name)) {
      const value = inline ?? argv[++i];
      if (value === undefined || value.startsWith("--"))
        throw new Error(`--${name} braucht einen Wert`);
      values.set(name, value);
    } else {
      flags.add(name);
    }
  }
  if (flags.has("apply") && flags.has("dry-run")) {
    throw new Error("--apply und --dry-run schließen sich aus");
  }
  const file = values.get("file") ?? "";
  if (requireFile && !file) throw new Error("--file <pfad> fehlt");
  const batchSize = Number(values.get("batch-size") ?? 200);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("--batch-size muss zwischen 1 und 1000 liegen");
  }
  return {
    file,
    apply: flags.has("apply"),
    batchSize,
    report: values.get("report") ?? null,
    remote: flags.has("remote"),
    backup: values.get("backup") ?? null,
    flags,
    values,
  };
}
