import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/auth/session";
import { finishSetupIntent } from "@/lib/subscriptions/setup";

/**
 * Rücksprung von Stripe nach confirmSetup (Zahlungsmittel im Abo wechseln, Live-Betrieb).
 * Der SetupIntent wird serverseitig bei Stripe gelesen und geprüft, dann geht es zurück zum Abo.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const back = (hint: string) =>
    NextResponse.redirect(
      new URL(`/account/abo/${encodeURIComponent(id)}?hinweis=${hint}`, request.url),
    );
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.redirect(new URL("/account/abo", request.url));
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.redirect(
      new URL(`/account/login?next=${encodeURIComponent(`/account/abo/${id}`)}`, request.url),
    );
  }
  const setupIntent = request.nextUrl.searchParams.get("setup_intent") ?? "";
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntent)) return back("fehler");
  try {
    const result = await finishSetupIntent(id, setupIntent, customer);
    if (!result.ok) return back("fehler");
    if (result.charge === "ordered") return back("bezahlt");
    if (result.charge === "declined" || result.charge === "paused_after_failures")
      return back("zahlung-abgelehnt");
    if (result.charge === "action_required") return back("bestaetigung-noetig");
    return back("zahlungsmittel");
  } catch (error) {
    console.error("[abo] Zahlungsmittel nicht übernommen", error);
    return back("fehler");
  }
}
