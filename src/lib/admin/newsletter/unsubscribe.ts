import "server-only";
import { integrations } from "@/lib/integrations";
import { crmDb } from "@/lib/admin/customers/crm-db";

/**
 * Abmeldung per Token aus dem Abmeldelink jeder Werbemail (/newsletter/abmelden?token=) und per
 * One-Click (List-Unsubscribe-Post, /api/newsletter/unsubscribe). Ohne Login, ohne Staff.
 * Das Token erlaubt nur die Abmeldung des eigenen Kontakts.
 */

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** "pa***@provibe-drinks.de": zeigt der Person, welche Adresse betroffen ist, ohne sie offenzulegen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, Math.max(local.length - 1, 1)));
  return `${visible}***@${domain}`;
}

export type UnsubscribeLookup =
  { valid: false } | { valid: true; maskedEmail: string; alreadyUnsubscribed: boolean };

export async function lookupUnsubscribeToken(token: string): Promise<UnsubscribeLookup> {
  if (!isWellFormedToken(token)) return { valid: false };
  const { data } = await crmDb()
    .from("newsletter_contacts")
    .select("email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!data) return { valid: false };
  return {
    valid: true,
    maskedEmail: maskEmail(String(data.email)),
    alreadyUnsubscribed: data.status !== "subscribed" && data.status !== "pending",
  };
}

export type UnsubscribeResult = "unsubscribed" | "already" | "invalid";

export async function unsubscribeByToken(
  token: string,
  options: {
    reason?: string | null;
    campaignId?: string | null;
    source?: "page" | "one_click";
  } = {},
): Promise<UnsubscribeResult> {
  if (!isWellFormedToken(token)) return "invalid";
  const db = crmDb();
  const { data: contact } = await db
    .from("newsletter_contacts")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (!contact) return "invalid";
  if (
    contact.status === "unsubscribed" ||
    contact.status === "bounced" ||
    contact.status === "complained"
  )
    return "already";

  const now = new Date().toISOString();
  const reason =
    options.reason?.trim().slice(0, 300) ||
    (options.source === "one_click" ? "one_click" : "abmeldelink");
  const { error } = await db
    .from("newsletter_contacts")
    .update({
      status: "unsubscribed",
      unsubscribed_at: now,
      unsubscribe_reason: reason,
      confirm_token_hash: null,
    })
    .eq("id", contact.id);
  if (error) {
    console.error("[newsletter] Abmeldung nicht gespeichert", error.message);
    throw new Error("Abmeldung fehlgeschlagen");
  }

  if (options.campaignId && /^[0-9a-f-]{36}$/i.test(options.campaignId)) {
    await db
      .from("campaign_recipients")
      .update({ unsubscribed_at: now })
      .eq("campaign_id", options.campaignId)
      .eq("contact_id", contact.id);
  }
  try {
    await integrations().email.upsertContact({ email: String(contact.email), unsubscribed: true });
  } catch (e) {
    // Der Marketing-Kontakt bei Resend darf die Abmeldung nicht blockieren
    console.error("[newsletter] Resend-Kontakt nicht aktualisiert", e);
  }
  return "unsubscribed";
}
