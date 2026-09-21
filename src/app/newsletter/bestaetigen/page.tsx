import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { integrations } from "@/lib/integrations";
import { OPT_IN_TTL_DAYS, hashToken } from "@/lib/newsletter/consent";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Newsletter bestätigen",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Result = "ok" | "invalid";

/** Erste IP aus X-Forwarded-For, grob geprüft. Nur dann speichern wir sie als Nachweis. */
function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  if (!first) return null;
  const isIp = /^[0-9.]+$/.test(first) || /^[0-9a-fA-F:]+$/.test(first);
  return isIp ? first : null;
}

function equalHashes(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function confirm(token: string, email: string): Promise<Result> {
  const db = supabaseAdmin();
  const { data: contact, error } = await db
    .from("newsletter_contacts")
    .select("id, status, confirm_token_hash, opt_in_sent_at")
    .eq("email", email)
    .maybeSingle();

  if (error || !contact) return "invalid";
  // Bereits bestätigt: der Link darf erneut aufgerufen werden, ohne Fehlermeldung
  if (contact.status === "subscribed") return "ok";
  if (!contact.confirm_token_hash || !equalHashes(contact.confirm_token_hash, hashToken(token))) {
    return "invalid";
  }

  const sentAt = contact.opt_in_sent_at ? new Date(contact.opt_in_sent_at).getTime() : 0;
  const maxAge = OPT_IN_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (!sentAt || Date.now() - sentAt > maxAge) return "invalid";

  const headerList = await headers();
  const now = new Date().toISOString();

  let resendContactId: string | null = null;
  try {
    const contactResult = await integrations().email.upsertContact({ email, unsubscribed: false });
    resendContactId = contactResult.id;
  } catch (contactError) {
    // Der Marketing-Kontakt darf die Bestätigung nicht blockieren, wir holen ihn später nach
    console.error("[newsletter] upsertContact fehlgeschlagen", contactError);
  }

  const { error: updateError } = await db
    .from("newsletter_contacts")
    .update({
      status: "subscribed",
      confirmed_at: now,
      confirm_token_hash: null,
      confirm_ip: clientIp(headerList.get("x-forwarded-for")),
      confirm_user_agent: headerList.get("user-agent"),
      resend_contact_id: resendContactId,
      unsubscribed_at: null,
      updated_at: now,
    })
    .eq("id", contact.id);

  if (updateError) {
    console.error("[newsletter] Bestätigung konnte nicht gespeichert werden", updateError);
    return "invalid";
  }
  return "ok";
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const email = params.email?.trim().toLowerCase() ?? "";

  const result: Result = token && email ? await confirm(token, email) : "invalid";

  return (
    <>
      <Header variant="default" />
      <main className="pv-confirm">
        <div className="pv-confirm-card">
          <p className="eyebrow">Newsletter</p>
          {result === "ok" ? (
            <>
              <h1 className="headline pv-confirm-title">Danke, du bist dabei.</h1>
              <p className="pv-confirm-text">
                Deine Adresse ist bestätigt. Wir melden uns, wenn es etwas Neues gibt: neue Sorten,
                Aktionen, sonst nichts.
              </p>
            </>
          ) : (
            <>
              <h1 className="headline pv-confirm-title">Der Link ist ungültig oder abgelaufen.</h1>
              <p className="pv-confirm-text">
                Bestätigungslinks gelten {OPT_IN_TTL_DAYS} Tage. Trag dich unten einfach noch einmal
                ein, dann schicken wir dir einen frischen Link.
              </p>
            </>
          )}
          <Link href="/" className="btn-primary pv-confirm-button">
            Zur Startseite
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
