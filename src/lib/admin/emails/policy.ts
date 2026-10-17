import { isEmailAllowlisted, type AllowlistEnv } from "@/lib/env/allowlist";

/**
 * Versandregeln (rein, getestet in policy.test.ts):
 *   - Allowlist bis zum Go-live (CLAUDE.md, F7): Solange shop_settings "email.allowlist_active"
 *     true ist, zählt "*" in EMAIL_ALLOWLIST nicht; nur ausdrücklich gelistete Adressen und Domains.
 *   - Sperrliste: Werbung wird bei jedem Eintrag blockiert, transaktionale und Konto-Mails nur bei
 *     harten Bounces (Beschwerden über Werbung sollen Bestellbestätigungen nicht verhindern).
 *   - Newsletter-Kontakte sind nur versandfähig mit Status subscribed und Bestätigungszeitpunkt.
 */

export type MailCategory = "transactional" | "marketing" | "auth" | "internal";
export type SuppressionReason = "bounce" | "complaint" | "manual" | "unsubscribe";

export function canSendTo(email: string, env: AllowlistEnv, allowlistActive: boolean): boolean {
  if (!email.includes("@")) return false;
  if (!allowlistActive) return isEmailAllowlisted(email, env);
  const explicit = env.EMAIL_ALLOWLIST.split(",")
    .map((e) => e.trim())
    .filter((e) => e && e !== "*")
    .join(",");
  return isEmailAllowlisted(email, { ...env, EMAIL_ALLOWLIST: explicit });
}

export function suppressionBlocks(reason: SuppressionReason, category: MailCategory): boolean {
  if (category === "marketing") return true;
  return reason === "bounce" || reason === "manual";
}

export function isContactSendable(contact: {
  status: string;
  confirmed_at: string | null;
}): boolean {
  return contact.status === "subscribed" && Boolean(contact.confirmed_at);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
