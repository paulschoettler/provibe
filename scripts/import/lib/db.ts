/**
 * Datenbankzugang der Importskripte: direkte PostgreSQL-Verbindung per `pg` (docs/import.md,
 * Abschnitt "Technik"). Grund: echte Transaktionen je 200 Datensätze mit Savepoint je Zeile,
 * was der Supabase-REST-Client nicht kann. Die Verbindung läuft als Datenbank-Eigentümer und
 * umgeht RLS wie der Service-Role-Client.
 *
 * Schutz: Standard ist die lokale Datenbank (scripts/db/local-pg.sh). Jede andere Adresse
 * braucht --remote UND --backup <pg_dump-Datei, höchstens 24 Stunden alt>. .env.local wird
 * bewusst NICHT geladen, damit kein Live-Zugang versehentlich greift.
 */
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import { Client } from "pg";
import type { Report } from "./report";
import { errorMessage } from "./values";

export const LOCAL_DATABASE_URL = "postgres://postgres@localhost:54329/provibe";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);
const BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ConnectionChoice {
  url: string;
  isLocal: boolean;
}

export function isLocalUrl(url: string): boolean {
  const parsed = new URL(url);
  const hostParam = parsed.searchParams.get("host");
  if (hostParam?.startsWith("/")) return true; // Unix-Socket
  return LOCAL_HOSTS.has(parsed.hostname);
}

/** Wählt die Datenbank und prüft die Schutzregeln (CLAUDE.md, Schutzregeln für die Live-Instanz). */
export function resolveConnection(
  env: Record<string, string | undefined>,
  opts: { remote: boolean; backup: string | null },
  now = Date.now(),
): ConnectionChoice {
  const url = env.DATABASE_URL || LOCAL_DATABASE_URL;
  const isLocal = isLocalUrl(url);
  if (isLocal) return { url, isLocal };
  if (!opts.remote) {
    throw new Error(
      "DATABASE_URL zeigt nicht auf localhost. Importe laufen nur lokal, außer mit --remote und --backup (siehe docs/import.md).",
    );
  }
  if (!opts.backup || !existsSync(opts.backup)) {
    throw new Error(
      "--remote braucht --backup <pfad> zu einem aktuellen pg_dump der Zieldatenbank.",
    );
  }
  const stat = statSync(opts.backup);
  if (stat.size === 0 || now - stat.mtimeMs > BACKUP_MAX_AGE_MS) {
    throw new Error("Backup ist leer oder älter als 24 Stunden. Bitte vor dem Lauf neu ziehen.");
  }
  return { url, isLocal };
}

export async function connect(choice: ConnectionChoice): Promise<Client> {
  const client = new Client({
    connectionString: choice.url,
    ssl: choice.isLocal ? undefined : { rejectUnauthorized: true },
    application_name: "provibe-import",
  });
  await client.connect();
  await client.query("set search_path = public, extensions");
  // Alle Zeitstempel in UTC lesen und schreiben
  await client.query("set time zone 'UTC'");
  return client;
}

export type Db = Pick<Client, "query">;

/**
 * Verarbeitet Datensätze in Transaktionen. Jede Zeile läuft in einem Savepoint: ein Fehler
 * verwirft nur diese Zeile. apply: COMMIT je Block. Probelauf: eine einzige Transaktion über
 * alle Blöcke (damit spätere Zeilen frühere sehen), am Ende ROLLBACK.
 */
export async function runInBatches<T>(
  db: Db,
  items: T[],
  opts: { apply: boolean; batchSize: number },
  handle: (item: T) => Promise<void>,
  onError: (item: T, message: string) => void,
): Promise<void> {
  if (!opts.apply) await db.query("begin");
  try {
    for (let start = 0; start < items.length; start += opts.batchSize) {
      const chunk = items.slice(start, start + opts.batchSize);
      if (opts.apply) await db.query("begin");
      try {
        for (const item of chunk) {
          await db.query("savepoint import_row");
          try {
            await handle(item);
            await db.query("release savepoint import_row");
          } catch (error) {
            await db.query("rollback to savepoint import_row");
            onError(item, errorMessage(error));
          }
        }
        if (opts.apply) await db.query("commit");
      } catch (error) {
        if (opts.apply) await db.query("rollback");
        throw error;
      }
    }
  } finally {
    if (!opts.apply) await db.query("rollback");
  }
}

// --- Protokoll in import_runs -------------------------------------------------------------------

export type ImportKind = "customers" | "orders" | "discounts" | "newsletter";
export type EntityType =
  | "customers"
  | "customer_addresses"
  | "customer_notes"
  | "orders"
  | "discount_codes"
  | "newsletter_contacts";

export interface RunContext {
  db: Db;
  /** null im Probelauf: dann wird nichts protokolliert */
  runId: string | null;
}

export async function startRun(
  db: Db,
  input: {
    kind: ImportKind;
    file: { name: string; sha256: string };
    extraFiles?: { name: string; sha256: string }[];
    options: Record<string, unknown>;
    rowsTotal: number;
  },
): Promise<{ runId: string; previous: { id: string; started_at: string }[] }> {
  const previous = await db.query<{ id: string; started_at: string }>(
    `select id, started_at from public.import_runs
     where kind = $1 and file_sha256 = $2 and status = 'completed' order by started_at`,
    [input.kind, input.file.sha256],
  );
  const res = await db.query<{ id: string }>(
    `insert into public.import_runs (kind, file_name, file_sha256, extra_files, options, rows_total, started_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      input.kind,
      input.file.name,
      input.file.sha256,
      JSON.stringify(input.extraFiles ?? []),
      JSON.stringify(input.options),
      input.rowsTotal,
      `${os.userInfo().username}@${os.hostname()}`,
    ],
  );
  return { runId: res.rows[0].id, previous: previous.rows };
}

export async function finishRun(
  db: Db,
  runId: string,
  report: Report,
  status: "completed" | "failed",
  failure?: string,
): Promise<void> {
  const c = report.counts();
  const result = { ...report.toJSON(), ...(failure ? { failure } : {}) };
  await db.query(
    `update public.import_runs set status = $2, created_count = $3, updated_count = $4,
       skipped_count = $5, error_count = $6, unchanged_count = $7, result = $8, finished_at = now()
     where id = $1`,
    [runId, status, c.created, c.updated, c.skipped, c.error, c.unchanged, JSON.stringify(result)],
  );
}

/** Vermerkt eine angelegte oder geänderte Zeile für den Rückweg (rollback.ts). */
export async function recordItem(
  ctx: RunContext,
  entityType: EntityType,
  entityId: string,
  action: "created" | "updated",
  line: number,
  before?: unknown,
): Promise<void> {
  if (!ctx.runId) return;
  await ctx.db.query(
    `insert into public.import_run_items (run_id, entity_type, entity_id, action, before, source_line)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      ctx.runId,
      entityType,
      entityId,
      action,
      before === undefined ? null : JSON.stringify(before),
      line,
    ],
  );
}
