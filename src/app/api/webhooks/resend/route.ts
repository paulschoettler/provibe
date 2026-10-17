import { NextResponse } from "next/server";
import { handleResendWebhook } from "@/lib/admin/newsletter/webhook";

export const dynamic = "force-dynamic";

/**
 * Resend-Webhook: email.sent, email.delivered, email.opened, email.clicked, email.bounced,
 * email.complained, email.delivery_delayed. Signatur über Svix (RESEND_WEBHOOK_SECRET; Mock: Header
 * svix-signature "mock"), Idempotenz über webhook_events. Harte Bounces und Beschwerden sperren die
 * Adresse automatisch. Bei Verarbeitungsfehlern 500, damit Resend erneut zustellt.
 * Die Route ist vom Basic-Auth-Schutz ausgenommen (src/proxy.ts, /api/webhooks/*).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleResendWebhook(rawBody, {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  });
  switch (result.status) {
    case "invalid_signature":
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    case "failed":
      console.error("[webhook:resend] Verarbeitung fehlgeschlagen");
      return NextResponse.json({ received: true, error: "processing_failed" }, { status: 500 });
    default:
      return NextResponse.json({ received: true, status: result.status });
  }
}
