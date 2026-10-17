import { escapeHtml } from "@/lib/content/html";

/**
 * Mailvorlagen der Inhaltsformulare. Alle Nutzereingaben werden escaped. Layout wie die
 * Double-Opt-in-Mail (Creme, Jost, Magenta-Button), Text in Du-Form, Absender-Impressum unten.
 */
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

const IMPRESSUM_LINE =
  "CG Projects UG (haftungsbeschränkt) · Kurt-Viermetz-Straße 1a · 86150 Augsburg · hello@provibe-drinks.de";

function layout(eyebrow: string, title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#FBF8EE;font-family:Jost,Helvetica,Arial,sans-serif;color:#4A2F39">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;color:#7E2856;margin:0 0 12px">${escapeHtml(eyebrow)}</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-.02em;margin:0 0 16px;color:#6B1D49">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="font-size:12px;line-height:1.6;color:#8A7680;margin:32px 0 0">${escapeHtml(IMPRESSUM_LINE)}</p>
  </div></body></html>`;
}

function p(text: string): string {
  return `<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${text}</p>`;
}

function table(rows: [string, string][]): string {
  const tr = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#7E2856;font-size:14px;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px;width:100%;background:#F3F1E7;border-radius:10px"><tbody>${tr}</tbody></table>`;
}

function textTable(rows: [string, string][]): string {
  return rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

const berlin = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "long",
  timeStyle: "short",
});

// --- Partner -------------------------------------------------------------------

export interface PartnerMailData {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  message: string;
}

function partnerRows(d: PartnerMailData): [string, string][] {
  return [
    ["Firma", d.company],
    ["Ansprechpartner", d.contactName],
    ["E-Mail", d.email],
    ["Telefon", d.phone || "nicht angegeben"],
    ["Art des Geschäfts", d.businessType],
    ["Nachricht", d.message],
  ];
}

export function partnerInternalMail(d: PartnerMailData, leadId: string): MailContent {
  const rows = partnerRows(d);
  return {
    subject: `Neue Partneranfrage: ${d.company}`,
    html: layout(
      "Partneranfrage",
      `Neue Anfrage von ${d.company}`,
      p(
        "Über das Formular auf /pages/partner ist eine neue Anfrage eingegangen. Sie steht auch in der Lead-Liste im Backoffice.",
      ) +
        table(rows) +
        p(`Lead-ID: ${escapeHtml(leadId)}`),
    ),
    text: `Neue Partneranfrage\n\n${textTable(rows)}\n\nLead-ID: ${leadId}`,
  };
}

export function partnerConfirmationMail(d: PartnerMailData): MailContent {
  const rows = partnerRows(d);
  return {
    subject: "Danke für deine Partneranfrage",
    html: layout(
      "provibe für Partner",
      `Danke, ${d.contactName}!`,
      p(
        "Deine Anfrage ist bei uns angekommen. Wir melden uns per E-Mail bei dir, meist innerhalb von 24 Stunden.",
      ) +
        p("Das hast du uns geschickt:") +
        table(rows) +
        p(
          'Fragen in der Zwischenzeit? Schreib uns an <a href="mailto:partner@provibe-drinks.de" style="color:#6B1D49">partner@provibe-drinks.de</a>.',
        ),
    ),
    text: `Danke, ${d.contactName}!\n\nDeine Anfrage ist bei uns angekommen. Wir melden uns per E-Mail bei dir.\n\n${textTable(rows)}\n\nFragen? partner@provibe-drinks.de\n\n${IMPRESSUM_LINE}`,
  };
}

// --- Kontakt -------------------------------------------------------------------

export interface ContactMailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function contactInternalMail(d: ContactMailData, messageId: string): MailContent {
  const rows: [string, string][] = [
    ["Name", d.name],
    ["E-Mail", d.email],
    ["Betreff", d.subject],
    ["Nachricht", d.message],
  ];
  return {
    subject: `Kontaktformular: ${d.subject} von ${d.name}`,
    html: layout(
      "Kontaktformular",
      `Nachricht von ${d.name}`,
      table(rows) + p(`Nachrichten-ID: ${escapeHtml(messageId)}`),
    ),
    text: `Kontaktformular\n\n${textTable(rows)}\n\nNachrichten-ID: ${messageId}`,
  };
}

export function contactConfirmationMail(d: ContactMailData): MailContent {
  return {
    subject: "Wir haben deine Nachricht erhalten",
    html: layout(
      "Kontakt",
      `Danke, ${d.name}!`,
      p("Deine Nachricht ist angekommen. Wir antworten werktags innerhalb von 24 Stunden.") +
        table([
          ["Betreff", d.subject],
          ["Nachricht", d.message],
        ]),
    ),
    text: `Danke, ${d.name}!\n\nDeine Nachricht ist angekommen. Wir antworten werktags innerhalb von 24 Stunden.\n\nBetreff: ${d.subject}\nNachricht: ${d.message}\n\n${IMPRESSUM_LINE}`,
  };
}

// --- Widerruf ------------------------------------------------------------------

export interface WithdrawalMailData {
  orderNumber: string;
  email: string;
  name: string;
  items: string;
  reason: string;
  receivedAt: Date;
  returnAddress: string;
}

function withdrawalRows(d: WithdrawalMailData): [string, string][] {
  return [
    ["Eingang", `${berlin.format(d.receivedAt)} Uhr`],
    ["Bestellnummer", d.orderNumber],
    ["Name", d.name],
    ["E-Mail", d.email],
    ["Artikel", d.items],
    ["Grund", d.reason || "nicht angegeben"],
  ];
}

/** Eingangsbestätigung auf einem dauerhaften Datenträger (E-Mail), Briefing 5. */
export function withdrawalConfirmationMail(d: WithdrawalMailData): MailContent {
  const rows = withdrawalRows(d);
  return {
    subject: `Eingangsbestätigung deines Widerrufs (Bestellung ${d.orderNumber})`,
    html: layout(
      "Widerruf",
      "Dein Widerruf ist bei uns eingegangen.",
      p(
        `Hallo ${escapeHtml(d.name)}, hiermit bestätigen wir den Eingang deiner Widerrufserklärung.`,
      ) +
        table(rows) +
        p(
          `Bitte schick die Ware spätestens 14 Tage nach deinem Widerruf an: <strong>${escapeHtml(d.returnAddress)}</strong>. Die unmittelbaren Kosten der Rücksendung trägst du.`,
        ) +
        p(
          'Die Erstattung erfolgt nach den Regeln unserer <a href="https://www.provibe-drinks.de/pages/ruckgabe-und-wiederrufsbelehrung" style="color:#6B1D49">Widerrufsbelehrung</a>. Fragen? <a href="mailto:support@provibe-drinks.de" style="color:#6B1D49">support@provibe-drinks.de</a>',
        ),
    ),
    text: `Dein Widerruf ist bei uns eingegangen.\n\n${textTable(rows)}\n\nRücksendung bitte spätestens 14 Tage nach deinem Widerruf an: ${d.returnAddress}. Die unmittelbaren Kosten der Rücksendung trägst du.\n\nFragen? support@provibe-drinks.de\n\n${IMPRESSUM_LINE}`,
  };
}

export function withdrawalInternalMail(d: WithdrawalMailData, requestId: string): MailContent {
  const rows = withdrawalRows(d);
  return {
    subject: `Widerruf eingegangen: Bestellung ${d.orderNumber}`,
    html: layout(
      "Widerruf",
      `Widerruf zu ${d.orderNumber}`,
      table(rows) + p(`Vorgang: ${escapeHtml(requestId)}`),
    ),
    text: `Widerruf eingegangen\n\n${textTable(rows)}\n\nVorgang: ${requestId}`,
  };
}
