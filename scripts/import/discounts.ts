/**
 * Import Shopify-Rabattcodes (docs/import.md, Schritt 2, vor den Bestellungen).
 *
 *   pnpm import:discounts -- --file rabatte.csv [--dry-run | --apply]
 *
 * Abgleich über shopify_discount_id, sonst über den Code (citext, also ohne Groß/Kleinschreibung).
 * Bestehende Codes wie PRESALE10 werden aktualisiert statt doppelt angelegt. usage_count wird nie
 * verringert (Maximum aus Shopify "Times Used" und unserem Zähler).
 */
import { recordItem, runInBatches, type RunContext } from "./lib/db";
import { runImport, type ImportContext } from "./lib/run";
import { hasColumn } from "./lib/values";
import { DISCOUNT_COLUMNS, mapDiscountRow, type MappedDiscount } from "./map/discounts";

const USAGE = `Verwendung:
  pnpm import:discounts -- --file <rabatte.csv|rabatte.json> [--dry-run | --apply] [--report <bericht.json>]`;

interface Item {
  line: number;
  discount: MappedDiscount;
}

interface DiscountRow {
  id: string;
  code: string;
  title: string | null;
  kind: string;
  value: number;
  min_subtotal_cents: number;
  starts_at: Date | null;
  ends_at: Date | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  is_active: boolean;
  combinable: boolean;
  shopify_discount_id: string | null;
}

async function execute(ctx: ImportContext): Promise<void> {
  const { file, report, args } = ctx;
  if (!hasColumn(file.table.headers, DISCOUNT_COLUMNS.code)) {
    throw new Error('Spalte "Code" (oder "Name") fehlt. Ist das der Rabatt-Export aus Shopify?');
  }
  const items: Item[] = [];
  const seen = new Map<string, number>();
  for (const { line, data } of file.table.rows) {
    const mapped = mapDiscountRow(data, ctx.now);
    const key = data["Code"] || data["Name"] || `Zeile ${line}`;
    if (!mapped.ok) {
      report.add({ line, key, status: mapped.skip ? "skipped" : "error", reason: mapped.reason });
      continue;
    }
    const dupe = seen.get(mapped.value.code);
    if (dupe !== undefined) {
      report.add({
        line,
        key,
        status: "error",
        reason: `Code doppelt in der Datei (wie Zeile ${dupe})`,
      });
      continue;
    }
    seen.set(mapped.value.code, line);
    items.push({ line, discount: mapped.value });
  }

  const rc: RunContext = { db: ctx.db, runId: ctx.runId };
  await runInBatches(
    ctx.db,
    items,
    { apply: args.apply, batchSize: args.batchSize },
    async (item) => {
      const status = await upsertDiscount(rc, item);
      report.add({
        line: item.line,
        key: item.discount.code,
        status,
        warnings: item.discount.warnings,
      });
      report.bump(`Typ ${item.discount.kind}`);
    },
    (item, message) =>
      report.add({ line: item.line, key: item.discount.code, status: "error", reason: message }),
  );
}

const SELECT = `id, code::text as code, title, kind::text as kind, value, min_subtotal_cents, starts_at, ends_at, usage_limit,
  usage_limit_per_customer, usage_count, is_active, combinable, shopify_discount_id`;

async function upsertDiscount(
  rc: RunContext,
  item: Item,
): Promise<"created" | "updated" | "unchanged"> {
  const { db } = rc;
  const d = item.discount;
  let existing: DiscountRow | undefined;
  if (d.shopifyDiscountId) {
    existing = (
      await db.query<DiscountRow>(
        `select ${SELECT} from public.discount_codes where shopify_discount_id = $1`,
        [d.shopifyDiscountId],
      )
    ).rows[0];
  }
  existing ??= (
    await db.query<DiscountRow>(`select ${SELECT} from public.discount_codes where code = $1`, [
      d.code,
    ])
  ).rows[0];

  if (!existing) {
    const res = await db.query<{ id: string }>(
      `insert into public.discount_codes (code, title, kind, value, min_subtotal_cents, starts_at, ends_at, usage_limit,
         usage_limit_per_customer, usage_count, is_active, combinable, shopify_discount_id, applies_to)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '{"scope":"order"}'::jsonb) returning id`,
      [
        d.code,
        `${d.code} (aus Shopify)`,
        d.kind,
        d.value,
        d.minSubtotalCents,
        d.startsAt,
        d.endsAt,
        d.usageLimit,
        d.usageLimitPerCustomer,
        d.timesUsed,
        d.isActive,
        d.combinable,
        d.shopifyDiscountId,
      ],
    );
    await recordItem(rc, "discount_codes", res.rows[0].id, "created", item.line);
    return "created";
  }

  const next = {
    kind: d.kind,
    value: d.value,
    min_subtotal_cents: d.minSubtotalCents,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    usage_limit: d.usageLimit,
    usage_limit_per_customer: d.usageLimitPerCustomer,
    usage_count: Math.max(existing.usage_count, d.timesUsed),
    is_active: d.isActive,
    combinable: d.combinable,
    shopify_discount_id: existing.shopify_discount_id ?? d.shopifyDiscountId,
  };
  const iso = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);
  const unchanged =
    existing.kind === next.kind &&
    existing.value === next.value &&
    existing.min_subtotal_cents === next.min_subtotal_cents &&
    iso(existing.starts_at) === iso(next.starts_at) &&
    iso(existing.ends_at) === iso(next.ends_at) &&
    existing.usage_limit === next.usage_limit &&
    existing.usage_limit_per_customer === next.usage_limit_per_customer &&
    existing.usage_count === next.usage_count &&
    existing.is_active === next.is_active &&
    existing.combinable === next.combinable &&
    existing.shopify_discount_id === next.shopify_discount_id;
  if (unchanged) return "unchanged";

  const before = (
    await db.query<{ row: unknown }>(
      `select to_jsonb(d) as row from public.discount_codes d where id = $1`,
      [existing.id],
    )
  ).rows[0].row;
  await db.query(
    `update public.discount_codes set kind = $2, value = $3, min_subtotal_cents = $4, starts_at = $5, ends_at = $6,
       usage_limit = $7, usage_limit_per_customer = $8, usage_count = $9, is_active = $10, combinable = $11,
       shopify_discount_id = $12
     where id = $1`,
    [
      existing.id,
      next.kind,
      next.value,
      next.min_subtotal_cents,
      next.starts_at,
      next.ends_at,
      next.usage_limit,
      next.usage_limit_per_customer,
      next.usage_count,
      next.is_active,
      next.combinable,
      next.shopify_discount_id,
    ],
  );
  await recordItem(rc, "discount_codes", existing.id, "updated", item.line, before);
  return "updated";
}

void runImport({ kind: "discounts", usage: USAGE, execute });
