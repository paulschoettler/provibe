/**
 * Import Shopify-Kunden (docs/import.md, Schritt 1).
 *
 *   pnpm import:customers -- --file kunden.csv              Probelauf mit Bericht
 *   pnpm import:customers -- --file kunden.csv --apply      schreiben, Protokoll in import_runs
 *   ... --apply --send-activation [--rate 20] [--limit n] [--resend]
 *
 * Legt Kunden an oder gleicht sie ab (zuerst über shopify_customer_id, dann über die E-Mail),
 * übernimmt die Standardadresse, Tags und die Shopify-Notiz. Kein Auth-Benutzer: Die Liste der
 * zu aktivierenden Konten landet als CSV in scripts/import/out/ (gitignoriert).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { sendActivationMails, allowlistEnv, type ActivationCandidate } from "./lib/activation";
import { toCsv } from "./lib/csv";
import { recordItem, runInBatches, type RunContext } from "./lib/db";
import { outputDir, runImport, timestampForFile, type ImportContext } from "./lib/run";
import { hasColumn } from "./lib/values";
import { isEmailAllowlisted } from "@/lib/env/allowlist";
import {
  ACQUISITION_SOURCE,
  CUSTOMER_COLUMNS,
  mapCustomerRow,
  mergeTags,
  sameAddress,
  type MappedAddress,
  type MappedCustomer,
} from "./map/customers";

const USAGE = `Verwendung:
  pnpm import:customers -- --file <customers_export.csv> [--dry-run | --apply]
      [--send-activation [--rate <pro Minute, Standard 20>] [--limit <n>] [--resend]]
      [--out <ordner>] [--report <bericht.json>] [--batch-size 200]`;

interface Item {
  line: number;
  customer: MappedCustomer;
}

interface CustomerRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  tags: string[];
  acquisition_source: string | null;
  acquisition_details: Record<string, unknown>;
  shopify_customer_id: string | null;
  auth_user_id: string | null;
  anonymized_at: string | null;
  activation_email_sent_at: string | null;
}

interface ActivationRow extends ActivationCandidate {
  lastName: string | null;
  shopifyCustomerId: string | null;
  isNew: boolean;
}

async function execute(ctx: ImportContext): Promise<void> {
  const { file, report, args } = ctx;
  if (!hasColumn(file.table.headers, CUSTOMER_COLUMNS.email)) {
    throw new Error('Spalte "Email" fehlt. Ist das der Kunden-Export aus Shopify?');
  }
  if (!hasColumn(file.table.headers, CUSTOMER_COLUMNS.shopifyId)) {
    report.note(
      'Hinweis: Spalte "Customer ID" fehlt (älteres Exportformat). Abgleich nur über die E-Mail.',
    );
  }

  const items: Item[] = [];
  const seenEmail = new Map<string, number>();
  const seenId = new Map<string, number>();
  for (const { line, data } of file.table.rows) {
    const mapped = mapCustomerRow(data);
    const key = data["Email"] || data["E-Mail"] || `Zeile ${line}`;
    if (!mapped.ok) {
      report.add({ line, key, status: mapped.skip ? "skipped" : "error", reason: mapped.reason });
      continue;
    }
    const c = mapped.value;
    const dupe =
      seenEmail.get(c.email) ?? (c.shopifyCustomerId ? seenId.get(c.shopifyCustomerId) : undefined);
    if (dupe !== undefined) {
      report.add({
        line,
        key: c.email,
        status: "error",
        reason: `doppelt in der Datei (wie Zeile ${dupe})`,
      });
      continue;
    }
    seenEmail.set(c.email, line);
    if (c.shopifyCustomerId) seenId.set(c.shopifyCustomerId, line);
    items.push({ line, customer: c });
  }

  const rc: RunContext = { db: ctx.db, runId: ctx.runId };
  const activation: ActivationRow[] = [];
  const nowIso = ctx.now.toISOString();

  await runInBatches(
    ctx.db,
    items,
    { apply: args.apply, batchSize: args.batchSize },
    async (item) => {
      const result = await upsertCustomer(rc, item, nowIso);
      report.add({
        line: item.line,
        key: item.customer.email,
        status: result.status,
        reason: result.reason,
        warnings: [...item.customer.warnings, ...result.warnings],
      });
      if (result.activation) activation.push(result.activation);
    },
    (item, message) =>
      report.add({ line: item.line, key: item.customer.email, status: "error", reason: message }),
  );

  const allow = allowlistEnv(process.env);
  report.bump("Konten zu aktivieren (ohne Login)", activation.length);

  if (args.flags.has("send-activation")) {
    if (!args.apply) {
      report.note(
        "--send-activation wirkt nur zusammen mit --apply. Im Probelauf wurde nichts versendet.",
      );
    } else {
      const rate = Number(args.values.get("rate") ?? 20);
      const limit = args.values.has("limit") ? Number(args.values.get("limit")) : null;
      const outcome = await sendActivationMails(ctx.db, activation, {
        ratePerMinute: Number.isFinite(rate) && rate > 0 ? Math.min(rate, 120) : 20,
        resend: args.flags.has("resend"),
        limit: limit !== null && Number.isInteger(limit) && limit > 0 ? limit : null,
      });
      for (const a of activation) {
        const sentAt = outcome.sentAt.get(a.customerId);
        if (sentAt) a.activationEmailSentAt = sentAt;
      }
      report.bump("Aktivierungsmails gesendet", outcome.sent);
      report.bump("Aktivierungsmails blockiert (nicht auf Allowlist)", outcome.blockedAllowlist);
      report.bump("Aktivierungsmails übersprungen (schon gesendet)", outcome.alreadySent);
      report.bump("Aktivierungsmails fehlgeschlagen", outcome.failed.length);
      report.note(
        `Aktivierung: Vorlage "Konto aktivieren (Massenversand)", Link auf ${outcome.activationPage}?email=…, Provider ${allow.APP_INTEGRATIONS}.`,
      );
      for (const f of outcome.failed) report.note(`  Versand fehlgeschlagen: ${f.reason}`);
    }
  }

  // Aktivierungsliste (auch im Probelauf, dann ohne Kunden-ID für neue Kunden)
  if (activation.length > 0) {
    const target = path.join(
      outputDir(args),
      `aktivierung-${args.apply ? "apply" : "probelauf"}-${timestampForFile(ctx.now)}.csv`,
    );
    writeFileSync(
      target,
      toCsv(
        [
          "customer_id",
          "email",
          "first_name",
          "last_name",
          "shopify_customer_id",
          "neu",
          "auf_allowlist",
          "aktivierung_gesendet_am",
        ],
        activation.map((a) => [
          a.isNew && !args.apply ? "" : a.customerId,
          a.email,
          a.firstName,
          a.lastName,
          a.shopifyCustomerId,
          a.isNew ? "ja" : "nein",
          isEmailAllowlisted(a.email, allow) ? "ja" : "nein",
          a.activationEmailSentAt,
        ]),
      ),
      { mode: 0o600 },
    );
    report.note(
      `Aktivierungsliste: ${target} (enthält Personendaten, nicht weitergeben oder committen)`,
    );
  }
}

interface UpsertResult {
  status: "created" | "updated" | "unchanged" | "skipped";
  reason?: string;
  warnings: string[];
  activation?: ActivationRow;
}

const CUSTOMER_SELECT = `id, email::text as email, first_name, last_name, phone, company_name, tags, acquisition_source,
  acquisition_details, shopify_customer_id::text as shopify_customer_id, auth_user_id, anonymized_at, activation_email_sent_at`;

async function upsertCustomer(rc: RunContext, item: Item, nowIso: string): Promise<UpsertResult> {
  const { db } = rc;
  const c = item.customer;
  const warnings: string[] = [];

  let existing: CustomerRow | undefined;
  if (c.shopifyCustomerId) {
    existing = (
      await db.query<CustomerRow>(
        `select ${CUSTOMER_SELECT} from public.customers where shopify_customer_id = $1`,
        [c.shopifyCustomerId],
      )
    ).rows[0];
    if (existing && existing.email.toLowerCase() !== c.email) {
      warnings.push(
        "E-Mail weicht vom bestehenden Kunden mit derselben Shopify-ID ab, E-Mail bleibt unverändert (Login-Verknüpfung)",
      );
    }
  }
  if (!existing) {
    existing = (
      await db.query<CustomerRow>(
        `select ${CUSTOMER_SELECT} from public.customers where email = $1`,
        [c.email],
      )
    ).rows[0];
    if (
      existing?.shopify_customer_id &&
      c.shopifyCustomerId &&
      existing.shopify_customer_id !== c.shopifyCustomerId
    ) {
      throw new Error(`E-Mail gehört bereits zu Shopify-Kunde ${existing.shopify_customer_id}`);
    }
  }

  const importDetails = (runId: string | null, previous?: Record<string, unknown>) => ({
    ...c.details,
    imported_at: nowIso,
    first_imported_at: (previous?.first_imported_at as string | undefined) ?? nowIso,
    run_id: runId,
  });

  if (!existing) {
    const inserted = await db.query<{ id: string }>(
      `insert into public.customers (email, first_name, last_name, phone, company_name, tags, acquisition_source,
         acquisition_details, shopify_customer_id, orders_count, total_spent_cents, locale)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, 'de') returning id`,
      [
        c.email,
        c.firstName,
        c.lastName,
        c.phone,
        c.companyName,
        c.tags,
        ACQUISITION_SOURCE,
        JSON.stringify({ import_shopify: importDetails(rc.runId) }),
        c.shopifyCustomerId,
        c.ordersCount,
        c.totalSpentCents,
      ],
    );
    const id = inserted.rows[0].id;
    await recordItem(rc, "customers", id, "created", item.line);
    await db.query(
      `insert into public.customer_events (customer_id, kind, data) values ($1, 'imported', $2::jsonb)`,
      [
        id,
        JSON.stringify({
          source: ACQUISITION_SOURCE,
          run_id: rc.runId,
          shopify_customer_id: c.shopifyCustomerId,
        }),
      ],
    );
    if (c.address) await addAddress(rc, id, c.address, [], item.line);
    if (c.note) await addNote(rc, id, c.note, item.line);
    return {
      status: "created",
      warnings,
      activation: {
        customerId: id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        shopifyCustomerId: c.shopifyCustomerId,
        activationEmailSentAt: null,
        isNew: true,
      },
    };
  }

  if (existing.anonymized_at) {
    return {
      status: "skipped",
      reason: "Kunde wurde gelöscht beziehungsweise pseudonymisiert",
      warnings,
    };
  }

  // Abgleich: vorhandene Werte haben Vorrang (Kunde kann sie im neuen Shop schon geändert haben)
  const previousImport = (existing.acquisition_details?.import_shopify ?? undefined) as
    Record<string, unknown> | undefined;
  const next = {
    first_name: existing.first_name ?? c.firstName,
    last_name: existing.last_name ?? c.lastName,
    phone: existing.phone ?? c.phone,
    company_name: existing.company_name ?? c.companyName,
    tags: mergeTags(existing.tags ?? [], c.tags),
    acquisition_source: existing.acquisition_source ?? ACQUISITION_SOURCE,
    shopify_customer_id: existing.shopify_customer_id ?? c.shopifyCustomerId,
  };
  const comparableImport = (d?: Record<string, unknown>) => {
    if (!d) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imported_at, first_imported_at, run_id, ...rest } = d;
    return JSON.stringify(rest, Object.keys(rest).sort());
  };
  const importChanged =
    comparableImport(previousImport) !== comparableImport(c.details as Record<string, unknown>);
  const fieldsChanged =
    next.first_name !== existing.first_name ||
    next.last_name !== existing.last_name ||
    next.phone !== existing.phone ||
    next.company_name !== existing.company_name ||
    next.tags.length !== (existing.tags ?? []).length ||
    next.acquisition_source !== existing.acquisition_source ||
    next.shopify_customer_id !== existing.shopify_customer_id;

  let changed = false;
  if (fieldsChanged || importChanged) {
    const before = (
      await db.query<{ row: unknown }>(
        `select to_jsonb(c) as row from public.customers c where id = $1`,
        [existing.id],
      )
    ).rows[0].row;
    await db.query(
      `update public.customers set first_name = $2, last_name = $3, phone = $4, company_name = $5, tags = $6,
         acquisition_source = $7, shopify_customer_id = $8,
         acquisition_details = acquisition_details || jsonb_build_object('import_shopify', $9::jsonb)
       where id = $1`,
      [
        existing.id,
        next.first_name,
        next.last_name,
        next.phone,
        next.company_name,
        next.tags,
        next.acquisition_source,
        next.shopify_customer_id,
        JSON.stringify(importDetails(rc.runId, previousImport)),
      ],
    );
    await recordItem(rc, "customers", existing.id, "updated", item.line, before);
    await db.query(
      `insert into public.customer_events (customer_id, kind, data) values ($1, 'import_updated', $2::jsonb)`,
      [existing.id, JSON.stringify({ source: ACQUISITION_SOURCE, run_id: rc.runId })],
    );
    changed = true;
  }

  if (c.address) {
    const addresses = (
      await db.query<MappedAddress & { is_default_shipping: boolean; is_default_billing: boolean }>(
        `select street, house_number, postal_code, city, country_code, is_default_shipping, is_default_billing
         from public.customer_addresses where customer_id = $1`,
        [existing.id],
      )
    ).rows;
    if (!addresses.some((a) => sameAddress(a, c.address!))) {
      await addAddress(rc, existing.id, c.address, addresses, item.line);
      changed = true;
    }
  }
  if (c.note && (await addNote(rc, existing.id, c.note, item.line))) changed = true;

  const activation: ActivationRow | undefined =
    existing.auth_user_id === null
      ? {
          customerId: existing.id,
          email: existing.email,
          firstName: next.first_name,
          lastName: next.last_name,
          shopifyCustomerId: next.shopify_customer_id,
          activationEmailSentAt: existing.activation_email_sent_at,
          isNew: false,
        }
      : undefined;
  if (existing.auth_user_id) warnings.push("hat bereits ein Login, keine Aktivierung nötig");
  return { status: changed ? "updated" : "unchanged", warnings, activation };
}

async function addAddress(
  rc: RunContext,
  customerId: string,
  a: MappedAddress,
  existing: { is_default_shipping: boolean; is_default_billing: boolean }[],
  line: number,
): Promise<void> {
  const defShipping = !existing.some((e) => e.is_default_shipping);
  const defBilling = !existing.some((e) => e.is_default_billing);
  const res = await rc.db.query<{ id: string }>(
    `insert into public.customer_addresses (customer_id, label, first_name, last_name, company, street, house_number,
       address_addition, postal_code, city, country_code, phone, is_default_shipping, is_default_billing)
     values ($1, 'Shopify-Standardadresse', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
    [
      customerId,
      a.first_name,
      a.last_name,
      a.company,
      a.street,
      a.house_number,
      a.address_addition,
      a.postal_code,
      a.city,
      a.country_code,
      a.phone,
      defShipping,
      defBilling,
    ],
  );
  await recordItem(rc, "customer_addresses", res.rows[0].id, "created", line);
}

/** Shopify-Notiz als interne Kundennotiz, nur wenn noch nicht vorhanden. */
async function addNote(
  rc: RunContext,
  customerId: string,
  note: string,
  line: number,
): Promise<boolean> {
  const body = `Shopify-Notiz: ${note}`;
  const exists = await rc.db.query(
    `select 1 from public.customer_notes where customer_id = $1 and body = $2`,
    [customerId, body],
  );
  if (exists.rowCount) return false;
  const res = await rc.db.query<{ id: string }>(
    `insert into public.customer_notes (customer_id, body) values ($1, $2) returning id`,
    [customerId, body],
  );
  await recordItem(rc, "customer_notes", res.rows[0].id, "created", line);
  return true;
}

void runImport({ kind: "customers", usage: USAGE, execute });
