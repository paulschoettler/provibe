import "server-only";
import { listProducts } from "@/lib/catalog/products";
import {
  renderCampaignEmail,
  productKey,
  type CampaignBlock,
  type RenderedMail,
} from "@/emails/campaign";
import type { ProductCardData } from "@/emails/components";
import { imageBaseUrl, loadImprint, siteUrl, unsubscribeUrlFor } from "@/lib/admin/emails/context";
import { toProductCard } from "./product-card";

/**
 * Kampagne serverseitig rendern: Produktblöcke mit aktuellen Katalogpreisen, Impressum aus den
 * Einstellungen, Abmeldelink des Empfängers. Für den Versand wird einmal mit Platzhalter gerendert
 * und das Token je Empfänger eingesetzt (UNSUBSCRIBE_PLACEHOLDER).
 */

export const UNSUBSCRIBE_PLACEHOLDER = "PVUNSUBSCRIBETOKENPLACEHOLDER";

export interface CampaignLike {
  id?: string | null;
  subject: string;
  preheader?: string | null;
  content: unknown;
}

function blocksOf(content: unknown): CampaignBlock[] {
  return Array.isArray(content) ? (content as CampaignBlock[]) : [];
}

async function resolveProducts(blocks: CampaignBlock[]): Promise<Record<string, ProductCardData>> {
  const wanted = blocks.filter(
    (b): b is Extract<CampaignBlock, { type: "product" }> => b.type === "product",
  );
  if (wanted.length === 0) return {};
  const url = siteUrl();
  const products = await listProducts();
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const out: Record<string, ProductCardData> = {};
  for (const b of wanted) {
    const p = byHandle.get(b.productHandle);
    if (p) out[productKey(b.productHandle, b.variantId)] = toProductCard(p, url, b.variantId);
  }
  return out;
}

/**
 * Kampagne als HTML und Text. Ohne unsubscribeToken entsteht der Platzhalter (Versand) bzw.
 * mit preview: true ein nicht funktionsfähiger Vorschau-Link.
 */
export async function renderCampaignHtml(
  campaign: CampaignLike,
  options: { unsubscribeToken?: string; preview?: boolean; testBanner?: string | null } = {},
): Promise<RenderedMail> {
  const blocks = blocksOf(campaign.content);
  const token =
    options.unsubscribeToken ?? (options.preview ? "vorschau" : UNSUBSCRIBE_PLACEHOLDER);
  return renderCampaignEmail({
    subject: campaign.subject,
    preheader: campaign.preheader,
    blocks,
    products: await resolveProducts(blocks),
    entity: await loadImprint(),
    siteUrl: siteUrl(),
    imageBaseUrl: imageBaseUrl(),
    unsubscribeUrl: unsubscribeUrlFor(token, campaign.id ?? null),
    testBanner: options.testBanner ?? (options.preview ? "VORSCHAU" : null),
  });
}

/** Platzhalter im vorgerenderten Mailtext durch das Token des Empfängers ersetzen. */
export function personalize(mail: RenderedMail, token: string): RenderedMail {
  return {
    subject: mail.subject,
    html: mail.html.split(UNSUBSCRIBE_PLACEHOLDER).join(token),
    text: mail.text.split(UNSUBSCRIBE_PLACEHOLDER).join(token),
  };
}
