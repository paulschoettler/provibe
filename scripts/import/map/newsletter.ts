/**
 * Newsletter-Status aus Shopify (Antwort D3): versandfähig ("subscribed") nur, wenn Shopify
 * "subscribed"/"yes" meldet UND ein Einwilligungszeitpunkt vorliegt. Fehlt der Zeitpunkt, gilt der
 * Importzeitpunkt ausdrücklich NICHT als Einwilligung, der Kontakt wird "unsubscribed".
 *
 * Quellen: Kunden-Export (Accepts Email Marketing) und optional eine Abonnentenliste (Shopify Email,
 * Admin-API emailMarketingConsent oder App-Export), die je E-Mail Vorrang hat.
 * Reine Funktionen, getestet in __tests__/newsletter.test.ts.
 */
import type { RawRow } from "../lib/csv";
import { errorMessage, nullable, normalizeEmail, parseShopifyDate, pick } from "../lib/values";

export const NEWSLETTER_COLUMNS = {
  email: ["Email", "E-Mail", "Email Address", "email"],
  firstName: ["First Name", "first_name", "Vorname"],
  accepts: ["Accepts Email Marketing", "Accepts Marketing"],
  status: [
    "Email Marketing Status",
    "Email Marketing: Status",
    "Email Subscription Status",
    "Subscription Status",
    "Marketing State",
    "marketingState",
    "Status",
  ],
  consentAt: [
    "Accepts Email Marketing Updated At",
    "Email Marketing Consent Updated At",
    "Email Marketing: Updated At",
    "Email Marketing Updated At",
    "Consent Updated At",
    "consentUpdatedAt",
    "consent_updated_at",
    "Subscribed At",
    "Opt-in Date",
  ],
  optInLevel: [
    "Email Marketing Opt-in Level",
    "Email Marketing: Level",
    "Opt-in Level",
    "marketingOptInLevel",
  ],
} as const;

export const CONSENT_TEXT = "Shopify-Import, Einwilligung laut Export";
export const CONSENT_VERSION = "shopify_import";

export interface NewsletterSignal {
  email: string;
  firstName: string | null;
  /** true = subscribed/yes, false = ausdrücklich nicht, null = keine Angabe in dieser Quelle */
  subscribed: boolean | null;
  consentAt: string | null;
  optInLevel: string | null;
  source: "customers" | "subscribers";
  line: number;
}

const SUBSCRIBED = new Set(["yes", "true", "1", "subscribed", "ja", "abonniert"]);
const NOT_SUBSCRIBED = new Set([
  "no",
  "false",
  "0",
  "not_subscribed",
  "unsubscribed",
  "pending",
  "redacted",
  "invalid",
  "nein",
  "abgemeldet",
]);

export function readSignal(
  row: RawRow,
  line: number,
  source: NewsletterSignal["source"],
): { ok: true; value: NewsletterSignal } | { ok: false; reason: string; skip?: boolean } {
  try {
    const email = normalizeEmail(pick(row, NEWSLETTER_COLUMNS.email));
    if (!email) return { ok: false, reason: "keine E-Mail-Adresse", skip: true };
    const raw = (pick(row, NEWSLETTER_COLUMNS.status) || pick(row, NEWSLETTER_COLUMNS.accepts))
      .toLowerCase()
      .replace(/\s+/g, "_");
    let subscribed: boolean | null = null;
    if (SUBSCRIBED.has(raw)) subscribed = true;
    else if (NOT_SUBSCRIBED.has(raw) || raw === "") subscribed = raw === "" ? null : false;
    else return { ok: false, reason: `Newsletter-Status "${raw}" unbekannt` };
    return {
      ok: true,
      value: {
        email,
        firstName: nullable(pick(row, NEWSLETTER_COLUMNS.firstName)),
        subscribed,
        consentAt: parseShopifyDate(pick(row, NEWSLETTER_COLUMNS.consentAt)),
        optInLevel: nullable(pick(row, NEWSLETTER_COLUMNS.optInLevel).toLowerCase()),
        source,
        line,
      },
    };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}

export interface MergedContact {
  email: string;
  firstName: string | null;
  subscribed: boolean;
  consentAt: string | null;
  optInLevel: string | null;
  line: number;
  sources: NewsletterSignal["source"][];
}

/** Signale je E-Mail zusammenführen; die Abonnentenliste hat Vorrang vor dem Kunden-Export. */
export function mergeSignals(signals: NewsletterSignal[]): MergedContact[] {
  const byEmail = new Map<string, MergedContact>();
  const sorted = [...signals].sort((a, b) =>
    a.source === b.source ? 0 : a.source === "customers" ? -1 : 1,
  );
  for (const s of sorted) {
    const prev = byEmail.get(s.email);
    if (!prev) {
      byEmail.set(s.email, {
        email: s.email,
        firstName: s.firstName,
        subscribed: s.subscribed === true,
        consentAt: s.consentAt,
        optInLevel: s.optInLevel,
        line: s.line,
        sources: [s.source],
      });
      continue;
    }
    prev.sources.push(s.source);
    prev.firstName ??= s.firstName;
    if (s.subscribed !== null) prev.subscribed = s.subscribed;
    if (s.consentAt) prev.consentAt = s.consentAt;
    if (s.optInLevel) prev.optInLevel = s.optInLevel;
  }
  return [...byEmail.values()];
}

export type NewsletterDecision =
  | { status: "subscribed"; importedConsentAt: string }
  | {
      status: "unsubscribed";
      reason: "keine_einwilligung" | "ohne_zeitstempel" | "zeitstempel_in_zukunft";
    };

export function decideNewsletter(
  contact: Pick<MergedContact, "subscribed" | "consentAt">,
  now: Date,
): NewsletterDecision {
  if (!contact.subscribed) return { status: "unsubscribed", reason: "keine_einwilligung" };
  if (!contact.consentAt) return { status: "unsubscribed", reason: "ohne_zeitstempel" };
  if (new Date(contact.consentAt).getTime() > now.getTime()) {
    return { status: "unsubscribed", reason: "zeitstempel_in_zukunft" };
  }
  return { status: "subscribed", importedConsentAt: contact.consentAt };
}

export const DECISION_LABEL: Record<string, string> = {
  subscribed: "abonniert (mit Einwilligungszeitpunkt)",
  keine_einwilligung: "nicht abonniert: keine Einwilligung in Shopify",
  ohne_zeitstempel: "nicht abonniert: Einwilligung ohne Zeitstempel",
  zeitstempel_in_zukunft: "nicht abonniert: Zeitstempel in der Zukunft",
};
