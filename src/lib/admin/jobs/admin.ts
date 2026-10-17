import "server-only";
import { z } from "zod";
import { hasRole, type StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { ordersDb } from "@/lib/admin/orders/db";
import { AdminOrderError } from "@/lib/admin/orders/errors";
import { KNOWN_JOB_KINDS } from "./handlers";
import { runJobNow } from "./runner";

/**
 * Übersicht der Hintergrundjobs für /admin/jobs (nur Owner und Admin): fällige, geplante,
 * laufende, tote und erledigte Jobs, Fehlermeldung, Wiederholen und Verwerfen. Payloads enthalten
 * nur IDs (keine Kundendaten), werden aber trotzdem nur im Detail gezeigt.
 */

export const JOB_VIEWS = {
  faellig: "Fällig",
  geplant: "Geplant",
  laufend: "Laufend",
  tot: "Tot",
  erledigt: "Erledigt",
  verworfen: "Verworfen",
} as const;
export type JobView = keyof typeof JOB_VIEWS;

export const JOB_KIND_LABELS: Record<string, string> = {
  "checkout.release_reservation": "Reservierung freigeben",
  "email.order_confirmation": "Mail Bestellbestätigung",
  "email.payment_confirmation": "Mail Zahlungsbestätigung",
  "email.order_internal": "Mail intern (neue Bestellung)",
  "lexware.create_invoice": "Rechnung (Checkout)",
  "newsletter.checkout_opt_in": "Newsletter aus dem Checkout",
  "tracking.purchase": "Tracking Kauf",
  "order.shipping_mail": "Mail Versandbestätigung",
  "order.refund_mail": "Mail Erstattung",
  "invoice.create": "Rechnung (Backoffice)",
};

export function jobKindLabel(kind: string): string {
  return JOB_KIND_LABELS[kind] ?? kind;
}

export interface JobRow {
  id: string;
  kind: string;
  kindLabel: string;
  status: "queued" | "running" | "succeeded" | "failed" | "dead" | "cancelled";
  priority: number;
  runAt: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  /** Für diesen kind gibt es einen Handler (sonst bleibt der Job liegen) */
  known: boolean;
  /** wartet und ist schon fällig (run_at erreicht) */
  due: boolean;
}

const SELECT =
  "id, kind, status, priority, run_at, attempts, max_attempts, last_error, locked_by, locked_at, order_id, created_at, updated_at, finished_at, orders (order_number)";

type DbRow = {
  id: string;
  kind: string;
  status: JobRow["status"];
  priority: number;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_by: string | null;
  locked_at: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  orders: { order_number: string } | null;
};

function toRow(r: DbRow): JobRow {
  return {
    id: r.id,
    kind: r.kind,
    kindLabel: jobKindLabel(r.kind),
    status: r.status,
    priority: r.priority,
    runAt: r.run_at,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    lastError: r.last_error,
    lockedBy: r.locked_by,
    lockedAt: r.locked_at,
    orderId: r.order_id,
    orderNumber: r.orders?.order_number ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    finishedAt: r.finished_at,
    known: KNOWN_JOB_KINDS.includes(r.kind),
    due: r.status === "queued" && new Date(r.run_at).getTime() <= Date.now(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyView<Q extends { [k: string]: any }>(q: Q, view: JobView, nowIso: string): Q {
  switch (view) {
    case "faellig":
      return q.eq("status", "queued").lte("run_at", nowIso);
    case "geplant":
      return q.eq("status", "queued").gt("run_at", nowIso);
    case "laufend":
      return q.eq("status", "running");
    case "tot":
      return q.in("status", ["dead", "failed"]);
    case "erledigt":
      return q.eq("status", "succeeded");
    case "verworfen":
      return q.eq("status", "cancelled");
  }
}

export async function jobCounts(now: Date = new Date()): Promise<Record<JobView, number>> {
  const db = ordersDb();
  const nowIso = now.toISOString();
  const views = Object.keys(JOB_VIEWS) as JobView[];
  const results = await Promise.all(
    views.map((v) =>
      applyView(db.from("jobs").select("id", { count: "exact", head: true }), v, nowIso),
    ),
  );
  const out = {} as Record<JobView, number>;
  views.forEach((v, i) => (out[v] = results[i].count ?? 0));
  return out;
}

/** Zähler toter Jobs (für Navigation und Dashboard). */
export async function deadJobCount(): Promise<number> {
  const { count } = await ordersDb()
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["dead", "failed"]);
  return count ?? 0;
}

export async function listJobs(input: {
  view: JobView;
  kind?: string;
  page?: number;
  pageSize?: number;
  now?: Date;
}): Promise<{ rows: JobRow[]; total: number }> {
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const nowIso = (input.now ?? new Date()).toISOString();
  let q = applyView(ordersDb().from("jobs").select(SELECT, { count: "exact" }), input.view, nowIso);
  if (input.kind) q = q.eq("kind", input.kind);
  const ordered =
    input.view === "faellig" || input.view === "geplant"
      ? q.order("run_at", { ascending: true }).order("priority", { ascending: true })
      : q.order("updated_at", { ascending: false });
  const { data, error, count } = await ordered.range(from, from + pageSize - 1);
  if (error) throw new Error(`Jobs konnten nicht geladen werden: ${error.message}`);
  return { rows: ((data ?? []) as unknown as DbRow[]).map(toRow), total: count ?? 0 };
}

export async function getJob(
  id: string,
): Promise<(JobRow & { payload: unknown; idempotencyKey: string | null }) | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await ordersDb()
    .from("jobs")
    .select(`${SELECT}, payload, idempotency_key`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as DbRow & { payload: unknown; idempotency_key: string | null };
  return { ...toRow(row), payload: row.payload, idempotencyKey: row.idempotency_key };
}

/** Distinct kinds für den Filter (aus bekannten Kinds plus vorhandenen). */
export async function jobKinds(): Promise<string[]> {
  const { data } = await ordersDb().from("jobs").select("kind").limit(1000);
  return [...new Set([...KNOWN_JOB_KINDS, ...(data ?? []).map((r) => r.kind)])].sort();
}

function requireJobAdmin(actor: StaffSession) {
  if (!hasRole(actor, "admin")) {
    throw new AdminOrderError("forbidden", "Jobs verwalten dürfen nur Owner und Admin.");
  }
}

/**
 * Job erneut einreihen und sofort einmal versuchen. Tote und fehlgeschlagene Jobs bekommen
 * wieder alle Versuche (attempts 0), fällige oder geplante Jobs laufen jetzt statt später.
 * Laufende Jobs werden nicht angefasst (der Runner meldet sie selbst zurück oder gibt sie nach
 * 15 Minuten frei).
 */
export async function retryJob(
  id: string,
  actor: StaffSession,
): Promise<{ result: "succeeded" | "retry" | "skipped"; kind: string }> {
  requireJobAdmin(actor);
  const job = await getJob(id);
  if (!job) throw new AdminOrderError("not_found", "Job nicht gefunden.");
  if (!["dead", "failed", "queued", "cancelled"].includes(job.status)) {
    throw new AdminOrderError("invalid_transition", "Dieser Job läuft gerade oder ist erledigt.");
  }
  const { data: updated, error } = await ordersDb()
    .from("jobs")
    .update({
      status: "queued",
      run_at: new Date().toISOString(),
      attempts: 0,
      locked_at: null,
      locked_by: null,
      finished_at: null,
    })
    .eq("id", id)
    .eq("status", job.status)
    .select("id");
  if (error) throw new Error(`Job nicht eingereiht: ${error.message}`);
  if (!updated || updated.length === 0) {
    throw new AdminOrderError("conflict", "Der Job wurde inzwischen geändert. Bitte neu laden.");
  }
  await writeAudit(actor, {
    action: "job.retry",
    entityType: "job",
    entityId: id,
    before: { status: job.status, attempts: job.attempts, last_error: job.lastError },
    after: { status: "queued", attempts: 0 },
  });
  const result = job.known ? await runJobNow(id) : "skipped";
  return { result, kind: job.kind };
}

/** Job verwerfen (status cancelled): wird nie mehr ausgeführt, bleibt zur Nachvollziehbarkeit. */
export async function discardJob(id: string, actor: StaffSession, reason?: string): Promise<void> {
  requireJobAdmin(actor);
  const job = await getJob(id);
  if (!job) throw new AdminOrderError("not_found", "Job nicht gefunden.");
  if (!["dead", "failed", "queued"].includes(job.status)) {
    throw new AdminOrderError(
      "invalid_transition",
      "Verwerfen geht nur bei wartenden oder toten Jobs.",
    );
  }
  const note = reason?.trim().slice(0, 300);
  const { data: updated, error } = await ordersDb()
    .from("jobs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: note
        ? `${job.lastError ? `${job.lastError}\n` : ""}[verworfen: ${note}]`
        : job.lastError,
    })
    .eq("id", id)
    .eq("status", job.status)
    .select("id");
  if (error) throw new Error(`Job nicht verworfen: ${error.message}`);
  if (!updated || updated.length === 0) {
    throw new AdminOrderError("conflict", "Der Job wurde inzwischen geändert. Bitte neu laden.");
  }
  await writeAudit(actor, {
    action: "job.discard",
    entityType: "job",
    entityId: id,
    before: { status: job.status },
    after: { status: "cancelled", ...(note ? { reason: note } : {}) },
  });
}
