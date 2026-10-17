/**
 * Kern des Job-Runners ohne Datenbank (getestet in jobs.test.ts). runner.ts verdrahtet ihn mit
 * Supabase (claim_due_jobs, complete_job, fail_job_with_backoff aus Migration 20261017202000).
 */

export interface ClaimedJob {
  id: string;
  kind: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  order_id: string | null;
}

export interface JobRunnerDeps {
  /** höchstens einen fälligen Job sperren (null: nichts fällig) */
  claim(worker: string): Promise<ClaimedJob | null>;
  complete(id: string): Promise<void>;
  /** gibt den neuen Status zurück: queued (Retry geplant) oder dead */
  fail(id: string, error: string): Promise<"queued" | "dead" | null>;
  /** Handler je kind; wirft bei Fehlern */
  dispatch(job: ClaimedJob): Promise<void>;
  now(): number;
}

export interface JobRunResult {
  id: string;
  kind: string;
  status: "succeeded" | "retry" | "dead";
  attempts: number;
  error?: string;
  durationMs: number;
}

export interface JobRunSummary {
  worker: string;
  claimed: number;
  succeeded: number;
  retried: number;
  dead: number;
  /** Zeitbudget erreicht, weitere fällige Jobs bleiben für den nächsten Lauf */
  stoppedByDeadline: boolean;
  results: JobRunResult[];
}

/** Wartezeit bis zum nächsten Versuch in Minuten (2^attempts, höchstens 24 Stunden). */
export function backoffMinutes(attempts: number): number {
  return Math.min(24 * 60, 2 ** Math.max(0, attempts));
}

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2000);
}

/**
 * Jobs nacheinander holen und ausführen, bis limit erreicht, nichts mehr fällig ist oder das
 * Zeitbudget (budgetMs) aufgebraucht ist. Ein Job wird erst gesperrt, wenn er auch gestartet wird.
 */
export async function runJobLoop(
  deps: JobRunnerDeps,
  options: { worker: string; limit: number; budgetMs: number },
): Promise<JobRunSummary> {
  const started = deps.now();
  const summary: JobRunSummary = {
    worker: options.worker,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    dead: 0,
    stoppedByDeadline: false,
    results: [],
  };
  while (summary.claimed < options.limit) {
    if (deps.now() - started >= options.budgetMs) {
      summary.stoppedByDeadline = true;
      break;
    }
    const job = await deps.claim(options.worker);
    if (!job) break;
    summary.claimed += 1;
    const t0 = deps.now();
    try {
      await deps.dispatch(job);
      await deps.complete(job.id);
      summary.succeeded += 1;
      summary.results.push({
        id: job.id,
        kind: job.kind,
        status: "succeeded",
        attempts: job.attempts,
        durationMs: deps.now() - t0,
      });
    } catch (error) {
      const message = errorMessage(error);
      const next = await deps.fail(job.id, message);
      const dead = next === "dead";
      if (dead) summary.dead += 1;
      else summary.retried += 1;
      summary.results.push({
        id: job.id,
        kind: job.kind,
        status: dead ? "dead" : "retry",
        attempts: job.attempts,
        error: message,
        durationMs: deps.now() - t0,
      });
    }
  }
  return summary;
}

/** Konstantzeit-Vergleich für das Runner-Secret (keine Längen- oder Präfix-Leaks über Timing). */
export function secretsMatch(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
