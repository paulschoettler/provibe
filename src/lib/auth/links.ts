import "server-only";
import { publicEnv } from "@/lib/env/public";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { sendActivationMail } from "./mails";
import { safeNextPath } from "./redirect";

/** Absolute Callback-URL mit geprüftem Rücksprungziel (muss in Supabase als Redirect URL erlaubt sein). */
export function callbackUrl(next?: string | null): string {
  return `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

export type LinkResult = "sent" | "activation" | "rate_limited" | "error";

/**
 * Aktivierungslink für einen bestehenden Kunden ohne Login (Shopify-Import, frühere Gastbestellung).
 * Der Link wird per Admin-API erzeugt und mit unserer eigenen Vorlage verschickt. Er führt über
 * /auth/callback (token_hash) und funktioniert damit auch auf einem anderen Gerät.
 */
async function sendActivationLink(
  email: string,
  next: string,
  firstName: string | null,
): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: callbackUrl(next) },
  });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) {
    console.error("[auth] Aktivierungslink nicht erzeugt", error?.message);
    return false;
  }
  const link = `${publicEnv.siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent(next)}`;
  const result = await sendActivationMail(email, link, firstName);
  return result.status !== "suppressed";
}

/**
 * Login-Link verschicken. Bestandskunden ohne Login bekommen die Aktivierungsmail, alle anderen
 * den Magic Link von Supabase (legt bei Bedarf ein neues Konto an).
 * Das Ergebnis wird der Person nicht verraten (neutrale Meldung), nur geloggt.
 */
export async function sendLoginLink(email: string, rawNext?: string | null): Promise<LinkResult> {
  const next = safeNextPath(rawNext);
  try {
    const admin = supabaseAdmin();
    const { data: customer } = await admin
      .from("customers")
      .select("id, first_name, auth_user_id, anonymized_at")
      .eq("email", email)
      .maybeSingle();

    if (customer && !customer.auth_user_id && !customer.anonymized_at) {
      const ok = await sendActivationLink(email, next, customer.first_name);
      if (ok) {
        await admin
          .from("customers")
          .update({ activation_email_sent_at: new Date().toISOString() })
          .eq("id", customer.id);
        return "activation";
      }
    }

    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
    });
    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit")
        return "rate_limited";
      console.error("[auth] Magic Link nicht verschickt", error.code, error.message);
      return "error";
    }
    return "sent";
  } catch (error) {
    console.error("[auth] sendLoginLink fehlgeschlagen", error);
    return "error";
  }
}
