import type { CatalogProduct, ProductDetail } from "@/lib/catalog/products";
import { htmlToText, truncate } from "@/lib/catalog/products";

/**
 * Strukturierte Daten (JSON-LD) für Katalogseiten. Werte kommen aus denselben serverseitig
 * berechneten Daten wie die sichtbare Seite, damit Preis und Verfügbarkeit übereinstimmen.
 */

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${siteUrl}${path}`;
}

/** Cent als Euro-String mit Punkt, wie schema.org es erwartet ("23.85"). */
export function centsToSchemaPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // "<" escapen, damit kein Text aus der Datenbank das Script-Tag beenden kann
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListLd(name: string, products: CatalogProduct[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(p.productUrl),
      name: p.title,
    })),
  };
}

/**
 * Product mit Offer. price ist der Packpreis der Standardvariante in Euro ohne Pfand, also der
 * Gesamtpreis im Sinne der PAngV wie auf der Seite (Entscheidung H22). Das Pfand steht bewusst
 * nicht in der Offer. Bei Getränken kommt der Grundpreis als UnitPriceSpecification dazu (Bezug
 * 1 Liter, ohne Pfand, aus src/lib/pricing).
 */
export function productLd(product: ProductDetail) {
  const v = product.defaultVariant;
  const image = [product.image?.src, ...product.gallery.map((g) => g.src)]
    .filter((x): x is string => !!x)
    .map(absoluteUrl);
  const description = truncate(
    htmlToText(product.descriptionHtml) || product.seoDescription || product.title,
    500,
  );
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url: absoluteUrl(product.productUrl),
    price: centsToSchemaPrice(v.goodsPriceCents),
    priceCurrency: "EUR",
    availability: v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: "provibe" },
  };
  if (v.basePriceCents !== null) {
    offer.priceSpecification = {
      "@type": "UnitPriceSpecification",
      price: centsToSchemaPrice(v.basePriceCents),
      priceCurrency: "EUR",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "LTR" },
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    sku: v.sku ?? undefined,
    brand: { "@type": "Brand", name: "provibe" },
    image,
    url: absoluteUrl(product.productUrl),
    offers: offer,
  };
}

export function faqLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
