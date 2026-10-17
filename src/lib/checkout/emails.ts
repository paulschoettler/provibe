import { publicEnv } from "@/lib/env/public";
import { formatEur } from "@/lib/money";
import { EMAIL_COLORS as C, EMAIL_FONT, EMAIL_RADIUS, emailLogo } from "@/emails/components";
import { deliveryWindow, formatDeliveryWindow, formatGermanDate } from "./delivery";
import { lineAmounts, type OrderView } from "./order-view";
import { formatAddressLines } from "./snapshot";

/**
 * HTML- und Textfassungen der Checkout-Mails. Reine Funktionen ohne Datenbank, damit sie im
 * Backoffice als Vorschau und in Tests nutzbar sind. Kundendaten werden immer escaped; die
 * Rechtstexte kommen aus legal_document_versions (eigene, im Backoffice gepflegte Inhalte).
 */

export interface LegalEntity {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone?: string;
  vat_id?: string;
  register?: string;
  managing_director?: string;
}

/** Optionen für den Versand der Bestellbestätigung (siehe post-order.ts). */
export interface OrderConfirmationSendOptions {
  /**
   * Erneut senden (Backoffice "Mail erneut senden"): Der Idempotenz-Schlüssel bekommt einen
   * Zeitstempel, sonst verwirft Resend einen zweiten Versand innerhalb von 24 Stunden still.
   */
  force?: boolean;
}

/**
 * Idempotenz-Schlüssel der Bestellbestätigung. Ohne force stabil je Bestellung (Job-Retries
 * senden nie doppelt), mit force eindeutig je Aufruf.
 */
export function orderConfirmationIdempotencyKey(
  orderId: string,
  options: OrderConfirmationSendOptions = {},
  now: number = Date.now(),
): string {
  const base = `order_confirmation:${orderId}`;
  return options.force ? `${base}:erneut:${now}` : base;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function row(label: string, value: string, strong = false): string {
  const weight = strong ? "font-weight:700;font-size:18px" : "font-size:15px";
  return `<tr><td style="padding:4px 0;${weight}">${label}</td><td style="padding:4px 0;text-align:right;${weight}">${value}</td></tr>`;
}

function summaryTable(order: OrderView): string {
  const items = order.items
    .map((i) => ({ i, a: lineAmounts(i) }))
    .map(
      ({ i, a }) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.lineSoft};font-size:15px"><strong>${escapeHtml(i.title)}</strong><br>
<span style="font-size:13px">${escapeHtml(i.description)}</span><br>
<span style="font-size:13px">Menge ${i.quantity}${a.depositCents > 0 ? ` · zzgl. ${formatEur(a.depositCents)} Pfand` : ""}${i.basePriceText ? ` · ${escapeHtml(i.basePriceText)}` : ""}</span></td>
<td style="padding:8px 0;border-bottom:1px solid ${C.lineSoft};text-align:right;font-size:15px;font-weight:700;vertical-align:top">${formatEur(a.goodsCents)}</td></tr>`,
    )
    .join("");
  const tax = order.taxLines
    .map((t) => `${formatEur(t.taxCents)} MwSt. (${t.rateBp / 100} %)`)
    .join(", ");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${items}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:12px">
${row("Zwischensumme (ohne Pfand)", formatEur(order.subtotalCents))}
${order.discountCents > 0 ? row(`Rabatt${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ""}`, `−${formatEur(order.discountCents)}`) : ""}
${order.depositCents > 0 ? row(escapeHtml(order.depositLabel), formatEur(order.depositCents)) : ""}
${row(`Versand (${escapeHtml(order.shippingName)})`, order.shippingFree ? "kostenlos" : formatEur(order.shippingCents))}
${row("Lieferzeit", escapeHtml(order.deliveryTimeText))}
${row("Gesamt", formatEur(order.totalCents), true)}
</table>
<p style="font-size:13px;margin:4px 0 0">Zahlbetrag inkl. Pfand und MwSt. (darin ${tax || `${formatEur(order.taxCents)} MwSt.`})</p>`;
}

function addressBlock(title: string, lines: string[]): string {
  return `<p style="font-size:15px;font-weight:700;margin:16px 0 4px">${title}</p><p style="font-size:14px;line-height:1.5;margin:0">${lines.map(escapeHtml).join("<br>")}</p>`;
}

export function orderConfirmationEmail(
  order: OrderView,
  legal: {
    agb?: { title: string; bodyHtml: string };
    widerruf?: { title: string; bodyHtml: string };
  },
  entity: LegalEntity | null,
  siteUrl: string,
): RenderedEmail {
  const placed = new Date(order.placedAt);
  const window = formatDeliveryWindow(deliveryWindow(placed));
  const subject = `Deine Bestellung ${order.orderNumber} bei provibe`;
  const legalSections = [legal.agb, legal.widerruf]
    .filter((l): l is { title: string; bodyHtml: string } => Boolean(l))
    .map(
      (l) =>
        `<div style="margin-top:28px;padding-top:20px;border-top:2px solid ${C.text}"><h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(l.title)}</h2><div style="font-size:13px;line-height:1.6">${l.bodyHtml}</div></div>`,
    )
    .join("");

  const body = `<h1 style="font-size:28px;line-height:1.1;font-weight:700;margin:0 0 12px">Danke, dein Vibe ist unterwegs!</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 20px">Wir haben deine Bestellung <strong>${escapeHtml(order.orderNumber)}</strong> vom ${formatGermanDate(deliveryWindow(placed).orderDate)} erhalten und packen schon. Diese E-Mail ist deine Bestellbestätigung.</p>
<div style="background:${C.surface};border-radius:${EMAIL_RADIUS.box};padding:18px">${summaryTable(order)}</div>
<p style="font-size:15px;margin:16px 0 0"><strong>Zustellung voraussichtlich:</strong> ${window}</p>
${addressBlock("Lieferadresse", formatAddressLines(order.shippingAddress))}
${addressBlock("Rechnungsadresse", order.billingAddress ? formatAddressLines(order.billingAddress) : ["wie Lieferadresse"])}
<p style="font-size:15px;font-weight:700;margin:16px 0 4px">Zahlart</p><p style="font-size:14px;margin:0">${escapeHtml(order.paymentLabel)}</p>
<p style="font-size:14px;line-height:1.6;margin:24px 0 0">Du kannst den Vertrag innerhalb von 14 Tagen widerrufen, Details stehen in der Widerrufsbelehrung unten. Am schnellsten geht es über <a href="${siteUrl}/pages/widerruf-formular" style="color:${C.text};font-weight:700">Vertrag widerrufen</a>. Fragen? Antworte einfach auf diese E-Mail.</p>
<p style="font-size:13px;line-height:1.6;margin:16px 0 0">Unten findest du unsere AGB und die Widerrufsbelehrung in der Fassung, die bei deiner Bestellung galt.</p>
${legalSections}`;

  const text = [
    `Danke, dein Vibe ist unterwegs!`,
    ``,
    `Bestellung ${order.orderNumber}`,
    ...order.items.map((i) => {
      const a = lineAmounts(i);
      return `${i.quantity} × ${i.title} (${i.description}): ${formatEur(a.goodsCents)}${
        a.depositCents > 0 ? ` zzgl. ${formatEur(a.depositCents)} Pfand` : ""
      }`;
    }),
    `Zwischensumme (ohne Pfand): ${formatEur(order.subtotalCents)}`,
    ...(order.discountCents > 0 ? [`Rabatt: −${formatEur(order.discountCents)}`] : []),
    ...(order.depositCents > 0 ? [`${order.depositLabel}: ${formatEur(order.depositCents)}`] : []),
    `Versand: ${order.shippingFree ? "kostenlos" : formatEur(order.shippingCents)}`,
    `Gesamt: ${formatEur(order.totalCents)} (Zahlbetrag inkl. Pfand und MwSt., darin ${formatEur(order.taxCents)} MwSt.)`,
    `Zustellung voraussichtlich: ${window}`,
    ``,
    `Lieferadresse: ${formatAddressLines(order.shippingAddress).join(", ")}`,
    `Zahlart: ${order.paymentLabel}`,
    ``,
    `AGB und Widerrufsbelehrung findest du in der HTML-Fassung dieser E-Mail sowie unter ${siteUrl}/pages/allgemeine-geschaftsbedingungen und ${siteUrl}/pages/ruckgabe-und-wiederrufsbelehrung.`,
  ].join("\n");

  return { subject, html: layout(subject, body, entity, order.isTest), text };
}

export function paymentConfirmationEmail(
  order: OrderView,
  entity: LegalEntity | null,
): RenderedEmail {
  const subject = `Zahlung erhalten: ${order.orderNumber}`;
  const body = `<h1 style="font-size:26px;font-weight:700;margin:0 0 12px">Zahlung erhalten.</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px">Für deine Bestellung <strong>${escapeHtml(order.orderNumber)}</strong> ist die Zahlung über <strong>${formatEur(order.totalCents)}</strong> eingegangen.</p>
<p style="font-size:15px;margin:0">Zahlart: ${escapeHtml(order.paymentLabel)}</p>
<p style="font-size:14px;line-height:1.6;margin:16px 0 0">Die Rechnung schicken wir dir separat als PDF.</p>`;
  const text = `Zahlung erhalten.\n\nBestellung ${order.orderNumber}: ${formatEur(order.totalCents)}\nZahlart: ${order.paymentLabel}\n\nDie Rechnung schicken wir dir separat als PDF.`;
  return { subject, html: layout(subject, body, entity, order.isTest), text };
}

export function internalNotificationEmail(order: OrderView, siteUrl: string): RenderedEmail {
  const subject = `${order.isTest ? "[TEST] " : ""}Neue Bestellung ${order.orderNumber} über ${formatEur(order.totalCents)}`;
  const body = `<h1 style="font-size:22px;font-weight:700;margin:0 0 12px">Neue Bestellung ${escapeHtml(order.orderNumber)}</h1>
<p style="font-size:15px;margin:0 0 12px">${escapeHtml(order.email)} · ${escapeHtml(order.paymentLabel)}</p>
<div style="background:${C.surface};border-radius:${EMAIL_RADIUS.box};padding:18px">${summaryTable(order)}</div>
${addressBlock("Lieferadresse", formatAddressLines(order.shippingAddress))}
<p style="margin:20px 0 0"><a href="${siteUrl}/admin/bestellungen/${order.id}" style="color:${C.text};font-weight:700">Im Backoffice öffnen</a></p>`;
  const text = `Neue Bestellung ${order.orderNumber}\n${order.email}\nGesamt: ${formatEur(order.totalCents)}\n${siteUrl}/admin/bestellungen/${order.id}`;
  return { subject, html: layout(subject, body, null, order.isTest), text };
}
