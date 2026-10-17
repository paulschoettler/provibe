import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/admin/newsletter/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * One-Click-Abmeldung nach RFC 8058 (Header List-Unsubscribe und List-Unsubscribe-Post in jeder
 * Werbemail, Pflicht für Massenversender bei Gmail und Yahoo). Mailprogramme senden POST mit
 * "List-Unsubscribe=One-Click". GET leitet auf die Abmeldeseite weiter (keine Abmeldung per GET).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const campaign = url.searchParams.get("c");
  try {
    const result = await unsubscribeByToken(token, { campaignId: campaign, source: "one_click" });
    if (result === "invalid") return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    return NextResponse.json({ unsubscribed: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/newsletter/abmelden", url.origin);
  const token = url.searchParams.get("token");
  const campaign = url.searchParams.get("c");
  if (token) target.searchParams.set("token", token);
  if (campaign) target.searchParams.set("c", campaign);
  return NextResponse.redirect(target, 303);
}
