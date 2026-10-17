/**
 * Aktivierungsmails für importierte Shopify-Kunden (docs/konto-und-abo-plan.md Teil A).
 * Versand über src/lib/auth/mails.ts (Vorlage account_activate) und integrations().email.
 *
 * Schutz bis zum Go-live: nur Empfänger auf der Allowlist (EMAIL_ALLOWLIST, Antwort F7). Der
 * Mail-Provider prüft die Allowlist nicht selbst, deshalb passiert es hier vor jedem Versand.
 * Versandrate pro Minute begrenzt (--rate, Standard 20).
 *
 * Link: Mit APP_INTEGRATIONS=live und Remote-Datenbank wie im Backoffice per
 * auth.admin.generateLink (Magic Link über /auth/callback). Lokal oder im Mock-Modus zeigt der
 * Link auf /account/konto-aktivieren, dort fordert die Person einen frischen Link an.
 */
import { isEmailAllowlisted, type AllowlistEnv } from "@/lib/env/allowlist";
import type { Db } from "./db";
import { errorMessage } from "./values";

export interface ActivationCandidate {
  customerId: string;
  email: string;
  firstName: string | null;
  activationEmailSentAt: string | null;
}

export interface ActivationOptions {
  ratePerMinute: number;
  resend: boolean;
  /** false bei lokaler DB: dann nie generateLink gegen die Live-Auth */
  remoteTarget: boolean;
  limit: number | null;
}

export interface ActivationOutcome {
  sent: number;
  blockedAllowlist: number;
  alreadySent: number;
  failed: { email: string; reason: string }[];
  linkMode: "magiclink" | "page";
  /** Versandzeitpunkt (UTC) je Kunden-ID */
  sentAt: Map<string, string>;
}

const DEFAULT_ALLOWLIST = "@provibe-drinks.de,mail@paulschoettler.de";

export function allowlistEnv(env: Record<string, string | undefined>): AllowlistEnv {
  return {
    APP_STAGE: (env.APP_STAGE as AllowlistEnv["APP_STAGE"]) ?? "local",
    APP_INTEGRATIONS: (env.APP_INTEGRATIONS as AllowlistEnv["APP_INTEGRATIONS"]) ?? "mock",
    EMAIL_ALLOWLIST: env.EMAIL_ALLOWLIST ?? DEFAULT_ALLOWLIST,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendActivationMails(
  db: Db,
  candidates: ActivationCandidate[],
  opts: ActivationOptions,
  env: Record<string, string | undefined> = process.env,
): Promise<ActivationOutcome> {
  const allow = allowlistEnv(env);
  const linkMode = allow.APP_INTEGRATIONS === "live" && opts.remoteTarget ? "magiclink" : "page";
  const outcome: ActivationOutcome = {
    sent: 0,
    blockedAllowlist: 0,
    alreadySent: 0,
    failed: [],
    linkMode,
    sentAt: new Map(),
  };

  // Erst hier laden: mails.ts ist server-only (Aufruf mit --conditions=react-server, siehe package.json)
  const { sendActivationMail } = await import("@/lib/auth/mails");
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const buildLink = async (email: string): Promise<string> => {
    if (linkMode === "page") {
      return `${siteUrl}/account/konto-aktivieren?email=${encodeURIComponent(email)}`;
    }
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const next = "/account";
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    const hashed = data?.properties?.hashed_token;
    if (error || !hashed) throw new Error(`Link nicht erzeugt: ${error?.message ?? "ohne Token"}`);
    return `${siteUrl}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent(next)}`;
  };

  const delayMs = Math.ceil(60_000 / Math.max(1, opts.ratePerMinute));
  let attempts = 0;
  for (const c of candidates) {
    if (opts.limit !== null && attempts >= opts.limit) break;
    if (c.activationEmailSentAt && !opts.resend) {
      outcome.alreadySent++;
      continue;
    }
    if (!isEmailAllowlisted(c.email, allow)) {
      outcome.blockedAllowlist++;
      continue;
    }
    if (attempts > 0) await sleep(delayMs);
    attempts++;
    try {
      const result = await sendActivationMail(c.email, await buildLink(c.email), c.firstName);
      if (result.status !== "sent") throw new Error(`Versandstatus ${result.status}`);
      const sentAt = new Date().toISOString();
      await db.query(`update public.customers set activation_email_sent_at = $2 where id = $1`, [
        c.customerId,
        sentAt,
      ]);
      outcome.sentAt.set(c.customerId, sentAt);
      await db.query(
        `insert into public.customer_events (customer_id, kind, data) values ($1, 'activation_email_sent', $2)`,
        [
          c.customerId,
          JSON.stringify({
            source: "import_shopify",
            link_mode: linkMode,
            message_id: result.providerMessageId,
          }),
        ],
      );
      outcome.sent++;
    } catch (error) {
      outcome.failed.push({ email: c.email, reason: errorMessage(error) });
    }
  }
  return outcome;
}
