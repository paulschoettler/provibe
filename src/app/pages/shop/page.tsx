import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteLink } from "@/components/layout/SiteLink";
import { WaveDivider } from "@/components/layout/WaveDivider";
import { CanTrio } from "@/components/catalog/CanTrio";
import { CollectionGrid } from "@/components/catalog/CollectionGrid";
import { ArrowRightIcon, Blob } from "@/components/catalog/icons";
import { breadcrumbLd, itemListLd, JsonLd } from "@/components/catalog/JsonLd";
import { Eyebrow, PriceFootnote, SectionHead } from "@/components/catalog/parts";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getShippingInfo, listCollections, listProducts } from "@/lib/catalog/products";

/** Katalogdaten: statisch bauen, stündlich oder per revalidateTag("catalog") erneuern. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Shop: Eistee mit 15 g Protein",
  description:
    "Such dir deinen Vibe: provibe Eistee mit 15 g Protein in Wildberry, Raspberry Lime und Peach, der Mix aus allen dreien, Founder Bundles und Merch.",
  alternates: { canonical: "/pages/shop" },
  openGraph: {
    title: "Shop | provibe",
    description: "Eistee mit 15 g Protein, ohne Zucker. Alle Sorten, Bundles und Merch.",
    url: "/pages/shop",
    images: [
      { url: "/images/bundle-3.jpg", width: 1400, height: 924, alt: "provibe Founder Bundle" },
    ],
  },
};

/**
 * Shop-Übersicht (Figma 24:1764 mobil, 26:2199 Desktop): Hero-Band, Kollektionskarten,
 * Raster aller aktiven Produkte. Alles im Server-HTML.
 */
export default async function ShopPage() {
  const [products, collections, shipping] = await Promise.all([
    listProducts(),
    listCollections(),
    getShippingInfo(),
  ]);

  return (
    <SiteShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Startseite", path: "/" },
            { name: "Shop", path: "/pages/shop" },
          ]),
          itemListLd("Alle Produkte", products),
        ]}
      />

      {/* Hero-Band */}
      <section className="pvc-hero" aria-labelledby="shop-titel">
        <Blob className="pvc-hero-blob top-[-12%] right-[-8%] h-[70%] w-[60%]" opacity={0.18} />
        <Blob className="pvc-hero-blob bottom-[8%] left-[-18%] h-[60%] w-[55%]" opacity={0.14} />
        <div className="relative z-[1] mx-auto grid w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div className="text-center lg:text-left">
            <Eyebrow className="text-wine justify-center lg:justify-start">get the vibe</Eyebrow>
            <h1
              id="shop-titel"
              className="text-wine mt-3 text-[46px] leading-[0.95] font-bold tracking-[-0.03em] sm:text-[64px] lg:text-[92px]"
            >
              Such dir deinen Vibe.
            </h1>
            <p className="text-wine mx-auto mt-4 max-w-[30ch] text-[17px] leading-[1.5] font-medium lg:mx-0 lg:text-[22px]">
              Probier provibe: erfrischender Eistee mit 15 g Protein.
            </p>
            <div className="mt-7 hidden lg:block">
              <SiteLink href="#produkte" className="btn-primary">
                <ArrowRightIcon className="h-4 w-4" />
                Jetzt shoppen
              </SiteLink>
            </div>
          </div>

          <div className="pvc-hero-cans">
            <CanTrio
              sizes="(min-width: 1024px) 200px, 140px"
              preload
              alt="Drei provibe Dosen: Raspberry Lime, Wildberry und Peach"
            />
            <span
              className="pvc-sticker-protein top-[4%] right-[2%] [--s:78px] lg:[--s:104px]"
              aria-hidden="true"
            >
              <b>15 g</b>
              <small>Protein</small>
            </span>
            <span
              className="pvc-sticker-butter bottom-[6%] left-[2%] text-[15px] lg:text-[19px]"
              aria-hidden="true"
            >
              Ohne Zucker
            </span>
          </div>

          <div className="text-center lg:hidden">
            <SiteLink href="#produkte" className="btn-primary">
              <ArrowRightIcon className="h-4 w-4" />
              Jetzt shoppen
            </SiteLink>
          </div>
        </div>
        <WaveDivider
          shape="swell"
          fill="var(--color-cream)"
          position="top"
          className="pvc-wave-inside"
        />
      </section>

      {/* Kollektionen */}
      <section
        className="mx-auto w-full max-w-[1200px] px-4 pt-10 pb-4 sm:px-6 lg:pt-16"
        aria-labelledby="kollektionen"
      >
        <SectionHead eyebrow="Kollektionen" title="Worauf hast du Lust?" id="kollektionen" />
        <CollectionGrid collections={collections} products={products} />
      </section>

      {/* Alle Produkte */}
      <section
        id="produkte"
        className="mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 pt-12 pb-16 sm:px-6 lg:pt-20 lg:pb-24"
        aria-labelledby="alle-produkte"
      >
        <SectionHead
          eyebrow="Alle Produkte"
          title="Unser Sortiment."
          id="alle-produkte"
          aside={
            <p className="flex items-center gap-6 text-[14px]">
              <span className="text-plum">{products.length} Produkte</span>
              <SiteLink
                href="/collections/all"
                className="text-aubergine flex min-h-11 items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                Zur Kollektion
                <ArrowRightIcon className="h-4 w-4" />
              </SiteLink>
            </p>
          }
        />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {products.map((product, i) => (
            <li key={product.id} className="flex">
              <ProductCard product={product} layout="grid" priority={i < 2} />
            </li>
          ))}
        </ul>
        <PriceFootnote shipping={shipping} className="mt-6" />
      </section>
    </SiteShell>
  );
}
