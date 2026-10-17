import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteLink } from "@/components/layout/SiteLink";
import { CollectionGrid } from "@/components/catalog/CollectionGrid";
import { CollectionHero } from "@/components/catalog/CollectionHero";
import { ArrowRightIcon } from "@/components/catalog/icons";
import { breadcrumbLd, JsonLd } from "@/components/catalog/JsonLd";
import { Eyebrow } from "@/components/catalog/parts";
import { listCollections, listProducts } from "@/lib/catalog/products";

/** Kollektionsübersicht: statisch, stündlich oder per revalidateTag("catalog") erneuert. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kollektionen",
  description:
    "Alle Kollektionen von provibe: Eistee mit 15 g Protein, Founder Bundles und Merch auf einen Blick.",
  alternates: { canonical: "/collections" },
  openGraph: { title: "Kollektionen | provibe", url: "/collections" },
};

/**
 * Kollektionsübersicht (abgeleitet aus Shop-Übersicht und Kollektion, ohne eigenen Screen):
 * Karten für Alle, Eistee, Founder Bundles, Merch und eine Textliste aller veröffentlichten
 * Kollektionen, damit auch kuratierte Listen wie /collections/alle-produkte verlinkt sind.
 */
export default async function CollectionsPage() {
  const [collections, products] = await Promise.all([listCollections(), listProducts()]);

  return (
    <SiteShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Shop", path: "/pages/shop" },
          { name: "Kollektionen", path: "/collections" },
        ])}
      />
      <CollectionHero
        crumbs={[{ label: "Shop", href: "/pages/shop" }, { label: "Kollektionen" }]}
        eyebrow="Shop"
        title="Kollektionen"
        description="Worauf hast du Lust? Eistee, Founder Bundles oder Merch."
      />

      <section className="mx-auto w-full max-w-[1200px] px-4 pt-4 pb-10 sm:px-6 lg:pt-8">
        <h2 className="sr-only">Kollektionen im Überblick</h2>
        <CollectionGrid collections={collections} products={products} />
      </section>

      <section
        className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 lg:pb-24"
        aria-labelledby="alle-kollektionen"
      >
        <Eyebrow>Alle Kollektionen</Eyebrow>
        <h2 id="alle-kollektionen" className="pvc-h2 mt-3 mb-4">
          Direkt zur Liste
        </h2>
        <ul className="border-mauve/40 border-t">
          {collections.map((c) => (
            <li key={c.id} className="border-mauve/40 border-b">
              <SiteLink
                href={c.url}
                className="hover:text-berry flex min-h-[60px] items-center justify-between gap-4 text-[18px] font-semibold"
              >
                <span>
                  {c.title}
                  <span className="text-plum ml-2 text-[14px] font-medium">
                    {c.productCount} {c.productCount === 1 ? "Produkt" : "Produkte"}
                  </span>
                </span>
                <ArrowRightIcon className="text-plum h-5 w-5" />
              </SiteLink>
            </li>
          ))}
        </ul>
      </section>
    </SiteShell>
  );
}
