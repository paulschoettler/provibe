/**
 * Import Newsletter-Status aus Shopify (docs/import.md, Schritt 4, nach den Kunden).
 *
 *   pnpm import:newsletter -- --file kunden.csv [--subscribers abonnenten.csv] [--dry-run | --apply]
 *
 * Nur Kontakte mit "subscribed"/"yes" UND Einwilligungszeitpunkt werden versandfähig (subscribed,
 * imported_consent_at, source import_shopify, consent_text "Shopify-Import, Einwilligung laut
 * Export"). Alle anderen landen als unsubscribed (Antwort D3). Kein Versand, kein Resend-Sync.
 *
 * Bestehende Kontakte aus dem neuen Shop haben Vorrang: eigene Double-Opt-in-Bestätigungen und
 * Abmeldungen werden nie überschrieben.
 */
import { recordItem, runInBatches, type RunContext } from "./lib/db";
import { runImport, type ImportContext } from "./lib/run";
import { hasColumn } from "./lib/values";
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  DECISION_LABEL,
  decideNewsletter,
  mergeSignals,
  NEWSLETTER_COLUMNS,
  readSignal,
  type MergedContact,
  type NewsletterDecision,
  type NewsletterSignal,
} from "./map/newsletter";

const USAGE = `Verwendung:
  pnpm import:newsletter -- --file <customers_export.csv> [--subscribers <abonnenten.csv>] [--dry-run | --apply]`;

const SOURCE = "import_shopify";

interface ContactRow {
  id: string;
  status: string;
  source: string;
  customer_id: string | null;
  first_name: string | null;
  imported_consent_at: Date | null;
  confirmed_at: Date | null;
  unsubscribe_reason: string | null;
  tags: string[];
}

async function execute(ctx: ImportContext): Promise<void> {
  const { file, extraFiles, report, args } = ctx;
  const sources: { file: typeof file; kind: NewsletterSignal["source"] }[] = [
    { file, kind: "customers" },
    ...extraFiles.map((f) => ({ file: f, kind: "subscribers" as const })),
  ];

  const signals: NewsletterSignal[] = [];
  for (const s of sources) {
    if (!hasColumn(s.file.table.headers, NEWSLETTER_COLUMNS.email)) {
      throw new Error(`${s.file.name}: Spalte "Email" fehlt`);
    }
    const hasConsentColumn = hasColumn(s.file.table.headers, NEWSLETTER_COLUMNS.consentAt);
    if (!hasConsentColumn) {
      report.note(
        `Hinweis ${s.file.name}: keine Spalte mit Einwilligungszeitpunkt. Kontakte aus dieser Datei werden nur mit Zeitpunkt aus einer anderen Quelle versandfähig.`,
      );
    }
    for (const { line, data } of s.file.table.rows) {
      const r = readSignal(data, line, s.kind);
      if (!r.ok) {
        report.add({
          line,
          key: data["Email"] || `Zeile ${line}`,
          status: r.skip ? "skipped" : "error",
          reason: `${s.file.name}: ${r.reason}`,
        });
      } else {
        signals.push(r.value);
      }
    }
  }

  const contacts = mergeSignals(signals);
  const rc: RunContext = { db: ctx.db, runId: ctx.runId };

  await runInBatches(
    ctx.db,
    contacts,
    { apply: args.apply, batchSize: args.batchSize },
    async (contact) => {
      const decision = decideNewsletter(contact, ctx.now);
      const r = await upsertContact(rc, contact, decision);
      report.add({
        line: contact.line,
        key: contact.email,
        status: r.status,
        reason: r.reason,
        warnings: r.warnings,
      });
      report.bump(
        `Entscheidung ${DECISION_LABEL[decision.status === "subscribed" ? "subscribed" : decision.reason]}`,
      );
      report.bump(`Status in der Datenbank danach: ${r.finalStatus}`);
    },
    (contact, message) =>
      report.add({ line: contact.line, key: contact.email, status: "error", reason: message }),
  );
}

async function upsertContact(
  rc: RunContext,
  contact: MergedContact,
  decision: NewsletterDecision,
): Promise<{
  status: "created" | "updated" | "unchanged";
  finalStatus: string;
  reason?: string;
  warnings: string[];
}> {
  const { db } = rc;
  const warnings: string[] = [];
  const customer = await db.query<{ id: string }>(
    `select id from public.customers where email = $1 and anonymized_at is null`,
    [contact.email],
  );
  const customerId = customer.rows[0]?.id ?? null;
  const tags = ["shopify_import", ...(contact.optInLevel ? [`shopify_${contact.optInLevel}`] : [])];
  const values =
    decision.status === "subscribed"
      ? {
          status: "subscribed",
          imported_consent_at: decision.importedConsentAt,
          unsubscribe_reason: null as string | null,
        }
      : {
          status: "unsubscribed",
          imported_consent_at: null as string | null,
          unsubscribe_reason: `import_shopify_${decision.reason}`,
        };

  const existing = (
    await db.query<ContactRow>(
      `select id, status::text as status, source, customer_id, first_name, imported_consent_at, confirmed_at,
              unsubscribe_reason, tags
       from public.newsletter_contacts where email = $1`,
      [contact.email],
    )
  ).rows[0];

  if (!existing) {
    const res = await db.query<{ id: string }>(
      `insert into public.newsletter_contacts (email, status, customer_id, first_name, source, consent_text,
         consent_version, imported_consent_at, unsubscribe_reason, tags)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        contact.email,
        values.status,
        customerId,
        contact.firstName,
        SOURCE,
        decision.status === "subscribed" ? CONSENT_TEXT : null,
        decision.status === "subscribed" ? CONSENT_VERSION : null,
        values.imported_consent_at,
        values.unsubscribe_reason,
        tags,
      ],
    );
    await recordItem(rc, "newsletter_contacts", res.rows[0].id, "created", contact.line);
    return { status: "created", finalStatus: values.status, warnings };
  }

  // Kontakte aus dem neuen Shop: eigene Bestätigung oder Abmeldung hat immer Vorrang
  if (existing.source !== SOURCE) {
    if (existing.status === "pending" && decision.status === "subscribed") {
      // Double Opt-in im neuen Shop angefragt, Shopify-Einwilligung liegt vor: übernehmen
    } else {
      if (decision.status === "subscribed" && existing.status !== "subscribed") {
        warnings.push(`im neuen Shop "${existing.status}", Shopify-Einwilligung nicht übernommen`);
      }
      if (!existing.customer_id && customerId) {
        await db.query(`update public.newsletter_contacts set customer_id = $2 where id = $1`, [
          existing.id,
          customerId,
        ]);
      }
      return {
        status: "unchanged",
        finalStatus: existing.status,
        reason: "Kontakt aus dem neuen Shop bleibt",
        warnings,
      };
    }
  }

  const iso = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);
  const mergedTags = [...new Set([...(existing.tags ?? []), ...tags])];
  const same =
    existing.status === values.status &&
    iso(existing.imported_consent_at) === iso(values.imported_consent_at) &&
    existing.unsubscribe_reason === values.unsubscribe_reason &&
    !(existing.customer_id === null && customerId !== null) &&
    mergedTags.length === (existing.tags ?? []).length;
  if (same) return { status: "unchanged", finalStatus: existing.status, warnings };

  const before = (
    await db.query<{ row: unknown }>(
      `select to_jsonb(n) as row from public.newsletter_contacts n where id = $1`,
      [existing.id],
    )
  ).rows[0].row;
  await db.query(
    `update public.newsletter_contacts set status = $2, customer_id = coalesce(customer_id, $3),
       first_name = coalesce(first_name, $4), source = $5, consent_text = $6, consent_version = $7,
       imported_consent_at = $8, unsubscribe_reason = $9, tags = $10
     where id = $1`,
    [
      existing.id,
      values.status,
      customerId,
      contact.firstName,
      SOURCE,
      decision.status === "subscribed" ? CONSENT_TEXT : null,
      decision.status === "subscribed" ? CONSENT_VERSION : null,
      values.imported_consent_at,
      values.unsubscribe_reason,
      mergedTags,
    ],
  );
  await recordItem(rc, "newsletter_contacts", existing.id, "updated", contact.line, before);
  return { status: "updated", finalStatus: values.status, warnings };
}

void runImport({ kind: "newsletter", usage: USAGE, extraFileOptions: ["subscribers"], execute });
