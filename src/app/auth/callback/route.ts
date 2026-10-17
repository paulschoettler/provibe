import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { sendEmailChangedMail } from "@/lib/auth/mails";
import { mergeGuestCart } from "@/lib/auth/merge-cart";
import { safeNextPath } from "@/lib/auth/redirect";
import { ensureCustomerForUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Rücksprung aus Magic Link, Aktivierungslink, E-Mail-Bestätigung und Passwort-Reset.
 *
 * Zwei Varianten:
 * - ?code=…           PKCE (Standardvorlage von Supabase, funktioniert nur im selben Browser)
 * - ?token_hash=…&type=…  Vorlagen mit {{ .TokenHash }} und unsere Aktivierungsmail, funktioniert
 *                     auch auf einem anderen Gerät (empfohlen, siehe Bericht)
 *
 * Danach: Kunde verknüpfen, Gastbestellungen zuordnen, Gast-Warenkorb übernehmen, weiter zu ?next.
 */
export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = [
  "magiclink",
  "email",
  "signup",
  "invite",
  "recovery",
  "email_change",
];

function redirectTo(request: NextRequest, path: string) {
  const url = new URL(path, request.nextUrl.origin);
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const rawType = params.get("type");
  let next = safeNextPath(params.get("next"));

  // Fehler, die Supabase selbst anhängt (abgelaufener Link usw.)
  if (params.get("error") || params.get("error_code")) {
    return redirectTo(request, "/account/login?fehler=link");
  }

  const supabase = await supabaseServer();
  let type: EmailOtpType | null = null;
  let user = null;

  if (tokenHash && rawType && OTP_TYPES.includes(rawType as EmailOtpType)) {
    type = rawType as EmailOtpType;
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.warn("[auth] verifyOtp fehlgeschlagen", error.code);
      return redirectTo(request, "/account/login?fehler=link");
    }
    user = data.user;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn("[auth] Code-Austausch fehlgeschlagen", error.code);
      // Häufigster Grund: Link in einem anderen Browser geöffnet als angefordert
      return redirectTo(request, "/account/login?fehler=browser");
    }
    user = data.user;
  } else {
    return redirectTo(request, "/account/login?fehler=link");
  }

  if (!user) return redirectTo(request, "/account/login?fehler=link");

  const customerId = await ensureCustomerForUser(user);
  if (customerId) {
    await mergeGuestCart(customerId, user.email);

    // E-Mail-Wechsel bestätigt: Hinweis an die alte Adresse (Ereignis schreibt der Trigger)
    if (type === "email_change" && !user.new_email) {
      const { data: event } = await supabaseAdmin()
        .from("customer_events")
        .select("data, created_at")
        .eq("customer_id", customerId)
        .eq("kind", "email_changed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const data = event?.data as { old?: string; new?: string } | undefined;
      const fresh = event && Date.now() - new Date(event.created_at).getTime() < 10 * 60 * 1000;
      if (fresh && data?.old && data.new) {
        try {
          await sendEmailChangedMail(data.old, data.new);
        } catch (error) {
          console.error("[auth] Hinweis E-Mail geändert nicht verschickt", error);
        }
      }
    }
  }

  if (type === "recovery") next = "/account/daten?passwort=neu#passwort";
  if (type === "email_change")
    next = user.new_email ? "/account/daten?email=halb" : "/account/daten?email=bestaetigt";
  return redirectTo(request, next);
}
