import "server-only";
import { writeAudit } from "@/lib/admin/audit";
import { aboTitle, loadPricingContext, loadVariants, quoteDelivery } from "./catalog";
import { aboDb, loadSubscriptionRow } from "./db";
import { priceNoticeEmail } from "./emails";
import { loadCustomerContact, mailBase, mailSubscription, sendAboMail } from "./mailer";
import { chargeNow, type RenewalOutcome } from "./renewal";
import { parseSubscriptionSettings, PRICE_NOTICE_DAYS } from "./rules";
import { effectiveNextDelivery } from "./schedule";
import { cancel, pause, resume, setDiscount, setSkipNext, type Actor } from "./service";
import { loadSubscriptionSettings, saveSubscriptionSetting } from "./settings";
import type {
  SubscriptionEventRow,
  SubscriptionRow,
  SubscriptionSettings,
  SubscriptionStatus,
} from "./types";

/**
 * Serverfunktionen für das Backoffice /admin/abos (Oberfläche: src/app/admin/(shell)/abos,
 * Lesehelfer in admin-queries.ts, Server Actions in admin-actions.ts).
 * Aufrufer prüfen vorher die Rolle (requireStaff, Schreiben ab "support" für Pausieren und
 * Überspringen, Rabatt und Einstellungen nur Owner/Admin über PERMISSIONS.editSettings) und
 * übergeben die Staff-Sitzung; jede schreibende Aktion landet im Audit-Log.
 */

export type StaffActor = NonNullable<Parameters<typeof writeAudit>[0]>;

function staffActor(actor: StaffActor): Actor {
  return { type: "staff", id: actor.userId };
}

/* ---------- Liste und Detail ---------- */

export interface AdminSubscriptionListItem {
  id: string;
  number: string;
  status: SubscriptionStatus;
  customerId: string;
  customerEmail: string;
  customerName: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  intervalWeeks: number;
  discountBp: number;
  nextDelivery: string | null;
  totalPerDeliveryCents: number;
  /** Summe der bezahlten Abo-Bestellungen (Umsatz je Abo, brutto inkl. Pfand und Versand) */
  revenueCents: number;
  deliveries: number;
  createdAt: string;
  /** Dosenbild der Sorte (nur Liste, optional) */
  imageUrl?: string | null;
  pausedUntil?: string | null;
  pastDueSince?: string | null;
  cancelledAt?: string | null;
  /** Kündigung erklärt, wirksam zu diesem Zeitpunkt (auch bei noch laufendem Abo) */
  cancelEffectiveAt?: string | null;
  skipNext?: boolean;
  /** Letzte Abo-Bestellung mit Zahlungsstatus (bezahlt, offen, fehlgeschlagen) */
  lastPayment?: { at: string; status: string; orderNumber: string } | null;
}

export interface ListSubscriptionsInput {
  status?: SubscriptionStatus | "all";
  /** Abo-Nummer, E-Mail oder Name (Vorname, Nachname oder beides) */
  search?: string;
  /** nur Abos dieses Produkts (alle Packgrößen) */
  productId?: string;
  /** nur Abos mit diesem Intervall in Wochen */
  intervalWeeks?: number;
  limit?: number;
  offset?: number;
}

/** Suchbegriff für PostgREST-Filter entschärfen (Komma, Klammern und Platzhalter entfernen). */
function safeTerm(term: string): string {
  return term.replace(/[%,()*\\:"']/g, "").trim();
}

export async function listSubscriptions(
  input: ListSubscriptionsInput = {},
): Promise<{ items: AdminSubscriptionListItem[]; total: number }> {
  const db = aboDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  let query = db
    .from("subscriptions")
    .select("*, customers (email, first_name, last_name)", { count: "exact" })
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.intervalWeeks && Number.isInteger(input.intervalWeeks)) {
    query = query.eq("interval_count", input.intervalWeeks);
  }
  if (input.productId && /^[0-9a-f-]{36}$/i.test(input.productId)) {
    const { data: variantRows } = await db
      .from("product_variants")
      .select("id")
      .eq("product_id", input.productId);
    const variantIds = ((variantRows ?? []) as { id: string }[]).map((v) => v.id);
    if (variantIds.length === 0) return { items: [], total: 0 };
    query = query.in("variant_id", variantIds);
  }
  const search = input.search?.trim();
  if (search) {
    if (/^abo[-\s]?\d+$/i.test(search) || /^\d{4,}$/.test(search)) {
      query = query.eq("number", `ABO-${Number(search.replace(/\D/g, ""))}`);
    } else {
      // Jeder Begriff muss in E-Mail, Vor- oder Nachname vorkommen ("Paul Schöttler" findet beide Felder)
      const terms = search.split(/\s+/).map(safeTerm).filter(Boolean).slice(0, 4);
      if (terms.length === 0) return { items: [], total: 0 };
      let customerQuery = db.from("customers").select("id").limit(200);
      for (const term of terms) {
        customerQuery = customerQuery.or(
          `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
        );
      }
      const { data: customers } = await customerQuery;
      const ids = ((customers ?? []) as { id: string }[]).map((c) => c.id);
      if (ids.length === 0) return { items: [], total: 0 };
      query = query.in("customer_id", ids);
    }
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`Abos nicht geladen: ${error.message}`);
  const rows = (data ?? []) as (SubscriptionRow & {
    customers: { email: string; first_name: string | null; last_name: string | null } | null;
  })[];
  if (rows.length === 0) return { items: [], total: count ?? 0 };

  const [variants, pricing, revenue] = await Promise.all([
    loadVariants(rows.map((r) => r.variant_id)),
    loadPricingContext(),
    revenueBySubscription(rows.map((r) => r.id)),
  ]);
  const items = rows.map((row) => {
    const variant = variants.get(row.variant_id);
    const quote = variant ? quoteDelivery(row, variant, pricing) : null;
    const next = effectiveNextDelivery(row);
    const rev = revenue.get(row.id) ?? { cents: 0, count: 0, last: null };
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customerId: row.customer_id,
      customerEmail: row.customers?.email ?? "",
      customerName: [row.customers?.first_name, row.customers?.last_name].filter(Boolean).join(" "),
      productTitle: quote ? aboTitle(quote.line.productHandle, quote.line.productTitle) : "",
      variantTitle: quote?.line.variantTitle ?? "",
      quantity: row.quantity,
      intervalWeeks: row.interval_count,
      discountBp: row.discount_bp,
      nextDelivery: next ? next.toISOString() : null,
      totalPerDeliveryCents: quote?.snapshot.totalCents ?? 0,
      revenueCents: rev.cents,
      deliveries: rev.count,
      createdAt: row.created_at,
      imageUrl: quote?.line.imageUrl ?? null,
      pausedUntil: row.paused_until,
      pastDueSince: row.past_due_since,
      cancelledAt: row.cancelled_at,
      cancelEffectiveAt: row.cancel_effective_at,
      skipNext: row.skip_next,
      lastPayment: rev.last,
    };
  });
  return { items, total: count ?? items.length };
}

interface RevenueEntry {
  cents: number;
  count: number;
  last: { at: string; status: string; orderNumber: string } | null;
}

async function revenueBySubscription(ids: string[]): Promise<Map<string, RevenueEntry>> {
  const out = new Map<string, RevenueEntry>();
  if (ids.length === 0) return out;
  const { data } = await aboDb()
    .from("subscription_orders")
    .select("subscription_id, orders (order_number, placed_at, total_cents, payment_status)")
    .in("subscription_id", ids);
  for (const r of (data ?? []) as unknown as {
    subscription_id: string;
    orders: {
      order_number: string;
      placed_at: string;
      total_cents: number;
      payment_status: string;
    } | null;
  }[]) {
    if (!r.orders) continue;
    const entry = out.get(r.subscription_id) ?? { cents: 0, count: 0, last: null };
    if (!entry.last || r.orders.placed_at > entry.last.at) {
      entry.last = {
        at: r.orders.placed_at,
        status: r.orders.payment_status,
        orderNumber: r.orders.order_number,
      };
    }
    if (["paid", "partially_refunded"].includes(r.orders.payment_status)) {
      entry.cents += r.orders.total_cents;
      entry.count += 1;
    }
    out.set(r.subscription_id, entry);
  }
  return out;
}

export interface AdminSubscriptionDetail {
  row: SubscriptionRow;
  item: AdminSubscriptionListItem;
  customer: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  paymentMethod: {
    type: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  } | null;
  deliveries: {
    orderId: string;
    orderNumber: string;
    placedAt: string;
    totalCents: number;
    status: string;
    paymentStatus: string;
    kind: "initial" | "renewal";
  }[];
  events: SubscriptionEventRow[];
  snapshot: ReturnType<typeof quoteDelivery>["snapshot"] | null;
}

export async function getSubscription(id: string): Promise<AdminSubscriptionDetail | null> {
  const row = await loadSubscriptionRow(id);
  if (!row) return null;
  const db = aboDb();
  const [customer, pm, links, events, variants, pricing] = await Promise.all([
    loadCustomerContact(row.customer_id),
    row.payment_method_id
      ? db
          .from("customer_payment_methods")
          .select("type, brand, last4, exp_month, exp_year")
          .eq("id", row.payment_method_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("subscription_orders")
      .select(
        "kind, created_at, orders (id, order_number, placed_at, total_cents, status, payment_status)",
      )
      .eq("subscription_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("subscription_events")
      .select("*")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    loadVariants([row.variant_id]),
    loadPricingContext(),
  ]);
  const variant = variants.get(row.variant_id);
  const quote = variant ? quoteDelivery(row, variant, pricing) : null;
  const deliveries = (
    (links.data ?? []) as unknown as {
      kind: "initial" | "renewal";
      orders: {
        id: string;
        order_number: string;
        placed_at: string;
        total_cents: number;
        status: string;
        payment_status: string;
      } | null;
    }[]
  )
    .filter((l) => l.orders)
    .map((l) => ({
      orderId: l.orders!.id,
      orderNumber: l.orders!.order_number,
      placedAt: l.orders!.placed_at,
      totalCents: l.orders!.total_cents,
      status: l.orders!.status,
      paymentStatus: l.orders!.payment_status,
      kind: l.kind,
    }));
  const pmRow = pm.data as {
    type: string;
    brand: string | null;
    last4: string | null;
    exp_month: number | null;
    exp_year: number | null;
  } | null;
  const next = effectiveNextDelivery(row);
  const paid = deliveries.filter((d) => ["paid", "partially_refunded"].includes(d.paymentStatus));
  return {
    row,
    item: {
      id: row.id,
      number: row.number,
      status: row.status,
      customerId: row.customer_id,
      customerEmail: customer?.email ?? "",
      customerName: [customer?.firstName, customer?.lastName].filter(Boolean).join(" "),
      productTitle: quote ? aboTitle(quote.line.productHandle, quote.line.productTitle) : "",
      variantTitle: quote?.line.variantTitle ?? "",
      quantity: row.quantity,
      intervalWeeks: row.interval_count,
      discountBp: row.discount_bp,
      nextDelivery: next ? next.toISOString() : null,
      totalPerDeliveryCents: quote?.snapshot.totalCents ?? 0,
      revenueCents: paid.reduce((s, d) => s + d.totalCents, 0),
      deliveries: paid.length,
      createdAt: row.created_at,
    },
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        }
      : null,
    paymentMethod: pmRow
      ? {
          type: pmRow.type,
          brand: pmRow.brand,
          last4: pmRow.last4,
          expMonth: pmRow.exp_month,
          expYear: pmRow.exp_year,
        }
      : null,
    deliveries,
    events: (events.data ?? []) as SubscriptionEventRow[],
    snapshot: quote?.snapshot ?? null,
  };
}

/* ---------- Aktionen ---------- */

async function requireRow(id: string): Promise<SubscriptionRow> {
  const row = await loadSubscriptionRow(id);
  if (!row) throw new Error("Abo nicht gefunden");
  return row;
}

function auditState(row: SubscriptionRow) {
  return {
    status: row.status,
    next_order_at: row.next_order_at,
    paused_until: row.paused_until,
    skip_next: row.skip_next,
    discount_bp: row.discount_bp,
    cancel_effective_at: row.cancel_effective_at,
  };
}

/** Pausieren bis zu einem Tag "YYYY-MM-DD" (höchstens subscription_pause_max_days). */
export async function adminPause(
  actor: StaffActor,
  id: string,
  untilDay: string,
): Promise<SubscriptionRow> {
  const row = await requireRow(id);
  const updated = await pause(row, untilDay, staffActor(actor), "staff");
  await writeAudit(actor, {
    action: "subscription.pause",
    entityType: "subscription",
    entityId: id,
    before: auditState(row),
    after: auditState(updated),
  });
  return updated;
}

export async function adminResume(
  actor: StaffActor,
  id: string,
): Promise<{ row: SubscriptionRow; charge?: RenewalOutcome }> {
  const row = await requireRow(id);
  const result = await resume(row, staffActor(actor));
  await writeAudit(actor, {
    action: "subscription.resume",
    entityType: "subscription",
    entityId: id,
    before: auditState(row),
    after: { ...auditState(result.row), charge: result.charge ?? null },
  });
  return result;
}

/** Nächste Lieferung überspringen (skip=false nimmt das Überspringen zurück). */
export async function adminSkip(
  actor: StaffActor,
  id: string,
  skip = true,
): Promise<SubscriptionRow> {
  const row = await requireRow(id);
  const updated = await setSkipNext(row, skip, staffActor(actor));
  await writeAudit(actor, {
    action: skip ? "subscription.skip" : "subscription.unskip",
    entityType: "subscription",
    entityId: id,
    before: auditState(row),
    after: auditState(updated),
  });
  return updated;
}

/** Kündigen im Auftrag des Kunden (zum Beispiel per Telefon oder E-Mail). Mail an den Kunden. */
export async function adminCancel(
  actor: StaffActor,
  id: string,
  input: {
    kind?: "ordinary" | "extraordinary";
    timing?: "next_possible" | "date";
    desiredDay?: string | null;
    reason?: string | null;
    sendMail?: boolean;
  } = {},
): Promise<SubscriptionRow> {
  const row = await requireRow(id);
  const result = await cancel(
    row,
    {
      kind: input.kind ?? "ordinary",
      timing: input.timing ?? "next_possible",
      desiredDay: input.desiredDay ?? null,
      reason: input.reason ?? "Backoffice",
      sendMail: input.sendMail ?? true,
    },
    staffActor(actor),
  );
  await writeAudit(actor, {
    action: "subscription.cancel",
    entityType: "subscription",
    entityId: id,
    before: auditState(row),
    after: { ...auditState(result.row), mode: result.plan.mode },
  });
  return result.row;
}

/**
 * Rabatt eines bestehenden Abos ändern (Basispunkte, 0 bis 5000). options.reason (intern) landet
 * im Audit-Log.
 */
export async function adminSetDiscount(
  actor: StaffActor,
  id: string,
  discountBp: number,
  options: { reason?: string | null } = {},
): Promise<SubscriptionRow> {
  const row = await requireRow(id);
  const updated = await setDiscount(row, discountBp, staffActor(actor));
  await writeAudit(actor, {
    action: "subscription.set_discount",
    entityType: "subscription",
    entityId: id,
    before: { discount_bp: row.discount_bp },
    after: {
      discount_bp: updated.discount_bp,
      ...(options.reason ? { reason: options.reason.slice(0, 500) } : {}),
    },
  });
  return updated;
}

/**
 * Neuen Standardrabatt ausdrücklich auf bestehende Abos anwenden (Plan B: sonst gilt eine
 * Änderung nur für neue Abos). Optional nur für ein Produkt. Gibt die Anzahl geänderter Abos zurück.
 * filter.onlyRaise: nur Abos, deren Rabatt dadurch steigt (der Preis sinkt); eine Senkung des
 * Rabatts wäre eine Preiserhöhung und braucht eine Ankündigung (I17, H28).
 */
export async function adminApplyDiscountToExisting(
  actor: StaffActor,
  discountBp: number,
  filter: { productId?: string; onlyRaise?: boolean } = {},
): Promise<number> {
  const db = aboDb();
  let ids: string[] | null = null;
  if (filter.productId) {
    const { data } = await db
      .from("product_variants")
      .select("id")
      .eq("product_id", filter.productId);
    ids = ((data ?? []) as { id: string }[]).map((v) => v.id);
    if (ids.length === 0) return 0;
  }
  let query = db.from("subscriptions").select("*").in("status", ["active", "paused", "past_due"]);
  if (ids) query = query.in("variant_id", ids);
  const { data } = await query;
  let changed = 0;
  for (const row of (data ?? []) as SubscriptionRow[]) {
    if (row.discount_bp === discountBp) continue;
    if (filter.onlyRaise && row.discount_bp > discountBp) continue;
    await setDiscount(row, discountBp, staffActor(actor));
    changed += 1;
  }
  await writeAudit(actor, {
    action: "subscription.apply_discount_existing",
    entityType: "subscription",
    entityId: null,
    after: {
      discount_bp: discountBp,
      product_id: filter.productId ?? null,
      only_raise: filter.onlyRaise ?? false,
      changed,
    },
  });
  return changed;
}

/** Offene Zahlung sofort erneut versuchen (z.B. nach Rücksprache mit dem Kunden). */
export async function adminRetryPayment(actor: StaffActor, id: string): Promise<RenewalOutcome> {
  const outcome = await chargeNow(id);
  await writeAudit(actor, {
    action: "subscription.retry_payment",
    entityType: "subscription",
    entityId: id,
    after: { outcome },
  });
  return outcome;
}

/* ---------- Einstellungen ---------- */

export async function getSettings(): Promise<SubscriptionSettings> {
  return loadSubscriptionSettings();
}

/**
 * Einstellungen speichern: Standardrabatt (Basispunkte), Rabatte je Produkt oder Variante,
 * Intervalle in Wochen mit Standard, Erinnerungsvorlauf, Wiederholungstage, maximale Pause.
 * Werte werden geprüft und normalisiert (parseSubscriptionSettings) und erst dann gespeichert.
 */
export async function saveSettings(
  actor: StaffActor,
  input: Partial<SubscriptionSettings>,
): Promise<SubscriptionSettings> {
  const before = await loadSubscriptionSettings();
  const merged = { ...before, ...input };
  const normalized = parseSubscriptionSettings({
    subscription_discount_bp: merged.discountBp,
    subscription_product_discounts: merged.productDiscounts,
    subscription_intervals: { weeks: merged.intervals, default: merged.defaultInterval },
    subscription_reminder_days: merged.reminderDays,
    subscription_retry_days: merged.retryDays,
    subscription_pause_max_days: merged.pauseMaxDays,
  });
  await Promise.all([
    saveSubscriptionSetting("subscription_discount_bp", normalized.discountBp),
    saveSubscriptionSetting("subscription_product_discounts", normalized.productDiscounts),
    saveSubscriptionSetting("subscription_intervals", {
      weeks: normalized.intervals,
      default: normalized.defaultInterval,
    }),
    saveSubscriptionSetting("subscription_reminder_days", normalized.reminderDays),
    saveSubscriptionSetting("subscription_retry_days", normalized.retryDays),
    saveSubscriptionSetting("subscription_pause_max_days", normalized.pauseMaxDays),
  ]);
  await writeAudit(actor, {
    action: "subscription.settings",
    entityType: "shop_settings",
    entityId: "subscription",
    before,
    after: normalized,
  });
  return normalized;
}

/* ---------- Kennzahlen ---------- */

export interface SubscriptionMetrics {
  active: number;
  pastDue: number;
  paused: number;
  cancelledLast30Days: number;
  newLast30Days: number;
  /** monatlich wiederkehrender Umsatz auf den Warenwert nach Abo-Rabatt, ohne Pfand und Versand */
  mrrGoodsCents: number;
  /** Kündigungsquote der letzten 30 Tage in Basispunkten (Kündigungen / alle in der Zeit offenen Abos) */
  churnRateBp: number;
}

const WEEKS_PER_MONTH = 52 / 12;

export async function getSubscriptionMetrics(now: Date = new Date()): Promise<SubscriptionMetrics> {
  const db = aboDb();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: open }, cancelled, created] = await Promise.all([
    db.from("subscriptions").select("*").in("status", ["active", "past_due", "paused"]),
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("cancelled_at", since),
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .neq("status", "draft")
      .gte("created_at", since),
  ]);
  const rows = (open ?? []) as SubscriptionRow[];
  const billing = rows.filter((r) => r.status === "active" || r.status === "past_due");
  const [variants, pricing] = await Promise.all([
    loadVariants(billing.map((r) => r.variant_id)),
    loadPricingContext(),
  ]);
  let mrr = 0;
  for (const row of billing) {
    const variant = variants.get(row.variant_id);
    if (!variant) continue;
    const quote = quoteDelivery(row, variant, pricing, now);
    mrr += (quote.snapshot.subtotalCents * WEEKS_PER_MONTH) / row.interval_count;
  }
  const cancelledCount = cancelled.count ?? 0;
  const createdCount = created.count ?? 0;
  // Bezug: alle Abos, die in den 30 Tagen offen waren (heute offen plus in der Zeit gekündigt)
  const startBase = rows.length + cancelledCount;
  return {
    active: rows.filter((r) => r.status === "active").length,
    pastDue: rows.filter((r) => r.status === "past_due").length,
    paused: rows.filter((r) => r.status === "paused").length,
    cancelledLast30Days: cancelledCount,
    newLast30Days: createdCount,
    mrrGoodsCents: Math.round(mrr),
    churnRateBp: startBase > 0 ? Math.round((cancelledCount / startBase) * 10_000) : 0,
  };
}

/* ---------- Preisankündigung ---------- */

/**
 * Preisänderung ankündigen (Aufruf aus dem Katalog-Backoffice nach einer Preiserhöhung).
 * Für jedes offene Abo der Varianten, dessen gebundener Preis unter dem neuen Katalogpreis liegt
 * und das noch keine Ankündigung hat: price_notice_sent_at = jetzt, wirksam frühestens nach
 * 28 Tagen (PRICE_NOTICE_DAYS) und Mail an den Kunden. Senkungen brauchen keine Ankündigung
 * (sie gelten automatisch ab der nächsten Lieferung). Gibt die Anzahl angekündigter Abos zurück.
 */
export async function announcePriceChange(
  actor: StaffActor | null,
  input: { variantIds: string[]; effectiveAt?: Date },
  now: Date = new Date(),
): Promise<number> {
  if (input.variantIds.length === 0) return 0;
  const minEffective = new Date(now.getTime() + PRICE_NOTICE_DAYS * 86_400_000);
  const effectiveAt =
    input.effectiveAt && input.effectiveAt.getTime() > minEffective.getTime()
      ? input.effectiveAt
      : minEffective;
  const db = aboDb();
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .in("variant_id", input.variantIds)
    .in("status", ["active", "paused", "past_due"])
    .is("price_notice_sent_at", null);
  const rows = (data ?? []) as SubscriptionRow[];
  if (rows.length === 0) return 0;
  const [variants, pricing] = await Promise.all([
    loadVariants(input.variantIds),
    loadPricingContext(),
  ]);
  let announced = 0;
  for (const row of rows) {
    const variant = variants.get(row.variant_id);
    if (
      !variant ||
      row.locked_price_cents === null ||
      variant.price_cents <= row.locked_price_cents
    )
      continue;
    const oldQuote = quoteDelivery(row, variant, pricing, now);
    const newQuote = quoteDelivery({ ...row, locked_price_cents: null }, variant, pricing, now);
    const { error } = await db
      .from("subscriptions")
      .update({
        price_notice_sent_at: now.toISOString(),
        price_change_effective_at: effectiveAt.toISOString(),
      })
      .eq("id", row.id)
      .is("price_notice_sent_at", null);
    if (error) continue;
    await db.from("subscription_events").insert({
      subscription_id: row.id,
      kind: "price_notice_sent",
      data: {
        old_total_cents: oldQuote.snapshot.totalCents,
        new_total_cents: newQuote.snapshot.totalCents,
        effective_at: effectiveAt.toISOString(),
      },
      actor_type: actor ? "staff" : "system",
      actor_id: actor?.userId ?? null,
    });
    const customer = await loadCustomerContact(row.customer_id);
    if (customer) {
      await sendAboMail({
        to: customer.email,
        mail: priceNoticeEmail(
          await mailBase(customer.firstName),
          mailSubscription(row, newQuote),
          {
            oldTotalCents: oldQuote.snapshot.totalCents,
            newTotalCents: newQuote.snapshot.totalCents,
            effectiveAt,
            subscriptionId: row.id,
          },
        ),
        template: "subscription_price_notice",
        idempotencyKey: `subscription_price_notice:${row.id}:${effectiveAt.toISOString().slice(0, 10)}`,
      });
    }
    announced += 1;
  }
  if (actor) {
    await writeAudit(actor, {
      action: "subscription.price_notice",
      entityType: "subscription",
      entityId: null,
      after: { variant_ids: input.variantIds, announced, effective_at: effectiveAt.toISOString() },
    });
  }
  return announced;
}

/* ---------- Kündigungen ohne Login ---------- */

export interface CancellationRequestItem {
  id: string;
  receivedAt: string;
  name: string;
  email: string;
  subscriptionNumber: string | null;
  kind: "ordinary" | "extraordinary";
  timing: "next_possible" | "date";
  desiredDate: string | null;
  reason: string | null;
  status: "received" | "matched" | "unmatched" | "resolved";
  subscriptionIds: string[];
  confirmationSentAt: string | null;
}

/** Protokoll der Kündigungserklärungen über /abo-kuendigen, ungeklärte zuerst filterbar. */
export async function listCancellationRequests(
  input: { status?: CancellationRequestItem["status"]; limit?: number } = {},
): Promise<CancellationRequestItem[]> {
  let query = aboDb()
    .from("subscription_cancellation_requests")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 500));
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(`Kündigungen nicht geladen: ${error.message}`);
  return (
    (data ?? []) as {
      id: string;
      received_at: string;
      customer_name: string;
      email: string;
      subscription_number: string | null;
      kind: "ordinary" | "extraordinary";
      timing: "next_possible" | "date";
      desired_date: string | null;
      reason: string | null;
      status: CancellationRequestItem["status"];
      subscription_ids: string[];
      confirmation_sent_at: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    receivedAt: r.received_at,
    name: r.customer_name,
    email: r.email,
    subscriptionNumber: r.subscription_number,
    kind: r.kind,
    timing: r.timing,
    desiredDate: r.desired_date,
    reason: r.reason,
    status: r.status,
    subscriptionIds: r.subscription_ids ?? [],
    confirmationSentAt: r.confirmation_sent_at,
  }));
}

/** Ungeklärte Kündigung manuell erledigen (nach Zuordnung im Backoffice). */
export async function resolveCancellationRequest(
  actor: StaffActor,
  id: string,
  note: string,
): Promise<void> {
  const { error } = await aboDb()
    .from("subscription_cancellation_requests")
    .update({ status: "resolved", note: note.slice(0, 1000) })
    .eq("id", id);
  if (error) throw new Error(`Kündigung nicht aktualisiert: ${error.message}`);
  await writeAudit(actor, {
    action: "subscription.cancellation_resolved",
    entityType: "subscription_cancellation_request",
    entityId: id,
    after: { note },
  });
}
