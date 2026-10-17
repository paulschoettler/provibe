import { abandonedCartEmail, reviewRequestEmail, welcomeEmail } from "./automations";
import { renderCampaignEmail, type CampaignBlock, type RenderedMail } from "./campaign";
import type { ImprintEntity, ProductCardData } from "./components";

/**
 * Register der CRM-Vorlagen (Schlüssel wie in email_templates). Die transaktionalen Vorlagen des
 * Checkouts (src/lib/checkout/emails.ts) und des Kontos (src/lib/auth/mails.ts) liegen dort und
 * werden hier nicht dupliziert.
 */

export const CRM_TEMPLATE_KEYS = [
  "newsletter_campaign",
  "newsletter_welcome",
  "abandoned_cart",
  "review_request",
] as const;

export type CrmTemplateKey = (typeof CRM_TEMPLATE_KEYS)[number];

export function isCrmTemplateKey(key: string): key is CrmTemplateKey {
  return (CRM_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export interface TemplateContext {
  entity: ImprintEntity | null;
  siteUrl: string;
  imageBaseUrl: string;
  unsubscribeUrl: string;
  testBanner?: string | null;
}

const SAMPLE_PRODUCT: ProductCardData = {
  title: "Peach",
  line: "Eistee mit 15 g Protein · 0,33 l",
  priceLine: "9 Dosen 26,10 €",
  detailLine: "inkl. 2,25 € Pfand · Grundpreis 8,03 € / l (ohne Pfand)",
  imageUrl: null,
  url: "/products/peach",
};

const SAMPLE_BLOCKS: CampaignBlock[] = [
  {
    id: "t1",
    type: "text",
    heading: "Peach ist zurück.",
    body: "Unsere Sorte Peach ist wieder verfügbar: 15 g Protein, ohne Zucker, am besten eiskalt.",
  },
  { id: "p1", type: "product", productHandle: "peach" },
  { id: "b1", type: "button", label: "Jetzt entdecken", href: "/products/peach" },
  { id: "d1", type: "divider" },
];

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Vorlage mit Props rendern (Vorschau im Backoffice, Versand der Automationen).
 * Fehlende Props werden mit Beispielwerten gefüllt, damit die Vorschau immer etwas zeigt.
 */
export function renderCrmTemplate(
  key: CrmTemplateKey,
  props: Record<string, unknown>,
  ctx: TemplateContext,
): RenderedMail {
  const base = {
    firstName: str(props.first_name) ?? str(props.firstName) ?? null,
    entity: ctx.entity,
    siteUrl: ctx.siteUrl,
    unsubscribeUrl: ctx.unsubscribeUrl,
    testBanner: ctx.testBanner,
  };
  const sampleProduct = { ...SAMPLE_PRODUCT, url: `${ctx.siteUrl}${SAMPLE_PRODUCT.url}` };
  switch (key) {
    case "newsletter_campaign":
      return renderCampaignEmail({
        subject: str(props.subject) ?? "Peach ist zurück",
        preheader: str(props.preheader) ?? "15 g Protein, ohne Zucker.",
        blocks: Array.isArray(props.blocks) ? (props.blocks as CampaignBlock[]) : SAMPLE_BLOCKS,
        products: { peach: sampleProduct },
        entity: ctx.entity,
        siteUrl: ctx.siteUrl,
        imageBaseUrl: ctx.imageBaseUrl,
        unsubscribeUrl: ctx.unsubscribeUrl,
        testBanner: ctx.testBanner,
      });
    case "newsletter_welcome":
      return welcomeEmail(base);
    case "abandoned_cart":
      return abandonedCartEmail({
        ...base,
        items: Array.isArray(props.items)
          ? (props.items as { title: string; quantity: number; variantTitle?: string }[])
          : [
              { title: "Peach Eistee", quantity: 1, variantTitle: "9 Dosen" },
              { title: "Wildberry Eistee", quantity: 1, variantTitle: "12 Dosen" },
            ],
      });
    case "review_request":
      return reviewRequestEmail({
        ...base,
        orderNumber: str(props.order_number) ?? "PV-10001",
        reviewUrl: str(props.review_url) ?? `${ctx.siteUrl}/bewerten?token=beispiel`,
        items: Array.isArray(props.items)
          ? (props.items as { title: string }[])
          : [{ title: "Peach Eistee" }],
      });
  }
}

export type { RenderedMail, CampaignBlock };
export { renderCampaignEmail } from "./campaign";
export { welcomeEmail, abandonedCartEmail, reviewRequestEmail } from "./automations";
