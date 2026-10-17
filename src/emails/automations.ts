import {
  button,
  emailLayout,
  escapeHtml,
  footer,
  heading,
  htmlToText,
  paragraph,
  productCard,
  type ImprintEntity,
  type ProductCardData,
} from "./components";
import type { RenderedMail } from "./campaign";

/**
 * Vorlagen der Automationen. Alle drei sind Werbung im Sinne von § 7 UWG und gehen nur an
 * Kontakte mit bestätigter Werbeeinwilligung (H20), deshalb immer mit Abmeldelink.
 * Keine Health-Claims über die bestehenden hinaus ("15 g Protein", "ohne Zucker").
 */

interface BaseInput {
  firstName?: string | null;
  entity: ImprintEntity | null;
  siteUrl: string;
  unsubscribeUrl: string;
  testBanner?: string | null;
  /** Optionaler Rabattcode aus der Automation (Backoffice, Konfiguration der Automation) */
  discountCode?: string | null;
}

function discountLine(input: BaseInput): string {
  return input.discountCode
    ? paragraph(`Dein Code: <strong>${escapeHtml(input.discountCode)}</strong>`)
    : "";
}

function hello(firstName?: string | null): string {
  return firstName ? `Hey ${escapeHtml(firstName)},` : "Hey,";
}

function wrap(subject: string, preheader: string, body: string, input: BaseInput): RenderedMail {
  const html = emailLayout({
    title: subject,
    preheader,
    bodyHtml: body,
    footerHtml: footer({
      entity: input.entity,
      reason: "Du erhältst diese E-Mail, weil du dem provibe Newsletter zugestimmt hast.",
      unsubscribeUrl: input.unsubscribeUrl,
      siteUrl: input.siteUrl,
    }),
    siteUrl: input.siteUrl,
    testBanner: input.testBanner,
  });
  return { subject, html, text: htmlToText(html) };
}

export function welcomeEmail(input: BaseInput): RenderedMail {
  const subject = "Willkommen bei provibe";
  const body =
    heading("Schön, dass du dabei bist.") +
    paragraph(
      `${hello(input.firstName)} danke für deine Anmeldung. Ab jetzt hörst du als Erstes von neuen Sorten, Aktionen und allem, was bei provibe passiert. Versprochen: kein Spam.`,
    ) +
    paragraph(
      "provibe ist Eistee mit 15 g Protein, ohne Zucker. Einfach kalt aus dem Kühlschrank, ganz ohne Shaker und Pulver.",
    ) +
    discountLine(input) +
    button("Sorten entdecken", `${input.siteUrl}/collections/all`);
  return wrap(subject, "Danke für deine Anmeldung zum provibe Newsletter.", body, input);
}

export interface AbandonedCartInput extends BaseInput {
  items: { title: string; quantity: number; variantTitle?: string | null }[];
  products?: ProductCardData[];
}

export function abandonedCartEmail(input: AbandonedCartInput): RenderedMail {
  const subject = "Dein Warenkorb wartet noch";
  const list = input.items
    .slice(0, 10)
    .map(
      (i) =>
        `<li style="margin:0 0 6px">${i.quantity} × ${escapeHtml(i.title)}${i.variantTitle ? ` (${escapeHtml(i.variantTitle)})` : ""}</li>`,
    )
    .join("");
  const body =
    heading("Noch Durst?") +
    paragraph(
      `${hello(input.firstName)} in deinem Warenkorb liegt noch etwas. Wir haben ihn für dich aufgehoben.`,
    ) +
    (list
      ? `<ul style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:1.5">${list}</ul>`
      : "") +
    (input.products ?? []).slice(0, 3).map(productCard).join("") +
    discountLine(input) +
    button("Zum Warenkorb", `${input.siteUrl}/cart`) +
    paragraph("Preise und Verfügbarkeit prüfen wir beim Bestellen noch einmal.", {
      muted: true,
      small: true,
    });
  return wrap(subject, "In deinem Warenkorb liegt noch etwas.", body, input);
}

export interface ReviewRequestInput extends BaseInput {
  orderNumber: string;
  reviewUrl: string;
  items: { title: string }[];
}

export function reviewRequestEmail(input: ReviewRequestInput): RenderedMail {
  const subject = "Wie schmeckt dir dein provibe?";
  const names = Array.from(new Set(input.items.map((i) => i.title))).slice(0, 5);
  const body =
    heading("Wie war dein Vibe?") +
    paragraph(
      `${hello(input.firstName)} deine Bestellung ${escapeHtml(input.orderNumber)} ist bei dir angekommen. Wir würden gern wissen, wie sie dir schmeckt.`,
    ) +
    (names.length ? paragraph(`Bewerten kannst du: ${names.map(escapeHtml).join(", ")}.`) : "") +
    button("Jetzt bewerten", input.reviewUrl) +
    paragraph(
      "Bewerten kann nur, wer das Produkt bei uns bestellt hat. Wir prüfen jede Bewertung vor der Veröffentlichung.",
      { muted: true, small: true },
    );
  return wrap(subject, `Deine Meinung zu Bestellung ${input.orderNumber}`, body, input);
}
