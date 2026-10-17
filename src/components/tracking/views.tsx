import type { CatalogProduct } from "@/lib/catalog/products";
import {
  buildSearchEvent,
  buildViewItemEvent,
  buildViewItemListEvent,
  type CatalogItemSource,
} from "@/lib/tracking/builders";
import { TrackEvent } from "./TrackEvent";

/**
 * Server-Bausteine für die Seiten: bauen das Event aus den Katalogdaten auf dem Server und reichen
 * nur das kleine Event an die Client-Komponente (nicht das ganze Produkt). Je Seite eine Zeile.
 */

function source(product: CatalogProduct): CatalogItemSource {
  const v = product.defaultVariant;
  return {
    variantId: v.id,
    sku: v.sku,
    title: product.title,
    variantTitle: product.variants.length > 1 ? v.title : null,
    category: product.type,
    goodsPriceCents: v.goodsPriceCents,
  };
}

/** Produktseite: view_item mit der Standardvariante. */
export function TrackProductView({ product }: { product: CatalogProduct }) {
  return <TrackEvent event={buildViewItemEvent(source(product))} />;
}

/** Kollektion: view_item_list. */
export function TrackCollectionView({
  id,
  name,
  products,
}: {
  id: string;
  name: string;
  products: CatalogProduct[];
}) {
  if (!products.length) return null;
  return <TrackEvent event={buildViewItemListEvent(id, name, products.map(source))} />;
}

/** Suche: search mit dem bereinigten Suchbegriff (nur wenn gesucht wurde). */
export function TrackSearch({ query }: { query: string }) {
  if (!query) return null;
  return <TrackEvent event={buildSearchEvent(query)} />;
}
