/**
 * Gemeinsamer Ablauf aller Importskripte: Argumente lesen, Datei laden und hashen, Verbindung
 * nach Schutzregeln öffnen, Lauf in import_runs eröffnen (nur --apply), Import ausführen,
 * Bericht ausgeben und speichern.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import { parseArgs, type CommonArgs } from "./args";
import { loadTable, type LoadedFile } from "./csv";
import { connect, finishRun, resolveConnection, startRun, type ImportKind } from "./db";
import { Report } from "./report";
import { errorMessage } from "./values";

export interface ImportContext {
  db: Client;
  runId: string | null;
  args: CommonArgs;
  file: LoadedFile;
  extraFiles: LoadedFile[];
  report: Report;
  /** Zeitpunkt des Laufs in UTC (für acquisition_details, Statuslogik) */
  now: Date;
  /** true bei lokaler Datenbank, false nur mit --remote und Backup */
  isLocal: boolean;
}

export interface ImportDefinition {
  kind: ImportKind;
  usage: string;
  /** Optionen mit weiteren Dateien (z.B. --subscribers) */
  extraFileOptions?: string[];
  execute: (ctx: ImportContext) => Promise<void>;
}

export async function runImport(
  def: ImportDefinition,
  argv = process.argv.slice(2),
): Promise<void> {
  let args: CommonArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`${errorMessage(error)}\n\n${def.usage}`);
    process.exitCode = 1;
    return;
  }

  let file: LoadedFile;
  let extraFiles: LoadedFile[];
  let choice: ReturnType<typeof resolveConnection>;
  let db: Client;
  try {
    file = loadTable(args.file);
    extraFiles = (def.extraFileOptions ?? [])
      .map((opt) => args.values.get(opt))
      .filter((p): p is string => Boolean(p))
      .map((p) => loadTable(p));
    choice = resolveConnection(process.env, { remote: args.remote, backup: args.backup });
    db = await connect(choice);
  } catch (error) {
    console.error(`Abbruch: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }
  const report = new Report(def.kind, args.apply ? "apply" : "dry_run");
  report.inputLines =
    file.table.rows.length + extraFiles.reduce((n, f) => n + f.table.rows.length, 0);

  const target = choice.isLocal ? "lokal" : "REMOTE";
  console.log(
    `Import ${def.kind}: ${file.name} (sha256 ${file.sha256.slice(0, 12)}…), Ziel ${target}`,
  );

  let runId: string | null = null;
  try {
    if (args.apply) {
      const started = await startRun(db, {
        kind: def.kind,
        file,
        extraFiles: extraFiles.map((f) => ({ name: f.name, sha256: f.sha256 })),
        options: {
          flags: [...args.flags].sort(),
          batch_size: args.batchSize,
          target,
        },
        rowsTotal: report.inputLines,
      });
      runId = started.runId;
      if (started.previous.length > 0) {
        report.note(
          `Hinweis: Diese Datei wurde schon ${started.previous.length}x angewendet (zuletzt ${new Date(started.previous.at(-1)!.started_at).toISOString()}). Bereits importierte Datensätze werden übersprungen oder abgeglichen.`,
        );
      }
    }
    await def.execute({
      db,
      runId,
      args,
      file,
      extraFiles,
      report,
      now: new Date(),
      isLocal: choice.isLocal,
    });
    if (runId) {
      await finishRun(db, runId, report, "completed");
      report.note(`Lauf protokolliert: import_runs.id = ${runId}`);
    }
  } catch (error) {
    if (runId) await finishRun(db, runId, report, "failed", errorMessage(error)).catch(() => {});
    console.error(report.format());
    console.error(`\nAbbruch: ${errorMessage(error)}`);
    process.exitCode = 1;
    await db.end();
    return;
  }
  await db.end();

  console.log(report.format());
  if (args.report) {
    mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    writeFileSync(
      args.report,
      JSON.stringify({ file: file.name, sha256: file.sha256, runId, ...report.toJSON() }, null, 2),
    );
    console.log(`Bericht gespeichert: ${args.report}`);
  }
  if (!args.apply)
    console.log("\nProbelauf beendet, nichts gespeichert. Zum Schreiben --apply anhängen.");
}

/** Standard-Ausgabeordner für Listen mit Personendaten (gitignoriert). */
export function outputDir(args: CommonArgs): string {
  const dir = path.resolve(args.values.get("out") ?? path.join(import.meta.dirname, "..", "out"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function timestampForFile(now: Date): string {
  return now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/-\d{3}Z$/, "Z");
}
