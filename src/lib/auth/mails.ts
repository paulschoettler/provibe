import "server-only";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import {
  BULK_ACTIVATION_TEMPLATE,
  accountMailButton as button,
  accountMailLayout as layout,
  accountMailP as p,
  accountMailSmall as small,
  escapeHtml,
  renderBulkActivationMail,
} from "@/emails/account";
import { EMAIL_COLORS } from "@/emails/components";

/**
 * Konto-Mails über integrations().email (bis zum Go-live Mock beziehungsweise Allowlist).
 * Magic Link, Bestätigung und Passwort-Reset verschickt Supabase Auth selbst (Vorlagen im
 * Supabase-Dashboard, siehe Bericht). Hier nur: Konto aktivieren (einzeln mit Magic Link und als
 * Massenversand ohne Ablauf), E-Mail geändert, Konto gelöscht. Layout und reine Vorlagen liegen in
 * src/emails/account.ts.
 */

/** Link nur lokal mit Mock in die Konsole schreiben, damit man den Flow ohne Postfach testen kann. */
function logLinkForLocalDev(label: string, link: string) {
  const env = serverEnv();
  if (env.APP_STAGE === "local" && env.APP_INTEGRATIONS === "mock") {
    console.info(`[auth:mock] ${label}: ${link}`);
  }
}

/**
 * Aktivierungsmail mit Magic Link (Vorlage account_activate, Briefing 10) für den Einzelfall:
 * Anforderung auf /account/konto-aktivieren oder im Login, Versand aus dem Backoffice.
 * Für den Import-Massenversand gilt sendBulkActivationMail.
 */
export async function sendActivationMail(to: string, link: string, firstName?: string | null) {
  logLinkForLocalDev("Aktivierungslink", link);
  const hello = firstName ? `Hallo ${escapeHtml(firstName)},` : "Hallo,";
  const html = layout(
    "Dein provibe Konto",
    "Hol dir dein Konto zurück.",
    p(
      `${hello} unser Shop ist umgezogen. Deine bisherigen Daten und Bestellungen haben wir mitgenommen, nur dein altes Passwort ließ sich nicht übertragen.`,
    ) +
      p(
        "Mit diesem Link meldest du dich an. Danach kannst du auf Wunsch ein neues Passwort setzen.",
      ) +
      button(link, "Konto aktivieren") +
      small(
        `Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br><span style="word-break:break-all">${link}</span>`,
      ) +
      small(
        "Der Link gilt 15 Minuten und funktioniert einmal. Du hast nichts angefordert? Dann ignorier diese E-Mail einfach.",
      ),
  );
  const text = `${hello.replace(/&#\d+;/g, "")}\n\nunser Shop ist umgezogen. Mit diesem Link meldest du dich in deinem provibe Konto an:\n${link}\n\nDer Link gilt 15 Minuten. Du hast nichts angefordert? Dann ignorier diese E-Mail einfach.`;
  return integrations().email.send({
    to,
    subject: "Dein provibe Konto ist bereit",
    html,
    text,
    category: "auth",
    template: "account_activate",
  });
}

/**
 * Konto aktivieren (Massenversand) für den Import (--send-activation, docs/import.md Abschnitt 5).
 * Kein Magic Link: Der Button führt auf /account/konto-aktivieren?email=…, dort fordert die Person
 * einen frischen Link an. So läuft nichts ab, bevor die Mail geöffnet wird. Die Allowlist prüft
 * der Aufrufer (scripts/import/lib/activation.ts) vor jedem Versand.
 */
export async function sendBulkActivationMail(
  to: string,
  firstName?: string | null,
  options: { siteUrl?: string } = {},
) {
  const mail = renderBulkActivationMail({
    email: to,
    firstName,
    siteUrl: options.siteUrl ?? publicEnv.siteUrl,
  });
  logLinkForLocalDev("Aktivierungsseite", mail.url);
  return integrations().email.send({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    category: "auth",
    template: BULK_ACTIVATION_TEMPLATE,
  });
}

/** Hinweis an die alte Adresse, nachdem der Wechsel bestätigt wurde. */
export async function sendEmailChangedMail(oldEmail: string, newEmail: string) {
  const safeNew = escapeHtml(newEmail);
  const html = layout(
    "Dein provibe Konto",
    "Deine E-Mail-Adresse wurde geändert.",
    p(
      `Ab sofort melden wir uns bei dir unter <strong>${safeNew}</strong>. Bestellungen und Rechnungen findest du weiter in deinem Konto.`,
    ) +
      p(
        `Das warst du nicht? Dann schreib uns bitte sofort an <a href="mailto:hello@provibe-drinks.de" style="color:${EMAIL_COLORS.text}">hello@provibe-drinks.de</a>, wir sperren das Konto.`,
      ),
  );
  const text = `Deine E-Mail-Adresse für dein provibe Konto wurde auf ${newEmail} geändert.\n\nDas warst du nicht? Dann schreib uns bitte sofort an hello@provibe-drinks.de.`;
  return integrations().email.send({
    to: oldEmail,
    subject: "Deine E-Mail-Adresse wurde geändert",
    html,
    text,
    category: "auth",
    template: "account_email_changed",
  });
}

/** Bestätigung der Kontolöschung. */
export async function sendAccountDeletedMail(to: string) {
  const html = layout(
    "Dein provibe Konto",
    "Dein Konto ist gelöscht.",
    p(
      "Wir haben dein Kundenkonto gelöscht und deine Profildaten, Adressen und Newsletter-Einstellungen entfernt.",
    ) +
      p(
        "Bestellungen und Rechnungen müssen wir aus steuerlichen Gründen bis zum Ende der gesetzlichen Aufbewahrungsfrist aufbewahren. Sie sind nicht mehr mit einem Login verbunden.",
      ) +
      p(
        `Du kannst jederzeit wieder als Gast bestellen oder ein neues Konto anlegen: <a href="${publicEnv.siteUrl}" style="color:${EMAIL_COLORS.text}">provibe-drinks.de</a>`,
      ),
  );
  const text =
    "Wir haben dein provibe Kundenkonto gelöscht. Bestellungen und Rechnungen bewahren wir bis zum Ende der gesetzlichen Aufbewahrungsfrist auf, ohne Verbindung zu einem Login.";
  return integrations().email.send({
    to,
    subject: "Dein provibe Konto wurde gelöscht",
    html,
    text,
    category: "transactional",
    template: "account_deleted",
  });
}

/** Double Opt-in aus dem Konto heraus (gleicher Bestätigungslink wie im Footer). */
export async function sendNewsletterOptInMail(to: string, confirmUrl: string, ttlDays: number) {
  logLinkForLocalDev("Newsletter-Bestätigung", confirmUrl);
  const html = layout(
    "provibe Newsletter",
    "Nur noch ein Klick.",
    p(
      "Bitte bestätige, dass du unseren Newsletter bekommen möchtest. Ohne diese Bestätigung schicken wir dir nichts.",
    ) +
      button(confirmUrl, "Anmeldung bestätigen") +
      small(
        `Der Link gilt ${ttlDays} Tage. Du hast dich nicht angemeldet? Dann ignorier diese E-Mail einfach.`,
      ),
  );
  const text = `Bitte bestätige deine Newsletter-Anmeldung:\n${confirmUrl}\n\nDer Link gilt ${ttlDays} Tage.`;
  return integrations().email.send({
    to,
    subject: "Bitte bestätige deine Anmeldung",
    html,
    text,
    category: "auth",
    template: "newsletter_double_opt_in",
  });
}
