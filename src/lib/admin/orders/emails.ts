import { escapeHtml, type LegalEntity, type RenderedEmail } from "@/lib/checkout/emails";
import { EMAIL_COLORS as C, EMAIL_FONT, EMAIL_RADIUS, emailLogo } from "@/emails/components";
import { publicEnv } from "@/lib/env/public";
import { formatEur } from "@/lib/money";

/**
 * Transaktionale Mails aus dem Backoffice: Versandbestätigung und Erstattung. Reine Funktionen
 * (Vorschau im Backoffice, Tests). Gleiche Optik wie die Checkout-Mails (src/lib/checkout/emails.ts).
 * Kundendaten werden immer escaped. Der interne Erstattungsgrund wird nie mitgeschickt.
 */

function layout(title: string, body: string, entity: LegalEntity | null, isTest: boolean): string {
  const testBanner = isTest
    ? `<p style="margin:0 0 16px;padding:8px 12px;background:${C.highlight};border:1.5px solid ${C.text};border-radius:${EMAIL_RADIUS.banner};font-size:13px;font-weight:700">TESTBESTELLUNG (Testmodus, keine echte Zahlung)</p>`
    : "";
  const imprint = entity
    ? `${escapeHtml(entity.name)}, ${escapeHtml(entity.street)}, ${escapeHtml(entity.zip)} ${escapeHtml(entity.city)}<br>` +
      [
        entity.managing_director ? `Geschäftsführung: ${escapeHtml(entity.managing_director)}` : "",
        entity.register ? escapeHtml(entity.register) : "",
        entity.vat_id ? `USt-IdNr.: ${escapeHtml(entity.vat_id)}` : "",
      ]
        .filter(Boolean)
        .join(" · ") +
      `<br>Kontakt: ${escapeHtml(entity.email)}`
    : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:${C.background};font-family:${EMAIL_FONT};color:${C.text}">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
${testBanner}
${emailLogo(publicEnv.siteUrl, "left")}
${body}
<p style="font-size:12px;line-height:1.6;color:${C.text};margin:32px 0 0;border-top:1px solid ${C.line};padding-top:16px">${imprint}</p>
</div></body></html>`;
}

function greeting(firstName: string | null | undefined): string {
  return firstName ? `Hallo ${firstName},` : "Hallo,";
}

export interface ShippingEmailInput {
  orderNumber: string;
  firstName: string | null;
  carrierLabel: string;
  trackingNumber: string;
  trackingUrl: string | null;
  items: { title: string; description?: string | null; quantity: number }[];
  addressLines: string[];
  isTest: boolean;
  entity: LegalEntity | null;
}

export function shippingEmail(input: ShippingEmailInput): RenderedEmail {
  const subject = `Deine Bestellung ${input.orderNumber} ist unterwegs`;
  const items = input.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.line};font-size:15px">${i.quantity} × <strong>${escapeHtml(i.title)}</strong>${i.description ? `<br><span style="font-size:13px">${escapeHtml(i.description)}</span>` : ""}</td></tr>`,
    )
    .join("");
  const button = input.trackingUrl
    ? `<p style="margin:20px 0"><a href="${escapeHtml(input.trackingUrl)}" style="display:inline-block;background:${C.accent};color:${C.onAccent};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:${EMAIL_RADIUS.pill}">Sendung verfolgen</a></p>`
    : "";
  const body = `<h1 style="font-size:28px;line-height:1.1;font-weight:700;margin:0 0 12px">Dein Vibe ist unterwegs!</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(greeting(input.firstName))} deine Bestellung <strong>${escapeHtml(input.orderNumber)}</strong> hat unser Lager verlassen.</p>
<div style="background:${C.surface};border-radius:${EMAIL_RADIUS.box};padding:18px">
<p style="font-size:15px;margin:0 0 4px"><strong>Versand mit:</strong> ${escapeHtml(input.carrierLabel)}</p>
<p style="font-size:15px;margin:0"><strong>Sendungsnummer:</strong> ${escapeHtml(input.trackingNumber)}</p>
</div>
${button}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px">${items}</table>
<p style="font-size:15px;font-weight:700;margin:16px 0 4px">Lieferadresse</p><p style="font-size:14px;line-height:1.5;margin:0">${input.addressLines.map(escapeHtml).join("<br>")}</p>
<p style="font-size:14px;line-height:1.6;margin:24px 0 0">Fragen zur Lieferung? Antworte einfach auf diese E-Mail.</p>`;
  const text = [
    `Dein Vibe ist unterwegs!`,
    ``,
    `${greeting(input.firstName)} deine Bestellung ${input.orderNumber} hat unser Lager verlassen.`,
    `Versand mit: ${input.carrierLabel}`,
    `Sendungsnummer: ${input.trackingNumber}`,
    ...(input.trackingUrl ? [`Sendung verfolgen: ${input.trackingUrl}`] : []),
    ``,
    ...input.items.map(
      (i) => `${i.quantity} × ${i.title}${i.description ? ` (${i.description})` : ""}`,
    ),
    ``,
    `Lieferadresse: ${input.addressLines.join(", ")}`,
  ].join("\n");
  return { subject, html: layout(subject, body, input.entity, input.isTest), text };
}

export interface RefundEmailInput {
  orderNumber: string;
  firstName: string | null;
  amountCents: number;
  lines: { title: string; quantity: number; amountCents: number }[];
  shippingCents: number;
  /** danach vollständig erstattet */
  isFull: boolean;
  paymentLabel: string;
  /** manuelle Bestellung (Rechnung): Betrag wird überwiesen statt aufs Zahlungsmittel gebucht */
  manualTransfer?: boolean;
  isTest: boolean;
  entity: LegalEntity | null;
}

export function refundEmail(input: RefundEmailInput): RenderedEmail {
  const subject = `Erstattung zu deiner Bestellung ${input.orderNumber}`;
  const rows = [
    ...input.lines.map(
      (l) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.lineSoft};font-size:15px">${l.quantity} × ${escapeHtml(l.title)}</td><td style="padding:6px 0;border-bottom:1px solid ${C.lineSoft};text-align:right;font-size:15px">${formatEur(l.amountCents)}</td></tr>`,
    ),
    ...(input.shippingCents > 0
      ? [
          `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.lineSoft};font-size:15px">Versandkosten</td><td style="padding:6px 0;border-bottom:1px solid ${C.lineSoft};text-align:right;font-size:15px">${formatEur(input.shippingCents)}</td></tr>`,
        ]
      : []),
    `<tr><td style="padding:8px 0;font-size:18px;font-weight:700">Erstattet</td><td style="padding:8px 0;text-align:right;font-size:18px;font-weight:700">${formatEur(input.amountCents)}</td></tr>`,
  ].join("");
  const payout = input.manualTransfer
    ? "Wir überweisen dir den Betrag. Je nach Bank dauert es ein paar Werktage, bis du ihn siehst."
    : `Die Gutschrift geht auf dein ursprüngliches Zahlungsmittel (${input.paymentLabel}). Je nach Bank dauert es ein paar Werktage, bis du sie siehst.`;
  const body = `<h1 style="font-size:26px;font-weight:700;margin:0 0 12px">${input.isFull ? "Wir haben deine Bestellung erstattet." : "Wir haben dir einen Betrag erstattet."}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px">${escapeHtml(greeting(input.firstName))} zu deiner Bestellung <strong>${escapeHtml(input.orderNumber)}</strong> haben wir <strong>${formatEur(input.amountCents)}</strong> erstattet.</p>
<div style="background:${C.surface};border-radius:${EMAIL_RADIUS.box};padding:18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table></div>
<p style="font-size:15px;margin:16px 0 0">${escapeHtml(payout)}</p>
<p style="font-size:14px;line-height:1.6;margin:16px 0 0">Fragen? Antworte einfach auf diese E-Mail.</p>`;
  const text = [
    input.isFull
      ? "Wir haben deine Bestellung erstattet."
      : "Wir haben dir einen Betrag erstattet.",
    ``,
    `${greeting(input.firstName)} zu deiner Bestellung ${input.orderNumber} haben wir ${formatEur(input.amountCents)} erstattet.`,
    ...input.lines.map((l) => `${l.quantity} × ${l.title}: ${formatEur(l.amountCents)}`),
    ...(input.shippingCents > 0 ? [`Versandkosten: ${formatEur(input.shippingCents)}`] : []),
    `Erstattet: ${formatEur(input.amountCents)}`,
    ``,
    payout,
  ].join("\n");
  return { subject, html: layout(subject, body, input.entity, input.isTest), text };
}
