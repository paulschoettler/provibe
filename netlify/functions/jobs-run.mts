/**
 * Netlify Scheduled Function: ruft alle 5 Minuten den Job-Runner der Next-App auf
 * (POST /api/jobs/run mit Header x-jobs-secret). Die eigentliche Logik läuft in der App
 * (src/lib/admin/jobs/runner.ts), hier nur der Zeitgeber.
 *
 * Netlify erkennt Dateien in netlify/functions automatisch (kein Eintrag in netlify.toml nötig),
 * der Zeitplan steht unten in config.schedule. Scheduled Functions laufen nur auf dem
 * veröffentlichten Production-Deploy, nicht in Deploy Previews (dort gibt es keine Live-Secrets).
 *
 * Umgebungsvariablen (Netlify, Kontext production): JOBS_RUNNER_SECRET (Pflicht),
 * URL (setzt Netlify selbst), SITE_PROTECT_USER/SITE_PROTECT_PASSWORD (bis zum Go-live, weil
 * src/proxy.ts sonst mit Basic Auth antwortet).
 */

export default async function handler(): Promise<Response> {
  const base = (process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "").replace(/\/$/, "");
  const secret = process.env.JOBS_RUNNER_SECRET;
  if (!base || !secret) {
    console.error("[jobs-run] URL oder JOBS_RUNNER_SECRET fehlt, Lauf übersprungen");
    return new Response("not configured", { status: 500 });
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-jobs-secret": secret,
  };
  const user = process.env.SITE_PROTECT_USER;
  const password = process.env.SITE_PROTECT_PASSWORD;
  if (user && password) {
    headers.authorization = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);
  try {
    const res = await fetch(`${base}/api/jobs/run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ limit: 25 }),
      signal: controller.signal,
    });
    const text = await res.text();
    let summary: unknown = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as {
        claimed?: number;
        succeeded?: number;
        retried?: number;
        dead?: number;
      };
      summary = {
        claimed: parsed.claimed,
        succeeded: parsed.succeeded,
        retried: parsed.retried,
        dead: parsed.dead,
      };
    } catch {
      // keine JSON-Antwort
    }
    console.log("[jobs-run]", res.status, JSON.stringify(summary));
    return new Response(null, { status: res.ok ? 204 : 502 });
  } catch (error) {
    console.error(
      "[jobs-run] Aufruf fehlgeschlagen",
      error instanceof Error ? error.message : error,
    );
    return new Response(null, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const config = {
  schedule: "*/5 * * * *",
};
