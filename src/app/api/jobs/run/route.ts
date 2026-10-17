import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/admin/jobs/core";
import { runDueJobs } from "@/lib/admin/jobs/runner";
import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 26;

/**
 * Job-Runner-Endpunkt (POST). Aufgerufen von der Netlify Scheduled Function jobs-run alle
 * 5 Minuten (netlify/functions/jobs-run.mts) oder von Hand mit
 *   curl -X POST -H "x-jobs-secret: $JOBS_RUNNER_SECRET" https://<site>/api/jobs/run
 * Geschützt über den Header x-jobs-secret gegen JOBS_RUNNER_SECRET (Konstantzeit-Vergleich).
 * Ohne gesetztes Secret ist der Endpunkt abgeschaltet (503). Antwort ohne Payloads oder Kundendaten.
 */
export async function POST(request: Request) {
  const secret = serverEnv().JOBS_RUNNER_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "runner_disabled" }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get("x-jobs-secret"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let limit: number | undefined;
  try {
    const body = (await request.json()) as { limit?: unknown };
    if (typeof body?.limit === "number" && Number.isInteger(body.limit)) limit = body.limit;
  } catch {
    // leerer Body: Standardwerte
  }

  try {
    const summary = await runDueJobs({
      limit,
      worker: `api-${request.headers.get("x-nf-request-id")?.slice(0, 12) ?? "manual"}`,
      budgetMs: 20_000,
    });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[jobs] Runner fehlgeschlagen", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "runner_failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
