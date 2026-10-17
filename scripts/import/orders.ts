/**
 * Import Shopify-Bestellhistorie (docs/import.md, Schritt 3, nach Kunden und Rabatten).
 *
 *   pnpm import:orders -- --file bestellungen.csv [--dry-run | --apply]
 *
 * Aggregiert die Positionszeilen zur Bestellung, legt orders und order_items mit Preis-Snapshots
 * an, rechnet den Pfandanteil heraus (unit_count × Pfand je Dose, Bundles über die Komponenten),
 * bildet die Shopify-Status auf unser Modell ab und verknüpft den Kunden über die E-Mail.
 * Keine Mails, keine Jobs, keine Bestandsbewegungen. Die Shopify-Nummer bleibt als order_number
 * und shopify_order_name erhalten, der eigene Nummernkreis PV-… läuft unverändert weiter.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { recordItem, runInBatches, type RunContext } from "./lib/db";
import { runImport, type ImportContext } from "./lib/run";
import { hasColumn } from "./lib/values";
import {
  buildVariantIndex,
  groupOrderRows,
  parseOrderGroup,
  planOrder,
  REQUIRED_ORDER_COLUMNS,
  type CatalogVariant,
  type ParsedOrder,
  type PlannedOrder,
  type VariantIndex,
} from "./map/orders";
import type { UnitMeasure } from "@/lib/pricing";

const USAGE = `Verwendung:
  pnpm import:orders -- --file <orders_export.csv> [--dry-run | --apply] [--report <bericht.json>] [--batch-size 200]`;

const SOURCE = "import_shopify";
const SNAPSHOT = path.resolve(
  import.meta.dirname,
  "../../assets/source/data/shopify-snapshot/products.json",
);

interface Item {
  line: number;
  order: ParsedOrder;
}

async function execute(ctx: ImportContext): Promise<void> {
  const { file, report, args } = ctx;
  const missing = REQUIRED_ORDER_COLUMNS.filter((c) => !hasColumn(file.table.headers, [c]));
  if (missing.length > 0) {
    throw new Error(
      `Spalten fehlen: ${missing.join(", ")}. Ist das der Bestellungs-Export aus Shopify?`,
    );
  }
  if (!hasColumn(file.table.headers, ["Id", "ID", "Order ID"])) {
    report.note(
      'Hinweis: Spalte "Id" fehlt. Wiedererkennung bereits importierter Bestellungen über die Bestellnummer.',
    );
  }

  const { groups, orphans } = groupOrderRows(file.table.rows);
  for (const line of orphans)
    report.add({
      line,
      key: `Zeile ${line}`,
      status: "error",
      reason: "Spalte Name (Bestellnummer) leer",
    });

  const items: Item[] = [];
  for (const g of groups) {
    const parsed = parseOrderGroup(g);
    if (!parsed.ok)
      report.add({ line: g.firstLine, key: g.name, status: "error", reason: parsed.reason });
    else items.push({ line: g.firstLine, order: parsed.value });
  }

  const index = buildVariantIndex(await loadCatalog(ctx.db));
  const rc: RunContext = { db: ctx.db, runId: ctx.runId };
  const seq = await sequenceState(ctx.db);

  await runInBatches(
    ctx.db,
    items,
    { apply: args.apply, batchSize: args.batchSize },
    async (item) => {
      const r = await importOrder(rc, item, index, ctx.now);
      report.add({
        line: item.line,
        key: item.order.name,
        status: r.status,
        reason: r.reason,
        warnings: r.warnings,
      });
      if (r.status === "created") {
        report.bump("Positionen angelegt", r.items);
        if (r.freeLines) report.bump("Positionen ohne Variante (frei übernommen)", r.freeLines);
        if (!r.customerLinked) report.bump("Bestellungen ohne Kundendatensatz (Gast)");
        report.bump(`Bestellstatus ${r.status_label}`);
      }
    },
    (item, message) =>
      report.add({ line: item.line, key: item.order.name, status: "error", reason: message }),
  );

  const seqAfter = await sequenceState(ctx.db);
  report.note(
    seq.last_value === seqAfter.last_value && seq.is_called === seqAfter.is_called
      ? `Nummernkreis PV-… unverändert (order_number_seq last_value ${seqAfter.last_value}).`
      : `WARNUNG: order_number_seq hat sich verändert (${seq.last_value} → ${seqAfter.last_value}).`,
  );
}

async function sequenceState(db: RunContext["db"]) {
  const r = await db.query<{ last_value: string; is_called: boolean }>(
    "select last_value::text, is_called from public.order_number_seq",
  );
  return r.rows[0];
}

// --- Katalog ------------------------------------------------------------------------------------

interface SnapshotProduct {
  title: string;
  variants: { id: number; title: string }[];
}

/** Shopify-Namen je Varianten-ID aus dem Snapshot ("Wildberry Eistee - 9", "Founder Bundle l"). */
function snapshotNames(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  try {
    const products = (JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { products: SnapshotProduct[] })
      .products;
    for (const p of products) {
      for (const v of p.variants) {
        const name = v.title === "Default Title" ? p.title : `${p.title} - ${v.title}`;
        out.set(String(v.id), [name, `${p.title} - ${v.title}`]);
      }
    }
  } catch {
    // Snapshot fehlt: Zuordnung dann nur über SKU und Datenbanknamen
  }
  return out;
}

async function loadCatalog(db: RunContext["db"]): Promise<CatalogVariant[]> {
  const variants = await db.query<{
    id: string;
    product_id: string;
    handle: string;
    product_title: string;
    variant_title: string;
    sku: string | null;
    legacy_sku: string | null;
    unit_count: number;
    weight_grams: number | null;
    packaging_weight_grams: number;
    tax_class: string;
    net_content_per_unit: number | null;
    base_price_measure: UnitMeasure;
    deposit_cents_per_unit: number;
    shopify_variant_id: string | null;
    option_values: Record<string, string>;
  }>(`
    select v.id, v.product_id, p.handle, coalesce(t.title, p.handle) as product_title, v.title as variant_title,
           v.sku, v.legacy_sku, v.unit_count, v.weight_grams, v.packaging_weight_grams, p.tax_class,
           p.net_content_per_unit::float8 as net_content_per_unit, p.base_price_measure::text as base_price_measure,
           p.deposit_cents_per_unit, v.shopify_variant_id::text as shopify_variant_id, v.option_values
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_translations t on t.product_id = p.id and t.locale = 'de'`);

  const comps = await db.query<{
    bundle_variant_id: string;
    component_variant_id: string;
    quantity: number;
    sku: string | null;
    title: string;
    unit_count: number;
    deposit_cents_per_unit: number;
    product_title: string;
  }>(`
    select c.bundle_variant_id, c.component_variant_id, c.quantity, cv.sku, cv.title, cv.unit_count,
           cp.deposit_cents_per_unit, coalesce(ct.title, cp.handle) as product_title
    from public.bundle_components c
    join public.product_variants bv on bv.id = c.bundle_variant_id
    join public.products bp on bp.id = bv.product_id
    join public.product_variants cv on cv.id = c.component_variant_id
    join public.products cp on cp.id = cv.product_id
    left join public.product_translations ct on ct.product_id = cp.id and ct.locale = 'de'
    -- nur echte Bundles: Packs haben seit H24 Dosen als Komponenten, bleiben im Snapshot aber
    -- einfache Positionen wie im Checkout (ADR-018)
    where bp.kind = 'bundle'`);

  const bundles = new Map<
    string,
    { deposit: number; snapshot: NonNullable<CatalogVariant["components"]> }
  >();
  for (const c of comps.rows) {
    const b = bundles.get(c.bundle_variant_id) ?? { deposit: 0, snapshot: [] };
    b.deposit += c.quantity * c.unit_count * c.deposit_cents_per_unit;
    b.snapshot.push({
      variant_id: c.component_variant_id,
      sku: c.sku,
      title: `${c.product_title}, ${c.title}`,
      quantity: c.quantity,
    });
    bundles.set(c.bundle_variant_id, b);
  }

  const shopifyNames = snapshotNames();
  const perProduct = new Map<string, number>();
  for (const v of variants.rows)
    perProduct.set(v.product_id, (perProduct.get(v.product_id) ?? 0) + 1);

  return variants.rows.map((v) => {
    const bundle = bundles.get(v.id);
    const names = new Set<string>(
      v.shopify_variant_id ? (shopifyNames.get(v.shopify_variant_id) ?? []) : [],
    );
    names.add(`${v.product_title} - ${v.variant_title}`);
    for (const value of Object.values(v.option_values ?? {}))
      names.add(`${v.product_title} - ${value}`);
    if (
      (perProduct.get(v.product_id) ?? 0) === 1 ||
      /^(standard|default title)$/i.test(v.variant_title)
    ) {
      names.add(v.product_title);
    }
    return {
      id: v.id,
      productId: v.product_id,
      handle: v.handle,
      productTitle: v.product_title,
      variantTitle: v.variant_title,
      sku: v.sku,
      legacySku: v.legacy_sku,
      unitCount: v.unit_count,
      weightGrams:
        v.weight_grams === null ? null : v.weight_grams + (v.packaging_weight_grams ?? 0),
      taxClass: v.tax_class,
      netContentPerUnit: v.net_content_per_unit,
      basePriceMeasure: v.base_price_measure,
      depositCentsPerUnit:
        v.deposit_cents_per_unit > 0 ? v.deposit_cents_per_unit : (bundle?.deposit ?? 0),
      shopifyVariantId: v.shopify_variant_id,
      components: bundle?.snapshot ?? null,
      names: [...names],
    };
  });
}

// --- Eine Bestellung ------------------------------------------------------------------------

interface OrderResult {
  status: "created" | "skipped";
  reason?: string;
  warnings: string[];
  items: number;
  freeLines: number;
  customerLinked: boolean;
  status_label?: string;
}

async function importOrder(
  rc: RunContext,
  item: Item,
  index: VariantIndex,
  now: Date,
): Promise<OrderResult> {
  const { db } = rc;
  const o = item.order;

  const existing = o.shopifyOrderId
    ? await db.query(`select id from public.orders where shopify_order_id = $1`, [o.shopifyOrderId])
    : await db.query(`select id from public.orders where shopify_order_name = $1 and source = $2`, [
        o.name,
        SOURCE,
      ]);
  if (existing.rowCount) {
    return {
      status: "skipped",
      reason: "bereits importiert",
      warnings: [],
      items: 0,
      freeLines: 0,
      customerLinked: true,
    };
  }

  const plan: PlannedOrder = planOrder(o, index, now);
  const clash = await db.query(`select 1 from public.orders where order_number = $1`, [
    plan.orderNumber,
  ]);
  if (clash.rowCount) throw new Error(`Bestellnummer ${plan.orderNumber} ist schon vergeben`);

  const customer = await db.query<{ id: string }>(
    `select id from public.customers where email = $1 and anonymized_at is null`,
    [o.email],
  );
  const customerId = customer.rows[0]?.id ?? null;

  let discountCodeId: string | null = null;
  if (o.discountCode) {
    const d = await db.query<{ id: string }>(
      `select id from public.discount_codes where code = $1`,
      [o.discountCode],
    );
    discountCodeId = d.rows[0]?.id ?? null;
    if (!discountCodeId)
      plan.warnings.push(
        `Rabattcode ${o.discountCode} nicht in discount_codes, nur als Text übernommen`,
      );
  }

  const paidAt =
    o.paidAt ??
    (["paid", "partially_refunded", "refunded"].includes(plan.paymentStatus) ? o.createdAt : null);
  const shippedAt = plan.fulfillmentStatus === "unfulfilled" ? null : (o.fulfilledAt ?? null);

  const inserted = await db.query<{ id: string }>(
    `insert into public.orders (order_number, status, payment_status, fulfillment_status, customer_id, email, phone,
       currency, subtotal_cents, discount_cents, shipping_cents, deposit_cents, tax_cents, total_cents, tax_lines,
       shipping_address, billing_address, shipping_rate_name, discount_code, discount_code_id, payment_provider,
       payment_method_type, paid_at, attribution, customer_note, is_test, source, shopify_order_id, shopify_order_name,
       placed_at, shipped_at, cancelled_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'EUR', $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17,
       $18, $19, 'shopify', $20, $21, $22::jsonb, $23, false, $24, $25, $26, $27, $28, $29, $27)
     returning id`,
    [
      plan.orderNumber,
      plan.status,
      plan.paymentStatus,
      plan.fulfillmentStatus,
      customerId,
      o.email,
      o.phone ?? o.shipping?.phone ?? o.billing?.phone ?? null,
      plan.subtotalCents,
      plan.discountCents,
      plan.shippingCents,
      plan.depositCents,
      plan.taxCents,
      plan.totalCents,
      JSON.stringify(plan.taxLines),
      JSON.stringify(plan.shippingAddress),
      plan.billingAddress ? JSON.stringify(plan.billingAddress) : null,
      o.shippingMethod,
      o.discountCode,
      discountCodeId,
      plan.paymentMethodType,
      paidAt,
      JSON.stringify(o.source ? { shopify_source: o.source } : {}),
      o.notes,
      SOURCE,
      o.shopifyOrderId,
      o.name,
      o.createdAt,
      shippedAt,
      o.cancelledAt,
    ],
  );
  const orderId = inserted.rows[0].id;

  for (const it of plan.items) {
    await db.query(
      `insert into public.order_items (order_id, variant_id, product_id, product_handle, product_title, variant_title, sku,
         quantity, unit_count, unit_price_cents, unit_deposit_cents, discount_cents, tax_class, tax_rate_bp,
         line_total_cents, weight_grams, base_price_text, components, fulfilled_quantity, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20)`,
      [
        orderId,
        it.variant_id,
        it.product_id,
        it.product_handle,
        it.product_title,
        it.variant_title,
        it.sku,
        it.quantity,
        it.unit_count,
        it.unit_price_cents,
        it.unit_deposit_cents,
        it.discount_cents,
        it.tax_class,
        it.tax_rate_bp,
        it.line_total_cents,
        it.weight_grams,
        it.base_price_text,
        it.components ? JSON.stringify(it.components) : null,
        it.fulfilled_quantity,
        it.position,
      ],
    );
  }

  // Einlösung vermerken (für Limits je Kunde), Zähler aber nicht erhöhen: usage_count kommt aus dem Rabatt-Import
  if (discountCodeId) {
    await db.query(
      `insert into public.discount_redemptions (discount_code_id, order_id, customer_id, email, amount_cents, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [discountCodeId, orderId, customerId, o.email, plan.discountCents, o.createdAt],
    );
    await db.query(
      `update public.discount_codes set usage_count = greatest(usage_count - 1, 0) where id = $1`,
      [discountCodeId],
    );
  }

  if (o.refundedCents > 0) {
    await db.query(
      `insert into public.refunds (order_id, provider, amount_cents, reason, status, created_at)
       values ($1, 'shopify', $2, 'Erstattung in Shopify (Import)', 'succeeded', $3)`,
      [orderId, o.refundedCents, o.cancelledAt ?? o.createdAt],
    );
  }

  if (o.tracking && plan.fulfillmentStatus !== "unfulfilled") {
    const carrier = /dhl/i.test(o.tracking.company ?? "")
      ? "dhl"
      : (o.tracking.company ?? "unbekannt").toLowerCase();
    await db.query(
      `insert into public.shipments (order_id, carrier, tracking_number, tracking_url, status, shipped_at, items)
       values ($1, $2, $3, $4, $5, $6, '[]'::jsonb)`,
      [
        orderId,
        carrier,
        o.tracking.number,
        o.tracking.url,
        plan.status === "delivered" ? "delivered" : "shipped",
        shippedAt,
      ],
    );
  }

  await db.query(
    `insert into public.order_events (order_id, kind, message, data, visible_to_customer) values ($1, 'imported', $2, $3::jsonb, false)`,
    [
      orderId,
      `Aus Shopify übernommen (${o.name})`,
      JSON.stringify({
        source: SOURCE,
        run_id: rc.runId,
        shopify_order_id: o.shopifyOrderId,
        shopify_order_name: o.name,
        financial_status: o.financialStatus,
        fulfillment_status: o.fulfillmentStatus,
        payment_method: o.paymentMethod,
        payment_reference: o.paymentReference,
        shopify_subtotal_cents: o.subtotalCents,
        refunded_cents: o.refundedCents,
        tags: o.tags,
        note_attributes: o.noteAttributes,
        warnings: plan.warnings,
      }),
    ],
  );
  await recordItem(rc, "orders", orderId, "created", item.line);

  return {
    status: "created",
    warnings: plan.warnings,
    items: plan.items.length,
    freeLines: plan.freeLines,
    customerLinked: customerId !== null,
    status_label: plan.status,
  };
}

void runImport({ kind: "orders", usage: USAGE, execute });
