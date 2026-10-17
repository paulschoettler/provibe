/**
 * Bausteine und reine Vorlagen der Konto-Mails (ohne server-only, ohne Versand), damit sie ohne
 * Datenbank getestet werden können (account.test.ts). Versand: src/lib/auth/mails.ts über
 * integrations().email.
 */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function accountMailLayout(eyebrow: string, title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#FBF8EE;font-family:Jost,Helvetica,Arial,sans-serif;color:#4A2F39">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;color:#7E2856;margin:0 0 12px">${eyebrow}</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-.02em;margin:0 0 16px;color:#6B1D49">${title}</h1>
    ${bodyHtml}
    <p style="font-size:13px;line-height:1.6;color:#8A7680;margin:32px 0 0">provibe · CG Projects UG (haftungsbeschränkt) · Kurt-Viermetz-Straße 1a · 86150 Augsburg<br>Fragen? Antworte einfach auf diese Mail oder schreib an hello@provibe-drinks.de.</p>
  </div></body></html>`;
}

export function accountMailButton(href: string, label: string): string {
  return `<p style="margin:0 0 28px"><a href="${href}" style="display:inline-block;background:#D9306E;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:100px">${label}</a></p>`;
}

export const accountMailP = (text: string) =>
  `<p style="font-size:16px;line-height:1.6;margin:0 0 20px">${text}</p>`;

export const accountMailSmall = (text: string) =>
  `<p style="font-size:14px;line-height:1.6;color:#8A7680;margin:0 0 8px">${text}</p>`;

/* ------------------------------------------------------------------------------------------ */
/* Konto aktivieren (Massenversand)                                                            */
/* ------------------------------------------------------------------------------------------ */

export const BULK_ACTIVATION_TEMPLATE = "account_activate_bulk";
export const BULK_ACTIVATION_SUBJECT = "Dein provibe Konto ist bereit";

/**
 * Ziel des Buttons: die Aktivierungsseite mit vorbelegter E-Mail. Die Seite verschickt erst nach
 * Klick auf "Aktivierungslink senden" einen frischen Magic Link, deshalb läuft hier nichts ab.
 */
export function bulkActivationUrl(siteUrl: string, email: string): string {
  const base = siteUrl.trim().replace(/\/+$/, "");
  return `${base}/account/konto-aktivieren?email=${encodeURIComponent(email.trim())}`;
}

export interface BulkActivationMail {
  subject: string;
  html: string;
  text: string;
  url: string;
}

/**
 * Vorlage "Konto aktivieren (Massenversand)" für den Import (--send-activation). Anders als die
 * Einzelvorlage (sendActivationMail, Magic Link, 15 Minuten) ohne Ablaufhinweis: Der Link führt
 * auf /account/konto-aktivieren und bleibt gültig, bis das Konto aktiviert ist.
 */
export function renderBulkActivationMail(input: {
  email: string;
  firstName?: string | null;
  siteUrl: string;
}): BulkActivationMail {
  const url = bulkActivationUrl(input.siteUrl, input.email);
  const safeUrl = escapeHtml(url);
  const name = input.firstName?.trim() || null;
  const helloHtml = name ? `Hallo ${escapeHtml(name)},` : "Hallo,";
  const helloText = name ? `Hallo ${name},` : "Hallo,";
  const html = accountMailLayout(
    "Dein provibe Konto",
    "Hol dir dein Konto zurück.",
    accountMailP(
      `${helloHtml} unser Shop ist umgezogen. Deine bisherigen Daten und Bestellungen haben wir mitgenommen, nur dein altes Passwort ließ sich nicht übertragen.`,
    ) +
      accountMailP(
        "Tipp auf den Button und bestätige deine E-Mail-Adresse. Wir schicken dir dann sofort einen Link, mit dem du dich anmeldest. Danach kannst du auf Wunsch ein neues Passwort setzen.",
      ) +
      accountMailButton(safeUrl, "Konto aktivieren") +
      accountMailSmall(
        `Falls der Button nicht geht, kopier diesen Link in deinen Browser:<br><span style="word-break:break-all">${safeUrl}</span>`,
      ) +
      accountMailSmall(
        "Du willst kein Konto? Dann ignorier diese E-Mail einfach. Bestellen kannst du auch weiter als Gast.",
      ),
  );
  const text = `${helloText}\n\nunser Shop ist umgezogen. Deine bisherigen Daten und Bestellungen haben wir mitgenommen, nur dein altes Passwort ließ sich nicht übertragen.\n\nHier aktivierst du dein provibe Konto:\n${url}\n\nDu willst kein Konto? Dann ignorier diese E-Mail einfach.`;
  return { subject: BULK_ACTIVATION_SUBJECT, html, text, url };
}
