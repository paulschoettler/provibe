import { z } from "zod";
import {
  button,
  divider,
  emailLayout,
  escapeHtml,
  footer,
  heading,
  htmlToText,
  image,
  paragraph,
  productCard,
  safeUrl,
  textParagraphs,
  type ImprintEntity,
  type ProductCardData,
} from "./components";

/**
 * Newsletter-Kampagne aus Blöcken des Editors (Text, Bild, Produkt, Button, Trenner).
 * Der Fuß mit Abmeldelink und Impressum-Kurzfassung ist Pflicht und kein Block (§ 7 UWG, § 5 DDG).
 */

const id = z.string().trim().min(1).max(40);
const urlOrPath = z
  .string()
  .trim()
  .min(1, "Bitte gib einen Link ein.")
  .max(2000)
  .refine(
    (v) => /^https?:\/\//i.test(v) || /^mailto:/i.test(v) || v.startsWith("/"),
    "Link muss mit https://, mailto: oder / beginnen.",
  );

export const campaignBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id,
    type: z.literal("text"),
    heading: z.string().trim().max(160).optional().default(""),
    body: z.string().max(10_000).default(""),
  }),
  z.object({
    id,
    type: z.literal("image"),
    /** https-URL, /pfad der Site oder Storage-Pfad im Bucket media */
    src: z.string().trim().min(1, "Bitte wähle ein Bild.").max(2000),
    alt: z.string().trim().min(1, "Alt-Text ist Pflicht (Barrierefreiheit).").max(300),
    href: urlOrPath.optional(),
  }),
  z.object({
    id,
    type: z.literal("product"),
    productHandle: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Bitte wähle ein Produkt."),
    variantId: z.string().uuid().optional(),
  }),
  z.object({
    id,
    type: z.literal("button"),
    label: z.string().trim().min(1, "Bitte gib eine Beschriftung ein.").max(60),
    href: urlOrPath,
  }),
  z.object({ id, type: z.literal("divider") }),
]);

export const campaignBlocksSchema = z.array(campaignBlockSchema).max(60, "Höchstens 60 Blöcke.");

export type CampaignBlock = z.infer<typeof campaignBlockSchema>;

export interface CampaignRenderInput {
  subject: string;
  preheader?: string | null;
  blocks: CampaignBlock[];
  /** Aufgelöste Produktdaten je Handle (bzw. "handle:variantId") */
  products: Record<string, ProductCardData>;
  entity: ImprintEntity | null;
  siteUrl: string;
  /** Basis für Storage-Pfade, z.B. https://<ref>.supabase.co/storage/v1/object/public/media */
  imageBaseUrl: string;
  unsubscribeUrl: string;
  /** Zusatz oben, z.B. "TESTVERSAND" */
  testBanner?: string | null;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export function resolveImageSrc(src: string, siteUrl: string, imageBaseUrl: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${siteUrl.replace(/\/$/, "")}${src}`;
  return `${imageBaseUrl.replace(/\/$/, "")}/${src.replace(/^\/+/, "")}`;
}

export function productKey(handle: string, variantId?: string): string {
  return variantId ? `${handle}:${variantId}` : handle;
}

function renderBlock(block: CampaignBlock, input: CampaignRenderInput): string {
  switch (block.type) {
    case "text": {
      const head = block.heading ? heading(block.heading, 1) : "";
      const body = textParagraphs(block.body)
        .map((p) => paragraph(p))
        .join("");
      return head + body;
    }
    case "image":
      return image(
        resolveImageSrc(block.src, input.siteUrl, input.imageBaseUrl),
        block.alt,
        block.href ? safeUrl(block.href, input.siteUrl) : undefined,
      );
    case "product": {
      const data =
        input.products[productKey(block.productHandle, block.variantId)] ??
        input.products[block.productHandle];
      // Unbekanntes oder archiviertes Produkt: lieber weglassen als falsche Preise zeigen
      return data ? productCard(data) : "";
    }
    case "button":
      return button(block.label, safeUrl(block.href, input.siteUrl));
    case "divider":
      return divider();
  }
}

/** Kampagne als HTML und Text rendern, mit Pflichtfuß. Rein, ohne Datenbank. */
export function renderCampaignEmail(input: CampaignRenderInput): RenderedMail {
  const body = input.blocks.map((b) => renderBlock(b, input)).join("\n");
  const html = emailLayout({
    title: input.subject,
    preheader: input.preheader,
    bodyHtml: body,
    footerHtml: footer({
      entity: input.entity,
      reason: "Du erhältst diese E-Mail, weil du den provibe Newsletter bestätigt hast.",
      unsubscribeUrl: input.unsubscribeUrl,
      siteUrl: input.siteUrl,
    }),
    siteUrl: input.siteUrl,
    testBanner: input.testBanner,
  });
  return { subject: input.subject, html, text: htmlToText(html) };
}

/** Kurzfassung eines Blocks für die Aufbau-Liste des Editors. */
export function blockLabel(block: CampaignBlock): string {
  switch (block.type) {
    case "text":
      return block.heading ? `Text: ${block.heading}` : "Text";
    case "image":
      return `Bild: ${block.alt}`;
    case "product":
      return `Produkt: ${block.productHandle}`;
    case "button":
      return `Button: ${block.label}`;
    case "divider":
      return "Trenner";
  }
}

export { escapeHtml };
