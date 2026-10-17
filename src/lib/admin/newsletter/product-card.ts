import { formatEur } from "@/lib/money";
import type { ProductCardData } from "@/emails/components";

/**
 * Produktblock der Kampagne aus den Katalogdaten. Preisdarstellung wie auf der Produktseite:
 * Packpreis inklusive Pfand, Pfand getrennt genannt, Grundpreis ohne Pfand (PAngV).
 * Rein, getestet in product-card.test.ts.
 */

export interface CatalogVariantLike {
  id: string;
  title: string;
  priceCents: number;
  depositCents: number;
  basePriceText: string | null;
  available: boolean;
}

export interface CatalogProductLike {
  handle: string;
  shortTitle: string;
  line1: string;
  image: { src: string } | null;
  productUrl: string;
  variants: CatalogVariantLike[];
  defaultVariant: CatalogVariantLike;
}

function absolute(url: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function toProductCard(
  product: CatalogProductLike,
  siteUrl: string,
  variantId?: string,
): ProductCardData {
  const variant =
    (variantId && product.variants.find((v) => v.id === variantId)) || product.defaultVariant;
  const details = [
    variant.depositCents > 0 ? `inkl. ${formatEur(variant.depositCents)} Pfand` : null,
    variant.basePriceText ? `Grundpreis ${variant.basePriceText} (ohne Pfand)` : null,
    variant.available ? null : "derzeit ausverkauft",
  ].filter(Boolean);
  return {
    title: product.shortTitle,
    line: product.line1,
    priceLine: `${variant.title} ${formatEur(variant.priceCents)}`,
    detailLine: details.length ? details.join(" · ") : null,
    imageUrl: product.image ? absolute(product.image.src, siteUrl) : null,
    url: absolute(product.productUrl, siteUrl),
  };
}
