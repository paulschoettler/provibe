import type { CatalogProduct, CollectionSummary } from "@/lib/catalog/products";
import { catalogHref } from "@/lib/catalog/products";
import { CollectionCard, type CollectionMotif } from "./CollectionCard";

/**
 * Raster der Kollektionskarten: Alle Produkte, Eistee, Founder Bundles, Merch.
 * Titel und Anzahl kommen aus der Datenbank. Merch hat keine eigene Kollektion und zeigt die
 * Gesamtliste mit Filter Merch. "alle-produkte" (kuratierte Liste, F5) bleibt über ihre alte URL
 * erreichbar, bekommt aber keine eigene Karte, weil sie inhaltlich in "Alle Produkte" steckt.
 */
const MOTIF_BY_HANDLE: Record<string, CollectionMotif> = {
  all: "alle",
  eistee: "eistee",
  aktion: "bundles",
};

export function collectionCards(collections: CollectionSummary[], products: CatalogProduct[]) {
  const cards: { title: string; href: string; motif: CollectionMotif; count: number }[] = [];
  for (const handle of ["all", "eistee", "aktion"]) {
    const c = collections.find((x) => x.handle === handle);
    if (!c) continue;
    cards.push({
      title: handle === "all" && c.title === "Produkte" ? "Alle Produkte" : c.title,
      href: c.url,
      motif: MOTIF_BY_HANDLE[handle],
      count: c.productCount,
    });
  }
  const merchCount = products.filter((p) => p.type === "merch").length;
  if (merchCount > 0 && collections.some((c) => c.handle === "all")) {
    cards.push({
      title: "Merch",
      href: catalogHref("/collections/all", "merch", "beliebt"),
      motif: "merch",
      count: merchCount,
    });
  }
  return cards;
}

export function CollectionGrid({
  collections,
  products,
  headingLevel = 3,
}: {
  collections: CollectionSummary[];
  products: CatalogProduct[];
  headingLevel?: 2 | 3;
}) {
  const cards = collectionCards(collections, products);
  return (
    <ul className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
      {cards.map((card) => (
        <li key={card.href} className="flex">
          <CollectionCard {...card} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}

export default CollectionGrid;
