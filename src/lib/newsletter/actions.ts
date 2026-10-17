"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { publicEnv } from "@/lib/env/public";
import { integrations } from "@/lib/integrations";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  NEWSLETTER_SUCCESS_MESSAGE,
  OPT_IN_TTL_DAYS,
  hashToken,
  type NewsletterFormState,
} from "./consent";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  // Honeypot: echte Menschen lassen das Feld leer, Bots füllen es aus
  website: z.string().max(0).optional(),
});

function optInEmail(confirmUrl: string) {
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#FBF8EE;font-family:Jost,Helvetica,Arial,sans-serif;color:#4A2F39">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;color:#D9306E;margin:0 0 12px">provibe Newsletter</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-.02em;margin:0 0 16px">Nur noch ein Klick.</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Bitte bestätige, dass du unseren Newsletter bekommen möchtest. Ohne diese Bestätigung schicken wir dir nichts.</p>
    <p style="margin:0 0 28px"><a href="${confirmUrl}" style="display:inline-block;background:#D9306E;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:100px">Anmeldung bestätigen</a></p>
    <p style="font-size:14px;line-height:1.6;color:#8A7680;margin:0 0 8px">Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br><span style="word-break:break-all">${confirmUrl}</span></p>
    <p style="font-size:13px;line-height:1.6;color:#8A7680;margin:24px 0 0">Der Link gilt ${OPT_IN_TTL_DAYS} Tage. Du hast dich nicht angemeldet? Dann ignorier diese E-Mail einfach.</p>
  </div></body></html>`;
  const text = `provibe Newsletter\n\nBitte bestätige deine Anmeldung:\n${confirmUrl}\n\nDer Link gilt ${OPT_IN_TTL_DAYS} Tage. Du hast dich nicht angemeldet? Dann ignorier diese E-Mail einfach.`;
  return { html, text };
}

/**
 * Newsletter-Anmeldung mit Double Opt-in (§ 7 UWG, DSGVO Art. 7).
 * Läuft mit dem Service-Role-Client, weil anon per RLS keinen Zugriff auf newsletter_contacts hat.
 */
export async function subscribeToNewsletter(
  _prevState: NewsletterFormState,
  formData: FormData,
): Promise<NewsletterFormState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Bitte prüf deine Eingabe.",
    };
  }

  // Honeypot gefüllt: still abbrechen, für den Bot sieht es nach Erfolg aus
  if (parsed.data.website) return { status: "ok", message: NEWSLETTER_SUCCESS_MESSAGE };

  const email = parsed.data.email;
  const db = supabaseAdmin();

  try {
    const { data: existing, error: readError } = await db
      .from("newsletter_contacts")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();
    if (readError) throw readError;

    // Schon bestätigt: nichts ändern, nichts senden, gleiche neutrale Meldung ausgeben
    if (existing?.status === "subscribed") {
      return { status: "ok", message: NEWSLETTER_SUCCESS_MESSAGE };
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    const { error: writeError } = await db.from("newsletter_contacts").upsert(
      {
        email,
        status: "pending",
        source: String(formData.get("source") ?? "footer").slice(0, 20),
        confirm_token_hash: hashToken(token),
        opt_in_sent_at: now,
        consent_text: CONSENT_TEXT,
        consent_version: CONSENT_VERSION,
        unsubscribed_at: null,
        updated_at: now,
      },
      { onConflict: "email" },
    );
    if (writeError) throw writeError;

    const confirmUrl = `${publicEnv.siteUrl}/newsletter/bestaetigen?token=${token}&email=${encodeURIComponent(email)}`;
    const { html, text } = optInEmail(confirmUrl);

    await integrations().email.send({
      to: email,
      subject: "Bitte bestätige deine Anmeldung",
      html,
      text,
      category: "auth",
      template: "newsletter_double_opt_in",
    });

    return { status: "ok", message: NEWSLETTER_SUCCESS_MESSAGE };
  } catch (error) {
    console.error("[newsletter] Anmeldung fehlgeschlagen", error);
    return {
      status: "error",
      message: "Das hat gerade nicht geklappt. Bitte versuch es später noch einmal.",
    };
  }
}
