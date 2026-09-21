import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health-Check für Netlify und Monitoring. Gibt keine Secrets und keine internen Details preis. */
export function GET() {
  return NextResponse.json({
    ok: true,
    stage: process.env.APP_STAGE ?? "local",
    integrations: process.env.APP_INTEGRATIONS ?? "mock",
    time: new Date().toISOString(),
  });
}
