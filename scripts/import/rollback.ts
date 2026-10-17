/**
 * Rückweg für einen Importlauf (docs/import.md, Abschnitt "Rückweg").
 *
 *   pnpm import:rollback -- --run <import_runs.id>            Probelauf: zeigt, was passieren würde
 *   pnpm import:rollback -- --run <import_runs.id> --apply    nimmt den Lauf zurück
 *
 * Angelegte Zeilen werden gelöscht (Bestellungen samt Positionen, Ereignissen, Einlösungen),
 * geänderte Zeilen bekommen ihren Vorzustand aus import_run_items.before zurück. Alles in einer
 * Transaktion, in umgekehrter Reihenfolge. Kunden mit inzwischen aktiviertem Login oder eigenen
 * Bestellungen aus dem neuen Shop bleiben stehen (Hinweis im Bericht).
 *
 * Auf der Live-Datenbank ist das ein destruktiver Befehl: nur mit ausdrücklicher Freigabe des
 * Auftraggebers und frischem Backup (CLAUDE.md, Schutzregeln).
 */
import { parseArgs } from "./lib/args";
import { connect, resolveConnection, type EntityType } from "./lib/db";
import { errorMessage } from "./lib/values";

const USAGE = `Verwendung:
  pnpm import:rollback -- --run <import_runs.id> [--apply] [--force] [--remote --backup <pg_dump>]`;

const TABLES: Record<EntityType, string> = {
  customers: "public.customers",
  customer_addresses: "public.customer_addresses",
  customer_notes: "public.customer_notes",
  orders: "public.orders",
  discount_codes: "public.discount_codes",
  newsletter_contacts: "public.newsletter_contacts",
};

interface RunItem {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  action: "created" | "updated";
  before: Record<string, unknown> | null;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2), { requireFile: false });
  } catch (error) {
    console.error(`${errorMessage(error)}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }
  const runId = args.values.get("run");
  if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) {
    console.error(`--run <uuid> fehlt\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  let choice: ReturnType<typeof resolveConnection>;
  let db: Awaited<ReturnType<typeof connect>>;
  try {
    choice = resolveConnection(process.env, { remote: args.remote, backup: args.backup });
    db = await connect(choice);
  } catch (error) {
    console.error(`Abbruch: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }
  const log: string[] = [];
  const counts = { deleted: 0, restored: 0, kept: 0 };
  try {
    const run = (
      await db.query<{
        id: string;
        kind: string;
        status: string;
        file_name: string;
        started_at: Date;
      }>(`select id, kind, status, file_name, started_at from public.import_runs where id = $1`, [
        runId,
      ])
    ).rows[0];
    if (!run) throw new Error(`Lauf ${runId} nicht gefunden`);
    if (run.status === "rolled_back") throw new Error("Lauf wurde bereits zurückgenommen");
    console.log(
      `Rückweg für Lauf ${run.id} (${run.kind}, ${run.file_name}, ${run.started_at.toISOString()}), Ziel ${choice.isLocal ? "lokal" : "REMOTE"}`,
    );

    // Spätere Läufe, die dieselben Zeilen geändert haben, zuerst zurücknehmen
    const later = await db.query<{ run_id: string }>(
      `select distinct l.run_id from public.import_run_items i
       join public.import_run_items l on l.entity_type = i.entity_type and l.entity_id = i.entity_id and l.id > i.id
       join public.import_runs r on r.id = l.run_id and r.status <> 'rolled_back'
       where i.run_id = $1 and l.run_id <> $1`,
      [runId],
    );
    if (later.rowCount && !args.flags.has("force")) {
      throw new Error(
        `Spätere Läufe haben dieselben Datensätze geändert: ${later.rows.map((r) => r.run_id).join(", ")}. Erst diese zurücknehmen oder --force.`,
      );
    }

    const items = (
      await db.query<RunItem>(
        `select id::text, entity_type, entity_id, action, before from public.import_run_items where run_id = $1 order by id desc`,
        [runId],
      )
    ).rows;

    await db.query("begin");
    const touchedCustomers = new Set<string>();
    // Neu angelegte Kunden, die inzwischen ein Login oder eigene Bestellungen haben, bleiben samt Adressen und Notizen
    const keptCustomers = new Set<string>();
    const createdCustomerIds = items
      .filter((i) => i.action === "created" && i.entity_type === "customers")
      .map((i) => i.entity_id);
    if (createdCustomerIds.length > 0) {
      const guard = await db.query<{ id: string }>(
        `select c.id from public.customers c
         where c.id = any($1::uuid[])
           and (c.auth_user_id is not null
                or exists (select 1 from public.orders o where o.customer_id = c.id and o.source <> 'import_shopify'))`,
        [createdCustomerIds],
      );
      for (const r of guard.rows) {
        keptCustomers.add(r.id);
        log.push(`Kunde ${r.id} bleibt (Login aktiviert oder Bestellungen im neuen Shop)`);
      }
      // Importierte Bestellungen verlören sonst ihre Kundenzuordnung: erst den Bestellungs-Lauf zurücknehmen
      const imported = await db.query<{ n: number }>(
        `select count(*)::int as n from public.orders where customer_id = any($1::uuid[]) and source = 'import_shopify'`,
        [createdCustomerIds.filter((id) => !keptCustomers.has(id))],
      );
      if (imported.rows[0].n > 0 && !args.flags.has("force")) {
        throw new Error(
          `${imported.rows[0].n} importierte Bestellungen hängen an diesen Kunden. Erst den Bestellungs-Lauf zurücknehmen (Reihenfolge: Newsletter, Bestellungen, Rabatte, Kunden) oder --force.`,
        );
      }
    }
    for (const item of items) {
      const table = TABLES[item.entity_type];
      if (!table) throw new Error(`Unbekannter Typ ${item.entity_type}`);
      if (item.action === "created") {
        if (item.entity_type === "customers" && keptCustomers.has(item.entity_id)) {
          counts.kept++;
          continue;
        }
        if (item.entity_type === "customer_addresses" || item.entity_type === "customer_notes") {
          const owner = await db.query<{ customer_id: string }>(
            `select customer_id from ${table} where id = $1`,
            [item.entity_id],
          );
          if (owner.rows[0] && keptCustomers.has(owner.rows[0].customer_id)) {
            counts.kept++;
            continue;
          }
        }
        if (item.entity_type === "orders") {
          const c = await db.query<{ customer_id: string | null }>(
            `select customer_id from public.orders where id = $1`,
            [item.entity_id],
          );
          if (c.rows[0]?.customer_id) touchedCustomers.add(c.rows[0].customer_id);
        }
        const res = await db.query(`delete from ${table} where id = $1`, [item.entity_id]);
        counts.deleted += res.rowCount ?? 0;
      } else {
        if (!item.before) {
          log.push(
            `${item.entity_type} ${item.entity_id}: kein Vorzustand gespeichert, übersprungen`,
          );
          counts.kept++;
          continue;
        }
        const cols = (
          await db.query<{ column_name: string }>(
            `select column_name from information_schema.columns
             where table_schema = 'public' and table_name = $1 and column_name not in ('id', 'created_at')
               and is_generated = 'NEVER' and column_name = any($2::text[])`,
            [item.entity_type, Object.keys(item.before)],
          )
        ).rows.map((r) => r.column_name);
        const set = cols.map((c) => `"${c}" = r."${c}"`).join(", ");
        const res = await db.query(
          `update ${table} t set ${set} from jsonb_populate_record(null::${table}, $2::jsonb) r where t.id = $1`,
          [item.entity_id, JSON.stringify(item.before)],
        );
        counts.restored += res.rowCount ?? 0;
      }
    }

    // Kundenkennzahlen nach gelöschten Bestellungen neu rechnen (gleiche Regel wie refresh_customer_stats)
    for (const customerId of touchedCustomers) {
      await db.query(
        `update public.customers c set orders_count = s.cnt, total_spent_cents = s.total, first_order_at = s.first_at, last_order_at = s.last_at
         from (select count(*) as cnt, coalesce(sum(total_cents), 0) as total, min(placed_at) as first_at, max(placed_at) as last_at
               from public.orders where customer_id = $1
                 and payment_status in ('paid', 'partially_refunded') and status <> 'cancelled' and not is_test) s
         where c.id = $1`,
        [customerId],
      );
    }

    const result = { ...counts, notes: log, at: new Date().toISOString() };
    if (args.apply) {
      await db.query(
        `update public.import_runs set status = 'rolled_back', rolled_back_at = now(), rollback_result = $2 where id = $1`,
        [runId, JSON.stringify(result)],
      );
      await db.query("commit");
    } else {
      await db.query("rollback");
    }
    console.log(
      `Gelöscht: ${counts.deleted}, Vorzustand wiederhergestellt: ${counts.restored}, stehen gelassen: ${counts.kept}`,
    );
    for (const l of log) console.log(`  ${l}`);
    console.log(
      args.apply
        ? "Lauf zurückgenommen."
        : "\nProbelauf, nichts geändert. Zum Ausführen --apply anhängen.",
    );
  } catch (error) {
    await db.query("rollback").catch(() => {});
    console.error(`Abbruch: ${errorMessage(error)}`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

void main();
