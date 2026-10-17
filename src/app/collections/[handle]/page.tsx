import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteLink } from "@/components/layout/SiteLink";
import { CollectionHero } from "@/components/catalog/CollectionHero";
import { EmptyState } from "@/components/catalog/EmptyState";
import { FilterBar } from "@/components/catalog/FilterBar";
import { breadcrumbLd, itemListLd, JsonLd } from "@/components/catalog/JsonLd";
import { PriceFootnote } from "@/components/catalog/parts";
import { ProductCard } from "@/components/catalog/ProductCard";
import { TrackCollectionView } from "@/components/tracking/views";
import {
  getCollection,
  getShippingInfo,
  htmlToText,
  parseCatalogParams,
  truncate,
} from "@/lib/catalog/products";

/**
 * Kollektion (Figma 27:553 mobil, 27:5966 Desktop, leer 27:853): Produktraster mit Filter-Chips
 * und Sortierung über Suchparameter (?filter=eistee&sort=preis-auf), servergerendert.
 * Wegen der Suchparameter wird die Seite je Anfrage gerendert; die Daten selbst kommen aus dem
 * Fetch-Cache (Tag "catalog", 3600 s), siehe src/lib/catalog/products.ts.
 */
type Params = { handle: string };
type Search = Record<string, string | string[] | undefined>;

/** Fallback-Beschreibungen, solange in collection_translations keine gepflegt ist. */
const FALLBACK_DESCRIPTION: Record<string, string> = {
  all: "Eistee, Founder Bundles und Merch. Alles, was provibe gerade hat.",
  "alle-produkte": "Unsere Sorten, der Mix und die Founder Bundles auf einen Blick.",
  eistee:
    "Eistee mit 15 g Protein, ohne Zucker. Wildberry, Raspberry Lime, Peach und der Mix aus allen dreien.",
  aktion: "Limitierte Sets mit allen drei Sorten, Becher und Shirt.",
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle } = await params;
  const page = await getCollection(handle);
  if (!page) return { title: "Kollektion nicht gefunden" };
  const c = page.collection;
  const description = truncate(
    c.seoDescription ?? (htmlToText(c.descriptionHtml) || FALLBACK_DESCRIPTION[handle] || c.title),
    160,
  );
  return {
    title: c.seoTitle ?? c.title,
    description,
    alternates: { canonical: c.url },
    openGraph: { title: `${c.seoTitle ?? c.title} | provibe`, description, url: c.url },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ handle }, search] = await Promise.all([params, searchParams]);
  const { filter, sort } = parseCatalogParams(search);
  const [page, shipping] = await Promise.all([
    getCollection(handle, { filter, sort }),
    getShippingInfo(),
  ]);
  if (!page) notFound();

  const { collection, products } = page;
  const crumbs = [
    { label: "Shop", href: "/pages/shop" },
    { label: "Kollektionen", href: "/collections" },
    { label: collection.title },
  ];
  const filterLabel = { alle: "", eistee: "Eistee", bundles: "Bundles", merch: "Merch" }[filter];

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Shop", path: "/pages/shop" },
            { name: "Kollektionen", path: "/collections" },
            { name: collection.title, path: collection.url },
          ]),
          itemListLd(collection.title, products),
        ]}
      />
      <TrackCollectionView id={collection.handle} name={collection.title} products={products} />
      <CollectionHero
        crumbs={crumbs}
        title={collection.title}
        descriptionHtml={collection.descriptionHtml}
        description={FALLBACK_DESCRIPTION[handle]}
      />

      <section
        className="mx-auto w-full max-w-[1200px] px-4 pt-4 pb-16 sm:px-6 lg:pt-6 lg:pb-24"
        aria-label={`Produkte${filterLabel ? `, Filter ${filterLabel}` : ""}`}
      >
        <FilterBar base={collection.url} filter={filter} sort={sort} count={products.length} />

        {products.length > 0 ? (
          <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:mt-8 lg:grid-cols-3 lg:gap-6">
            {products.map((product, i) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} layout="list" headingLevel={2} priority={i < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Hier ist gerade nichts."
            icon={filter === "merch" ? "merch" : "search"}
            text={
              <p>
                In dieser Kollektion gibt es gerade keine Produkte
                {filterLabel ? ` mit dem Filter „${filterLabel}“` : ""}. Schau dir alles an, was wir
                haben, oder wähl einen anderen Filter.
              </p>
            }
          >
            {filter !== "alle" ? (
              <SiteLink
                href={collection.url}
                className="order-last mt-5 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
              >
                Filter zurücksetzen
              </SiteLink>
            ) : null}
          </EmptyState>
        )}

        <PriceFootnote shipping={shipping} className="mt-8" />
      </section>
    </SiteShell>
  );
}
