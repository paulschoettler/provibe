/**
 * Aktivierungsmails für importierte Shopify-Kunden (docs/konto-und-abo-plan.md Teil A).
 * Versand über src/lib/auth/mails.ts (Vorlage account_activate_bulk, "Konto aktivieren
 * (Massenversand)") und integrations().email.
 *
 * Schutz bis zum Go-live: nur Empfänger auf der Allowlist (EMAIL_ALLOWLIST, Antwort F7). Der
 * Mail-Provider prüft die Allowlist nicht selbst, deshalb passiert es hier vor jedem Versand.
 * Versandrate pro Minute begrenzt (--rate, Standard 20).
 *
 * Link: immer /account/konto-aktivieren?email=… (Feld vorbelegt), dort fordert die Person per
 * Klick einen frischen Magic Link an. Früher erzeugte das Skript mit APP_INTEGRATIONS=live direkt
 * einen Magic Link; der galt nur 15 Minuten und war bei einer Massenmail meist abgelaufen, bevor
 * jemand die Mail öffnete. Die Einzelvorlage mit Magic Link (sendActivationMail) bleibt für die
 * Anforderung auf der Seite und das Backoffice.
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
  limit: number | null;
}

export interface ActivationOutcome {
  sent: number;
  blockedAllowlist: number;
  alreadySent: number;
  failed: { email: string; reason: string }[];
  /** Ziel der Links, zum Beispiel https://www.provibe-drinks.de/account/konto-aktivieren */
  activationPage: string;
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
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const outcome: ActivationOutcome = {
    sent: 0,
    blockedAllowlist: 0,
    alreadySent: 0,
    failed: [],
    activationPage: `${siteUrl}/account/konto-aktivieren`,
    sentAt: new Map(),
  };

  // Erst hier laden: mails.ts ist server-only (Aufruf mit --conditions=react-server, siehe package.json)
  const { sendBulkActivationMail } = await import("@/lib/auth/mails");

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
      const result = await sendBulkActivationMail(c.email, c.firstName, { siteUrl });
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
            template: "account_activate_bulk",
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
