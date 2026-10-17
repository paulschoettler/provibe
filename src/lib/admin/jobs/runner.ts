import "server-only";
import { randomUUID } from "node:crypto";
import { ordersDb, rpcUntyped } from "@/lib/admin/orders/db";
import type { Json } from "@/lib/supabase/database.types";
import { errorMessage, runJobLoop, type ClaimedJob, type JobRunSummary } from "./core";
import { dispatchJob, KNOWN_JOB_KINDS, type AdminJobKind } from "./handlers";

/**
 * Job-Runner für die Queue in Postgres (Tabelle jobs). Aufruf über POST /api/jobs/run (Netlify
 * Scheduled Function alle 5 Minuten) oder inline direkt nach einer Aktion (runJobNow).
 *
 * Sperre: claim_due_jobs (FOR UPDATE SKIP LOCKED, locked_at/locked_by, attempts + 1).
 * Erfolg: complete_job (finished_at). Fehler: fail_job_with_backoff (run_at = now + 2^attempts
 * Minuten, ab max_attempts dead). Solange die Migration 20261017202000 remote noch fehlt, fällt
 * der Runner auf claim_jobs und fail_job aus 0010 zurück (gleiche Sperre, kürzeres Backoff).
 */

const FUNCTION_MISSING = /PGRST202|Could not find the function|does not exist/i;

/**
 * Nur Kinds holen, für die es hier einen Handler gibt. Jobs anderer Module (zum Beispiel künftige
 * Newsletter-Jobs) bleiben unberührt, bis ihr Handler in handlers.ts registriert ist.
 * Liefert die Sperre mehr Zeilen als angefragt (claim_jobs aus 0010 kann das, siehe Migration
 * 20261017202000), werden die zusätzlichen Jobs im selben Lauf abgearbeitet statt hängen zu bleiben.
 */
function makeClaimer() {
  const buffer: ClaimedJob[] = [];
  /** Übrig gebliebene, gesperrte Jobs wieder freigeben (Limit oder Zeitbudget erreicht). */
  async function release(worker: string): Promise<void> {
    for (const job of buffer.splice(0)) {
      await ordersDb()
        .from("jobs")
        .update({
          status: "queued",
          locked_at: null,
          locked_by: null,
          attempts: Math.max(job.attempts - 1, 0),
        })
        .eq("id", job.id)
        .eq("status", "running")
        .eq("locked_by", worker);
    }
  }
  async function claim(worker: string): Promise<ClaimedJob | null> {
    if (buffer.length > 0) return buffer.shift()!;
    const args = { p_worker: worker, p_limit: 1, p_kinds: [...KNOWN_JOB_KINDS] };
    let res = await rpcUntyped<ClaimedJob[]>("claim_due_jobs", args);
    if (res.error && FUNCTION_MISSING.test(`${res.error.code} ${res.error.message}`)) {
      res = await rpcUntyped<ClaimedJob[]>("claim_jobs", args);
    }
    if (res.error) throw new Error(`Jobs konnten nicht gesperrt werden: ${res.error.message}`);
    const rows = res.data ?? [];
    buffer.push(...rows.slice(1));
    return rows[0] ?? null;
  }
  return { claim, release };
}

async function complete(id: string): Promise<void> {
  const { error } = await ordersDb().rpc("complete_job", { p_id: id });
  if (error) throw new Error(`complete_job: ${error.message}`);
}

async function fail(id: string, message: string): Promise<"queued" | "dead" | null> {
  const res = await rpcUntyped<"queued" | "dead" | null>("fail_job_with_backoff", {
    p_id: id,
    p_error: message,
  });
  if (res.error && FUNCTION_MISSING.test(`${res.error.code} ${res.error.message}`)) {
    await ordersDb().rpc("fail_job", { p_id: id, p_error: message });
    const { data } = await ordersDb().from("jobs").select("status").eq("id", id).maybeSingle();
    return data?.status === "dead" ? "dead" : "queued";
  }
  if (res.error) {
    console.error("[jobs] fail_job_with_backoff:", res.error.message);
    return null;
  }
  return res.data;
}

export interface RunDueJobsOptions {
  /** höchstens so viele Jobs in diesem Lauf (Standard 20) */
  limit?: number;
  /** Kennung des Workers in jobs.locked_by */
  worker?: string;
  /** Zeitbudget in Millisekunden, danach keine neuen Jobs mehr (Standard 20 s) */
  budgetMs?: number;
}

/** Fällige Jobs abarbeiten. Gibt eine Zusammenfassung ohne Payloads zurück (keine Kundendaten). */
export async function runDueJobs(options: RunDueJobsOptions = {}): Promise<JobRunSummary> {
  const worker = (options.worker ?? `runner-${randomUUID().slice(0, 8)}`).slice(0, 80);
  const claimer = makeClaimer();
  try {
    return await runJobLoop(
      { claim: claimer.claim, complete, fail, dispatch: dispatchJob, now: () => Date.now() },
      {
        worker,
        limit: Math.min(Math.max(options.limit ?? 20, 1), 100),
        budgetMs: options.budgetMs ?? 20_000,
      },
    );
  } finally {
    await claimer.release(worker);
  }
}

export interface EnqueueAdminJobInput {
  kind: AdminJobKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  orderId?: string | null;
  priority?: number;
  runAt?: string;
  maxAttempts?: number;
}

/** Backoffice-Job anlegen; null, wenn es ihn mit diesem Schlüssel schon gibt. */
export async function enqueueAdminJob(input: EnqueueAdminJobInput): Promise<string | null> {
  const { data, error } = await ordersDb().rpc("enqueue_job", {
    p_kind: input.kind,
    p_payload: input.payload as Json,
    p_run_at: input.runAt ?? new Date().toISOString(),
    p_idempotency_key: input.idempotencyKey,
    p_priority: input.priority ?? 50,
    p_order_id: input.orderId ?? undefined,
    p_max_attempts: input.maxAttempts ?? 8,
  });
  if (error) {
    console.error("[jobs] Job konnte nicht angelegt werden", input.kind, error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

/**
 * Frisch angelegten Job sofort einmal ausführen (wie runJobsNow im Checkout). Scheitert er,
 * übernimmt der Runner mit Backoff. Wirft nie: die auslösende Aktion ist bereits gespeichert.
 */
export async function runJobNow(id: string | null): Promise<"succeeded" | "retry" | "skipped"> {
  if (!id) return "skipped";
  const db = ordersDb();
  const { data: job } = await db
    .from("jobs")
    .update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: "admin-inline",
      attempts: 1,
    })
    .eq("id", id)
    .eq("status", "queued")
    .select("id, kind, payload")
    .maybeSingle();
  if (!job) return "skipped";
  try {
    await dispatchJob(job);
    await complete(job.id);
    return "succeeded";
  } catch (error) {
    const message = errorMessage(error);
    console.error("[jobs] Inline-Job fehlgeschlagen, Retry folgt", job.kind, message);
    await fail(job.id, message);
    return "retry";
  }
}

/** Anlegen und sofort versuchen. */
export async function enqueueAndRun(input: EnqueueAdminJobInput) {
  const id = await enqueueAdminJob(input);
  return { jobId: id, result: await runJobNow(id) };
}
