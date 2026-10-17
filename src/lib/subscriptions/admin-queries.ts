import "server-only";
import { listStaffRows } from "@/lib/admin/staff/db";
import {
  loadPricingContext,
  loadSubscribableProducts,
  loadVariants,
  quoteDelivery,
} from "./catalog";
import { aboDb, loadSubscriptionRow } from "./db";
import { remainingRetryDates } from "./schedule";
import type { SubscriptionRow, SubscriptionSettings, SubscriptionStatus } from "./types";

/**
 * Zusätzliche Lesefunktionen für das Backoffice /admin/abos (ergänzen admin.ts): Zähler für Tabs
 * und Shell, Abo über Nummer oder ID finden, Preisvorschau für den Rabatt-Dialog, Wiederholungsplan,
 * Kündigungsanfragen mit Paginierung und Detail. Nur serverseitig (Service Role).
 */

const UUID = /^[0-9a-f-]{36}$/i;

/* ---------- Zähler ---------- */

export interface SubscriptionAlerts {
  /** Abos mit offener Zahlung (past_due) */
  pastDue: number;
  /** Kündigungen ohne Login, die keinem Abo zugeordnet werden konnten */
  unmatchedCancellations: number;
  /** Summe für Navigation und Glocke */
  total: number;
}

/**
 * Handlungsbedarf im Abo-Bereich für Seitenleiste und Glocke: überfällige Abos plus ungeklärte
 * Kündigungen. Fehler (zum Beispiel Tabelle fehlt) ergeben 0, damit die Shell nie bricht.
 */
export async function countSubscriptionAlerts(): Promise<SubscriptionAlerts> {
  try {
    const db = aboDb();
    const [pastDue, unmatched] = await Promise.all([
      db
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "past_due"),
      db
        .from("subscription_cancellation_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "unmatched"),
    ]);
    const a = pastDue.count ?? 0;
    const b = unmatched.count ?? 0;
    return { pastDue: a, unmatchedCancellations: b, total: a + b };
  } catch (error) {
    console.error("[abo] Zähler nicht geladen", error);
    return { pastDue: 0, unmatchedCancellations: 0, total: 0 };
  }
}

export type SubscriptionStatusCounts = Record<Exclude<SubscriptionStatus, "draft"> | "all", number>;

/** Anzahl je Status für die Tabs der Liste (ohne Entwürfe). */
export async function countSubscriptionsByStatus(): Promise<SubscriptionStatusCounts> {
  const db = aboDb();
  const statuses = ["active", "paused", "past_due", "cancelled"] as const;
  const results = await Promise.all(
    statuses.map((s) =>
      db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );
  const out = { active: 0, paused: 0, past_due: 0, cancelled: 0, all: 0 };
  statuses.forEach((s, i) => {
    out[s] = results[i].count ?? 0;
  });
  out.all = out.active + out.paused + out.past_due + out.cancelled;
  return out;
}

/* ---------- Abo finden ---------- */

/** Abo per UUID oder Abo-Nummer (ABO-1001, Figma-Route /admin/abos/ABO-1001) finden. */
export async function resolveSubscriptionRef(ref: string): Promise<SubscriptionRow | null> {
  const value = decodeURIComponent(ref).trim();
  if (UUID.test(value)) return loadSubscriptionRow(value);
  const match = /^abo[-\s]?(\d{4,9})$/i.exec(value);
  if (!match) return null;
  const { data, error } = await aboDb()
    .from("subscriptions")
    .select("*")
    .eq("number", `ABO-${Number(match[1])}`)
    .maybeSingle();
  if (error) throw new Error(`Abo nicht geladen: ${error.message}`);
  return (data as SubscriptionRow | null) ?? null;
}

/* ---------- Preisvorschau Rabatt ---------- */

export interface DiscountPreview {
  /** Preis je Lieferung (brutto inkl. Pfand und Versand) je Rabatt in Basispunkten */
  totals: Record<number, number>;
  /** Warenwert je Lieferung je Rabatt (nach Abo-Rabatt, ohne Pfand und Versand) */
  goods: Record<number, number>;
  currentBp: number;
  stepBp: number;
}

/**
 * Preis je Lieferung für alle Rabattstufen von 0 bis 50 % in Schritten von 0,5 % (101 Werte).
 * Gleiche Rechnung wie Abo-Lauf und Checkout (quoteDelivery), damit die Vorschau im Dialog ohne
 * Server-Runde stimmt, auch wenn ein Rabatt die Versandschwelle kreuzt.
 */
export async function discountPreview(row: SubscriptionRow): Promise<DiscountPreview | null> {
  const [variants, pricing] = await Promise.all([
    loadVariants([row.variant_id]),
    loadPricingContext(),
  ]);
  const variant = variants.get(row.variant_id);
  if (!variant) return null;
  const stepBp = 50;
  const totals: Record<number, number> = {};
  const goods: Record<number, number> = {};
  const now = new Date();
  const steps = new Set<number>([row.discount_bp]);
  for (let bp = 0; bp <= 5000; bp += stepBp) steps.add(bp);
  for (const bp of steps) {
    const quote = quoteDelivery({ ...row, discount_bp: bp }, variant, pricing, now);
    totals[bp] = quote.snapshot.totalCents;
    goods[bp] = quote.snapshot.subtotalCents;
  }
  return { totals, goods, currentBp: row.discount_bp, stepBp };
}

/* ---------- Standardrabatt auf bestehende Abos ---------- */

export interface DiscountApplicationCount {
  /** offene Abos mit anderem Rabatt */
  differing: number;
  /** davon mit niedrigerem Rabatt: bekommen mehr Rabatt (Preis sinkt) */
  raise: number;
  /** davon mit höherem Rabatt: würden weniger Rabatt bekommen (Preis steigt) */
  lower: number;
}

/** Vorab zählen, wie viele offene Abos eine Anwendung des Standardrabatts betrifft. */
export async function countDiscountApplication(
  discountBp: number,
): Promise<DiscountApplicationCount> {
  const { data, error } = await aboDb()
    .from("subscriptions")
    .select("discount_bp")
    .in("status", ["active", "paused", "past_due"])
    .neq("discount_bp", discountBp);
  if (error) throw new Error(`Abos nicht gezählt: ${error.message}`);
  const rows = (data ?? []) as { discount_bp: number }[];
  const raise = rows.filter((r) => r.discount_bp < discountBp).length;
  return { differing: rows.length, raise, lower: rows.length - raise };
}

/* ---------- Zahlungsfehler ---------- */

export interface RetryPlan {
  failedAttempts: number;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  nextRetryAt: string | null;
  /** noch ausstehende automatische Versuche */
  remaining: string[];
  /** Zahlung wartet auf Bestätigung (3-D Secure) durch den Kunden */
  awaitingAuthentication: boolean;
  /** nach dem letzten Fehlschlag pausiert */
  pausedAfterFailures: boolean;
}

/** Wiederholungsplan aus Abo und Einstellungen (null, wenn kein Zahlungsfehler vorliegt). */
export function retryPlan(row: SubscriptionRow, settings: SubscriptionSettings): RetryPlan | null {
  const pausedAfterFailures = row.status === "paused" && row.pause_reason === "payment_failed";
  if (row.status !== "past_due" && !pausedAfterFailures) return null;
  const first = row.past_due_since ? new Date(row.past_due_since) : null;
  const remaining =
    row.status === "past_due" && first && row.retry_count > 0
      ? remainingRetryDates(settings.retryDays, row.retry_count, first)
          .filter((d) => d.getTime() > Date.now())
          .map((d) => d.toISOString())
      : [];
  return {
    failedAttempts: row.retry_count,
    firstFailedAt: row.past_due_since,
    lastFailedAt: row.last_payment_failed_at,
    lastError: row.last_payment_error,
    nextRetryAt: row.next_retry_at,
    remaining,
    awaitingAuthentication: Boolean(row.pending_payment_intent_id),
    pausedAfterFailures,
  };
}

/** Lesbare Meldung für Stripe-Ablehnungscodes (Rest unverändert). */
export function paymentErrorLabel(code: string | null): string {
  if (!code) return "Unbekannter Fehler";
  const labels: Record<string, string> = {
    card_declined: "Karte abgelehnt",
    insufficient_funds: "Nicht genug Deckung",
    expired_card: "Karte abgelaufen",
    incorrect_cvc: "Prüfnummer falsch",
    processing_error: "Fehler beim Zahlungsanbieter",
    authentication_required: "Bestätigung (3-D Secure) nötig",
    no_payment_method: "Kein Zahlungsmittel hinterlegt",
  };
  return labels[code] ?? code;
}

/* ---------- Namen der Bearbeiter ---------- */

/** user_id → Anzeigename der Staff-Benutzer (für Ereignisse). */
export async function staffNames(): Promise<Map<string, string>> {
  try {
    const rows = await listStaffRows();
    return new Map(rows.map((r) => [r.user_id, r.display_name ?? r.email]));
  } catch {
    return new Map();
  }
}

/* ---------- Filteroptionen ---------- */

export async function subscribableProductOptions(): Promise<{ value: string; label: string }[]> {
  try {
    const products = await loadSubscribableProducts();
    return products.map((p) => ({ value: p.id, label: p.title }));
  } catch {
    return [];
  }
}

/* ---------- Kündigungsanfragen ---------- */

export type CancellationStatus = "received" | "matched" | "unmatched" | "resolved";

export interface CancellationRequestRow {
  id: string;
  receivedAt: string;
  name: string;
  email: string;
  subscriptionNumber: string | null;
  kind: "ordinary" | "extraordinary";
  timing: "next_possible" | "date";
  desiredDate: string | null;
  reason: string | null;
  status: CancellationStatus;
  subscriptionIds: string[];
  confirmationSentAt: string | null;
  note: string | null;
  updatedAt: string;
}

interface RawRequest {
  id: string;
  received_at: string;
  customer_name: string;
  email: string;
  subscription_number: string | null;
  kind: "ordinary" | "extraordinary";
  timing: "next_possible" | "date";
  desired_date: string | null;
  reason: string | null;
  status: CancellationStatus;
  subscription_ids: string[] | null;
  confirmation_sent_at: string | null;
  note: string | null;
  updated_at: string;
}

const REQUEST_COLUMNS =
  "id, received_at, customer_name, email, subscription_number, kind, timing, desired_date, reason, status, subscription_ids, confirmation_sent_at, note, updated_at";

function mapRequest(r: RawRequest): CancellationRequestRow {
  return {
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
    note: r.note,
    updatedAt: r.updated_at,
  };
}

export async function listCancellationRequestsPage(input: {
  statuses?: CancellationStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CancellationRequestRow[]; total: number }> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const page = Math.max(input.page ?? 1, 1);
  let query = aboDb()
    .from("subscription_cancellation_requests")
    .select(REQUEST_COLUMNS, { count: "exact" })
    .order("received_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (input.statuses?.length) query = query.in("status", input.statuses);
  const term = input.search?.replace(/[%,()*\\:"']/g, "").trim();
  if (term) {
    query = query.or(
      `email.ilike.%${term}%,customer_name.ilike.%${term}%,subscription_number.ilike.%${term}%`,
    );
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`Kündigungen nicht geladen: ${error.message}`);
  return { rows: ((data ?? []) as RawRequest[]).map(mapRequest), total: count ?? 0 };
}

export async function countCancellationRequests(): Promise<
  Record<CancellationStatus | "all", number>
> {
  const db = aboDb();
  const statuses: CancellationStatus[] = ["unmatched", "received", "matched", "resolved"];
  const results = await Promise.all(
    statuses.map((s) =>
      db
        .from("subscription_cancellation_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", s),
    ),
  );
  const out = { unmatched: 0, received: 0, matched: 0, resolved: 0, all: 0 };
  statuses.forEach((s, i) => {
    out[s] = results[i].count ?? 0;
  });
  out.all = out.unmatched + out.received + out.matched + out.resolved;
  return out;
}

export interface CancellationRequestDetail extends CancellationRequestRow {
  /** Abos, die mit dieser Erklärung gekündigt wurden */
  subscriptions: { id: string; number: string; status: SubscriptionStatus }[];
  /** offene Abos von Kunden mit derselben E-Mail-Adresse (Hilfe beim Zuordnen) */
  candidates: { id: string; number: string; status: SubscriptionStatus; customerId: string }[];
}

export async function getCancellationRequest(
  id: string,
): Promise<CancellationRequestDetail | null> {
  if (!UUID.test(id)) return null;
  const db = aboDb();
  const { data, error } = await db
    .from("subscription_cancellation_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Kündigung nicht geladen: ${error.message}`);
  if (!data) return null;
  const row = mapRequest(data as RawRequest);
  const [linked, customers] = await Promise.all([
    row.subscriptionIds.length
      ? db.from("subscriptions").select("id, number, status").in("id", row.subscriptionIds)
      : Promise.resolve({ data: [] }),
    db.from("customers").select("id").ilike("email", row.email.replace(/[%_]/g, "")),
  ]);
  const customerIds = ((customers.data ?? []) as { id: string }[]).map((c) => c.id);
  const candidates = customerIds.length
    ? await db
        .from("subscriptions")
        .select("id, number, status, customer_id")
        .in("customer_id", customerIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : { data: [] };
  return {
    ...row,
    subscriptions: (linked.data ?? []) as CancellationRequestDetail["subscriptions"],
    candidates: (
      (candidates.data ?? []) as {
        id: string;
        number: string;
        status: SubscriptionStatus;
        customer_id: string;
      }[]
    )
      .filter((c) => !row.subscriptionIds.includes(c.id))
      .map((c) => ({ id: c.id, number: c.number, status: c.status, customerId: c.customer_id })),
  };
}
