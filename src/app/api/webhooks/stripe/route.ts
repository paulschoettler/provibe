import { NextResponse } from "next/server";
import { processPaymentEvent } from "@/lib/checkout/finalize";
import { integrations } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Stripe-Webhook. Signaturprüfung über den Zahlungsanbieter (Stripe: stripe-signature mit
 * STRIPE_WEBHOOK_SECRET; Mock: Header "mock"), Idempotenz über webhook_events(provider, event_id).
 * Verarbeitet payment_intent.succeeded (Bestellung anlegen) und payment_intent.payment_failed.
 * Antwortet bei Verarbeitungsfehlern mit 500, damit Stripe erneut zustellt.
 * Die Route ist vom Basic-Auth-Schutz ausgenommen (src/proxy.ts).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = await integrations().payments.verifyWebhook(rawBody, signature);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const result = await processPaymentEvent(event);
  if (result.status === "failed") {
    console.error("[webhook:stripe] Verarbeitung fehlgeschlagen", event.type, event.id);
    return NextResponse.json({ received: true, error: "processing_failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true, status: result.status });
}
