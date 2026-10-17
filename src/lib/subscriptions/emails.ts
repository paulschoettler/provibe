import { escapeHtml, type LegalEntity, type RenderedEmail } from "@/lib/checkout/emails";
import { formatEur } from "@/lib/money";
import { formatDay, formatDayTime } from "./schedule";

/**
 * Abo-Mails in Brand-Optik (Figma 73:1813, 73:1846, 73:1882), jeweils HTML und Textfassung.
 * Reine Funktionen ohne Datenbank (Vorschau im Backoffice, Tests). Kundendaten werden escaped.
 */

const C = {
  cream: "#FBF8EE",
  cream2: "#F3F1E7",
  aubergine: "#4A2F39",
  plum: "#7E2856",
  wine: "#6B1D49",
  magenta: "#D9306E",
  pink: "#F6DCEA",
  butter: "#F3EDA4",
  mauve: "#8A7680",
};

export interface AboMailBase {
  siteUrl: string;
  entity: LegalEntity | null;
  isTest: boolean;
  firstName: string | null;
}

export interface AboMailSubscription {
  number: string;
  productTitle: string;
  /** "9 Dosen" */
  variantTitle: string;
  quantity: number;
  intervalWeeks: number;
  /** Zahlbetrag je Lieferung inklusive Pfand, Versand und MwSt. */
  totalCents: number;
  depositCents: number;
  shippingCents: number;
  basePriceText: string | null;
  imageUrl: string | null;
}

function hi(base: AboMailBase, rest: string): string {
  const name = base.firstName?.trim();
  return name ? `Hi ${name}, ${rest}` : `Hi, ${rest}`;
}

function packLabel(s: AboMailSubscription): string {
  const pack = s.quantity > 1 ? `${s.quantity} × ${s.variantTitle}` : s.variantTitle;
  return `${pack} · alle ${s.intervalWeeks} Wochen`;
}

function priceLine(s: AboMailSubscription): string {
  const parts = [`inkl. ${formatEur(s.depositCents)} Pfand`];
  parts.push(s.shippingCents > 0 ? `${formatEur(s.shippingCents)} Versand` : "versandkostenfrei");
  return `${formatEur(s.totalCents)} je Lieferung (${parts.join(" und ")}, inkl. MwSt.)`;
}

function layout(input: {
  base: AboMailBase;
  subject: string;
  preview: string;
  body: string;
  footer?: boolean;
}): string {
  const { base } = input;
  const entity = base.entity;
  const imprint = entity
    ? [entity.name, entity.street, `${entity.zip} ${entity.city}`].map(escapeHtml).join(" · ")
    : "CG Projects UG (haftungsbeschränkt) · Kurt-Viermetz-Straße 1a · 86150 Augsburg";
  const testBanner = base.isTest
    ? `<p style="margin:0 0 16px;padding:8px 12px;background:${C.butter};border:1.5px solid ${C.aubergine};border-radius:12px;font-size:13px;font-weight:600">TEST (Testmodus, keine echte Zahlung)</p>`
    : "";
  const footer =
    input.footer === false
      ? ""
      : `<p style="margin:0 0 8px">Du bekommst diese E-Mail, weil du ein Abo bei PROVIBE hast. Kündigen geht jederzeit im Konto oder ohne Login unter <a href="${base.siteUrl}/abo-kuendigen" style="color:${C.mauve}">${escapeHtml(base.siteUrl.replace(/^https?:\/\//, ""))}/abo-kuendigen</a>.</p>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;background:${C.cream};font-family:Jost,Helvetica,Arial,sans-serif;color:${C.aubergine}">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preview)}</span>
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
${testBanner}
<p style="text-align:center;margin:0 0 28px;font-size:34px;font-weight:700;letter-spacing:-.02em;color:${C.wine}">provibe</p>
${input.body}
<div style="border-top:1px solid ${C.aubergine};margin-top:32px;padding-top:20px;text-align:center;font-size:12px;line-height:1.6;color:${C.mauve}">
${footer}<p style="margin:0">${imprint}</p>
</div></div></body></html>`;
}

function h1(text: string): string {
  return `<h1 style="font-size:28px;line-height:1.15;font-weight:700;margin:0 0 12px;color:${C.aubergine}">${escapeHtml(text)}</h1>`;
}

function p(html: string, small = false): string {
  return `<p style="font-size:${small ? 14 : 16}px;line-height:1.6;margin:0 0 16px">${html}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;background:${C.magenta};color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

function links(items: { href: string; label: string }[]): string {
  return `<p style="text-align:center;margin:0 0 20px">${items
    .map(
      (i) =>
        `<a href="${i.href}" style="color:${C.plum};font-weight:600;margin:0 10px">${escapeHtml(i.label)}</a>`,
    )
    .join("")}</p>`;
}

function productCard(s: AboMailSubscription, siteUrl: string): string {
  const img = s.imageUrl
    ? `<td style="width:84px;vertical-align:top;padding-right:16px"><img src="${siteUrl}${s.imageUrl}" width="72" alt="${escapeHtml(s.productTitle)}" style="display:block;width:72px;height:auto"></td>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.cream2};border-radius:22px;padding:20px;margin:8px 0 16px"><tr>${img}
<td style="vertical-align:top"><p style="margin:0 0 4px;font-size:20px;font-weight:600">${escapeHtml(s.productTitle)} im Abo</p>
<p style="margin:0 0 8px;font-size:14px">${escapeHtml(packLabel(s))} · ${escapeHtml(s.number)}</p>
<p style="margin:0 0 4px;font-size:17px;font-weight:700">${formatEur(s.totalCents)} je Lieferung</p>
<p style="margin:0;font-size:13px;color:${C.mauve}">inkl. ${formatEur(s.depositCents)} Pfand und ${s.shippingCents > 0 ? `${formatEur(s.shippingCents)} Versand` : "kostenlosem Versand"}, inkl. MwSt.${s.basePriceText ? ` · ${escapeHtml(s.basePriceText)}` : ""}</p></td></tr></table>`;
}

function table(rows: [string, string][], tone: "white" | "pink" = "white"): string {
  const bg = tone === "pink" ? C.pink : "#ffffff";
  const border = tone === "pink" ? `border:1.5px solid ${C.magenta};` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${bg};${border}border-radius:18px;padding:16px 20px;margin:8px 0 16px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:5px 12px 5px 0;font-size:14px;color:${C.plum};vertical-align:top;width:40%">${escapeHtml(k)}</td><td style="padding:5px 0;font-size:14px;font-weight:600;vertical-align:top">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function textRows(rows: [string, string][]): string {
  return rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}

function textFooter(base: AboMailBase): string {
  return `\n\nDu bekommst diese E-Mail, weil du ein Abo bei PROVIBE hast. Kündigen geht jederzeit im Konto oder ohne Login unter ${base.siteUrl}/abo-kuendigen.`;
}

/* ---------- 1. Abo gestartet ---------- */

export function subscriptionStartedEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: { nextDelivery: Date; orderNumber: string; paymentLabel: string; loginHint: boolean },
): RenderedEmail {
  const subject = `Dein Abo ${s.number} läuft`;
  const portal = `${base.siteUrl}/account/abo`;
  const rows: [string, string][] = [
    ["Abo", `${s.productTitle} · ${packLabel(s)} (${s.number})`],
    ["Preis je Lieferung", priceLine(s)],
    ["Erste Lieferung", `Bestellung ${input.orderNumber}, ist unterwegs`],
    [
      "Nächste Lieferung",
      `am ${formatDay(input.nextDelivery)}, danach alle ${s.intervalWeeks} Wochen`,
    ],
    ["Zahlart", input.paymentLabel],
    ["Laufzeit", "unbefristet, keine Mindestlaufzeit"],
    ["Kündigung", "jederzeit zum nächsten Liefertermin, im Konto oder ohne Login"],
  ];
  const body = `${h1(hi(base, "dein Abo läuft."))}
${p("Schön, dass du dabei bist. Die erste Lieferung ist schon unterwegs, danach liefern wir automatisch im gewählten Rhythmus.")}
${table(rows)}
${p(
  input.loginHint
    ? "Wir haben dir einen Link zu deinem Kundenkonto geschickt. Dort pausierst, änderst oder kündigst du dein Abo, ganz ohne Passwort."
    : "In deinem Kundenkonto pausierst, änderst oder kündigst du dein Abo jederzeit.",
  true,
)}
${button(portal, "Abo verwalten")}
${p("Preisänderungen kündigen wir dir mindestens vier Wochen vorher per E-Mail an. Bis dahin kannst du kündigen.", true)}`;
  const text = `${hi(base, "dein Abo läuft.")}\n\n${textRows(rows)}\n\nAbo verwalten: ${portal}\n\nPreisänderungen kündigen wir dir mindestens vier Wochen vorher per E-Mail an.${textFooter(base)}`;
  return {
    subject,
    html: layout({
      base,
      subject,
      preview: `Nächste Lieferung am ${formatDay(input.nextDelivery)}.`,
      body,
    }),
    text,
  };
}

/* ---------- 2. Erinnerung: nächste Lieferung ---------- */

export function nextDeliveryEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: {
    deliveryDate: Date;
    daysBefore: number;
    addressLine: string;
    paymentLabel: string;
    subscriptionId: string;
  },
): RenderedEmail {
  const day = formatDay(input.deliveryDate);
  const subject = `Deine nächste Lieferung kommt am ${day}`;
  const detail = `${base.siteUrl}/account/abo/${input.subscriptionId}`;
  const body = `${h1(hi(base, "Nachschub kommt."))}
${p(`In ${input.daysBefore} Tagen, am ${day}, schicken wir dir deine nächste Lieferung. Passt alles? Dann musst du nichts tun.`)}
${productCard(s, base.siteUrl)}
${button(detail, "Lieferung ändern")}
${links([
  { href: `${detail}?aktion=ueberspringen`, label: "Diese Lieferung überspringen" },
  { href: `${detail}?aktion=pausieren`, label: "Abo pausieren" },
])}
${p(`Lieferadresse: ${escapeHtml(input.addressLine)}. Abbuchung von ${escapeHtml(input.paymentLabel)} am Liefertag.`, true)}`;
  const text = `${hi(base, "Nachschub kommt.")}\n\nAm ${day} schicken wir dir deine nächste Lieferung: ${s.productTitle}, ${packLabel(s)} (${s.number}).\n${priceLine(s)}\n\nÄndern, überspringen oder pausieren: ${detail}\n\nLieferadresse: ${input.addressLine}\nAbbuchung von ${input.paymentLabel} am Liefertag.${textFooter(base)}`;
  return {
    subject,
    html: layout({
      base,
      subject,
      preview: `Noch ${input.daysBefore} Tage: überspringen oder ändern geht bis dahin.`,
      body,
    }),
    text,
  };
}

/* ---------- 3. Zahlung fehlgeschlagen ---------- */

export function paymentFailedEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: {
    paymentLabel: string;
    dueSince: Date;
    retryDates: Date[];
    paused: boolean;
    subscriptionId: string;
  },
): RenderedEmail {
  const subject = input.paused
    ? "Dein Abo ist pausiert: Zahlung offen"
    : "Deine Zahlung hat nicht geklappt";
  const link = `${base.siteUrl}/account/abo/${input.subscriptionId}#zahlungsmittel`;
  const retry =
    input.retryDates.length === 0
      ? "kein weiterer Versuch"
      : input.retryDates.map((d) => formatDay(d)).join(", danach ");
  const intro = input.paused
    ? `Wir konnten die Lieferung auch beim letzten Versuch nicht von deiner Zahlungsart ${escapeHtml(input.paymentLabel)} abbuchen. Deshalb haben wir dein Abo pausiert. Hinterleg ein neues Zahlungsmittel, dann schicken wir sofort los.`
    : `Wir konnten die Lieferung nicht von deiner Zahlungsart ${escapeHtml(input.paymentLabel)} abbuchen. Klappt es auch beim letzten Versuch nicht, pausieren wir dein Abo, bis du ein neues Zahlungsmittel hinterlegst.`;
  const rows: [string, string][] = [
    ["Offen", priceLine(s)],
    ["Lieferung", `${s.productTitle} · ${packLabel(s)}`],
    ["Fällig seit", formatDay(input.dueSince)],
    ...(input.paused ? [] : ([["Nächster Versuch", retry]] as [string, string][])),
  ];
  const body = `${h1(hi(base, "da hat was nicht geklappt."))}
${p(intro)}
${table(rows, "pink")}
${button(link, "Zahlungsmittel aktualisieren")}
${p(`Fragen? Antworte einfach auf diese E-Mail${base.entity?.email ? ` oder schreib an ${escapeHtml(base.entity.email)}` : ""}.`, true)}`;
  const text = `${hi(base, "da hat was nicht geklappt.")}\n\n${intro.replace(/<[^>]+>/g, "")}\n\n${textRows(rows)}\n\nZahlungsmittel aktualisieren: ${link}${textFooter(base)}`;
  return {
    subject,
    html: layout({
      base,
      subject,
      preview: "Aktualisier dein Zahlungsmittel, dann schicken wir sofort los.",
      body,
    }),
    text,
  };
}

/* ---------- 4. Bestätigung der Zahlung nötig (3-D Secure) ---------- */

export function authenticationRequiredEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: { subscriptionId: string; dueDate: Date },
): RenderedEmail {
  const subject = "Bitte bestätige deine Abo-Zahlung";
  const link = `${base.siteUrl}/account/abo/${input.subscriptionId}#zahlung-bestaetigen`;
  const body = `${h1(hi(base, "deine Bank möchte eine Bestätigung."))}
${p(`Für deine Lieferung vom ${formatDay(input.dueDate)} verlangt deine Bank eine kurze Bestätigung (3-D Secure). Sobald du bestätigst, buchen wir ab und schicken los.`)}
${productCard(s, base.siteUrl)}
${button(link, "Zahlung bestätigen")}
${p("Bis zur Bestätigung halten wir die Dosen für dich zurück, längstens sieben Tage.", true)}`;
  const text = `${hi(base, "deine Bank möchte eine Bestätigung.")}\n\nFür deine Lieferung vom ${formatDay(input.dueDate)} verlangt deine Bank eine kurze Bestätigung (3-D Secure).\n${s.productTitle}, ${packLabel(s)}: ${priceLine(s)}\n\nZahlung bestätigen: ${link}${textFooter(base)}`;
  return {
    subject,
    html: layout({ base, subject, preview: "Ein Klick in deinem Konto genügt.", body }),
    text,
  };
}

/* ---------- 5. Abo gekündigt (Portal oder zugeordnete Kündigung ohne Login) ---------- */

export function subscriptionCancelledEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: {
    receivedAt: Date;
    effectiveAt: Date;
    immediate: boolean;
    lastOrder: { number: string; date: Date } | null;
    reason?: string | null;
  },
): RenderedEmail {
  const subject = input.immediate ? "Dein Abo ist gekündigt" : "Deine Kündigung ist eingegangen";
  const effective = input.immediate
    ? input.effectiveAt.getTime() - input.receivedAt.getTime() < 60_000
      ? "sofort"
      : `zum ${formatDay(input.effectiveAt)}, keine weitere Lieferung`
    : `zum ${formatDay(input.effectiveAt)}, bis dahin liefern wir wie gewohnt`;
  const rows: [string, string][] = [
    ["Abo", `${s.productTitle} · ${packLabel(s)} (${s.number})`],
    ["Eingegangen am", formatDayTime(input.receivedAt)],
    ["Wirksam", effective],
    ...(input.lastOrder
      ? ([
          ["Letzte Lieferung", `${input.lastOrder.number} vom ${formatDay(input.lastOrder.date)}`],
        ] as [string, string][])
      : []),
    ["Weitere Abbuchungen", input.immediate ? "keine" : `keine ab ${formatDay(input.effectiveAt)}`],
  ];
  const title = input.immediate ? "Dein Abo ist gekündigt." : "Deine Kündigung ist da.";
  const name = base.firstName?.trim();
  const body = `${h1(name ? `Schade, ${name}. ${title}` : `Schade. ${title}`)}
${p("Hiermit bestätigen wir den Eingang deiner Kündigung. Du musst nichts weiter tun.")}
${table(rows)}
${p("Bitte heb diese E-Mail als Nachweis auf. Bereits bezahlte Lieferungen kommen wie geplant an.", true)}
${button(`${base.siteUrl}/collections/all`, "Doch wieder Lust? Zum Shop")}`;
  const text = `${name ? `Schade, ${name}. ` : "Schade. "}${title}\n\nHiermit bestätigen wir den Eingang deiner Kündigung.\n\n${textRows(rows)}\n\nBitte heb diese E-Mail als Nachweis auf.${textFooter(base)}`;
  return {
    subject,
    html: layout({
      base,
      subject,
      preview: `Bestätigung deiner Kündigung vom ${formatDay(input.receivedAt)}.`,
      body,
    }),
    text,
  };
}

/* ---------- 6. Eingangsbestätigung der Kündigung ohne Login (§ 312k BGB) ---------- */

export interface CancellationReceipt {
  name: string;
  email: string;
  subscriptionNumber: string | null;
  kind: "ordinary" | "extraordinary";
  reason: string | null;
  timing: "next_possible" | "date";
  desiredDay: string | null;
  receivedAt: Date;
  requestId: string;
}

export function cancellationRows(r: CancellationReceipt): [string, string][] {
  return [
    ["Name", r.name],
    ["E-Mail", r.email],
    ["Abo-Nummer", r.subscriptionNumber || "nicht angegeben"],
    [
      "Art der Kündigung",
      r.kind === "ordinary" ? "Ordentliche Kündigung" : "Außerordentliche Kündigung",
    ],
    ...(r.kind === "extraordinary" && r.reason
      ? ([["Grund", r.reason]] as [string, string][])
      : []),
    [
      "Gewünschter Zeitpunkt",
      r.timing === "date" && r.desiredDay
        ? `zum ${formatDay(`${r.desiredDay}T12:00:00Z`)}`
        : "zum nächstmöglichen Zeitpunkt",
    ],
    ["Eingegangen am", formatDayTime(r.receivedAt)],
    ["Vorgangsnummer", r.requestId.slice(0, 8).toUpperCase()],
  ];
}

/**
 * Eingangsbestätigung in Textform an die angegebene Adresse. Sie wiederholt die Erklärung mit
 * Datum und Uhrzeit. Zugeordnete Abos (matched) werden genannt; ohne Treffer bleibt der Text
 * allgemein, die Erklärung ist trotzdem eingegangen und wird von uns geprüft.
 */
export function cancellationReceiptEmail(
  base: AboMailBase,
  r: CancellationReceipt,
  matched: { number: string; label: string; effective: string }[],
): RenderedEmail {
  const subject = "Eingangsbestätigung deiner Kündigung";
  const rows = cancellationRows(r);
  const matchedHtml =
    matched.length > 0
      ? table(
          matched.map((m) => [m.number, `${m.label}, wirksam ${m.effective}`] as [string, string]),
        )
      : "";
  const matchedText =
    matched.length > 0
      ? `\n\nGekündigt:\n${matched.map((m) => `${m.number}: ${m.label}, wirksam ${m.effective}`).join("\n")}`
      : "";
  const followUp =
    matched.length > 0
      ? "Ab dem genannten Zeitpunkt buchen wir nichts mehr ab. Lieferungen, die schon unterwegs sind, kommen noch an."
      : "Wir ordnen deine Kündigung jetzt deinem Vertrag zu. Falls wir dafür noch etwas brauchen, melden wir uns bei dir.";
  const body = `${h1("Deine Kündigung ist bei uns eingegangen.")}
${p("Hiermit bestätigen wir den Eingang deiner Kündigungserklärung, die du über unsere Website abgegeben hast:")}
${table(rows)}
${matchedHtml}
${p(followUp)}
${p("Bitte heb diese E-Mail als Nachweis auf.", true)}`;
  const text = `Deine Kündigung ist bei uns eingegangen.\n\nHiermit bestätigen wir den Eingang deiner Kündigungserklärung:\n\n${textRows(rows)}${matchedText}\n\n${followUp}\n\nBitte heb diese E-Mail als Nachweis auf.${textFooter(base)}`;
  return {
    subject,
    html: layout({
      base,
      subject,
      preview: `Eingegangen am ${formatDayTime(r.receivedAt)}.`,
      body,
    }),
    text,
  };
}

/** Interne Meldung an den Support: Kündigung ohne Login, mit oder ohne Treffer. */
export function cancellationInternalEmail(
  base: AboMailBase,
  r: CancellationReceipt,
  matchedNumbers: string[],
): RenderedEmail {
  const subject = `${base.isTest ? "[TEST] " : ""}Abo-Kündigung ohne Login${matchedNumbers.length === 0 ? ": bitte prüfen" : ""}`;
  const rows: [string, string][] = [
    ...cancellationRows(r),
    [
      "Zugeordnet",
      matchedNumbers.length > 0 ? matchedNumbers.join(", ") : "kein passendes Abo gefunden",
    ],
  ];
  const body = `${h1(subject)}${table(rows)}${p(
    matchedNumbers.length === 0
      ? "Die Erklärung ist wirksam eingegangen und der Kunde hat eine Eingangsbestätigung. Bitte das Abo manuell zuordnen und kündigen."
      : "Die genannten Abos wurden automatisch gekündigt.",
    true,
  )}`;
  return {
    subject,
    html: layout({ base, subject, preview: subject, body, footer: false }),
    text: textRows(rows),
  };
}

/* ---------- 7. Preisankündigung ---------- */

export function priceNoticeEmail(
  base: AboMailBase,
  s: AboMailSubscription,
  input: {
    oldTotalCents: number;
    newTotalCents: number;
    effectiveAt: Date;
    subscriptionId: string;
  },
): RenderedEmail {
  const subject = `Preisänderung in deinem Abo ab ${formatDay(input.effectiveAt)}`;
  const rows: [string, string][] = [
    ["Abo", `${s.productTitle} · ${packLabel(s)} (${s.number})`],
    ["Bisher je Lieferung", formatEur(input.oldTotalCents)],
    ["Neu je Lieferung", `${formatEur(input.newTotalCents)} (inkl. Pfand, Versand und MwSt.)`],
    ["Gilt ab", `Lieferungen ab ${formatDay(input.effectiveAt)}`],
  ];
  const body = `${h1(hi(base, "wir müssen unseren Preis anpassen."))}
${p("Wir sagen dir rechtzeitig Bescheid: Für dein Abo ändert sich der Preis. Bis zum genannten Tag bleibt alles beim Alten.")}
${table(rows)}
${p("Du bist damit nicht einverstanden? Du kannst dein Abo jederzeit vorher kündigen, im Konto oder ohne Login.", true)}
${button(`${base.siteUrl}/account/abo/${input.subscriptionId}`, "Abo ansehen")}`;
  const text = `${hi(base, "wir müssen unseren Preis anpassen.")}\n\n${textRows(rows)}\n\nDu kannst dein Abo jederzeit vorher kündigen: ${base.siteUrl}/abo-kuendigen${textFooter(base)}`;
  return {
    subject,
    html: layout({ base, subject, preview: "Bis dahin bleibt alles beim Alten.", body }),
    text,
  };
}
