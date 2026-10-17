import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { SiteLink } from "@/components/layout/SiteLink";
import { ArrowRightIcon, CupIcon, ShirtIcon, TruckIcon } from "@/components/catalog/icons";
import { breadcrumbLd, faqLd, JsonLd, productLd } from "@/components/catalog/JsonLd";
import { Breadcrumbs, Eyebrow } from "@/components/catalog/parts";
import { FaqSection, LmivSections } from "@/components/catalog/ProductDetails";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductGallery, type GallerySlide } from "@/components/catalog/ProductGallery";
import { ProductPurchase } from "@/components/catalog/ProductPurchase";
import {
  getProductByHandle,
  getShippingInfo,
  htmlToText,
  listActiveHandles,
  readableRange,
  truncate,
  type ProductDetail,
  type ShippingInfo,
} from "@/lib/catalog/products";
import { formatEur } from "@/lib/money";

/**
 * Produktseite mit vier Darstellungen nach Produkttyp (Figma Sorte 32:1166 / 35:10340,
 * Bundle 35:12927 / 35:14097; Mixed und Merch abgeleitet): Galerie, Kaufbereich mit
 * Variantenwahl, Preisblock mit Pfand und Grundpreis, LMIV-Akkordeons, FAQ, "Auch lecker".
 * Statisch für alle aktiven Handles, stündlich bzw. per revalidateTag("catalog") erneuert.
 */
export const revalidate = 3600;

type Params = { handle: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await listActiveHandles()).map((handle) => ({ handle }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return { title: "Produkt nicht gefunden" };
  const description = truncate(
    product.seoDescription ?? (htmlToText(product.descriptionHtml) || product.title),
    160,
  );
  const image = product.image ?? product.gallery[0] ?? null;
  return {
    title: product.seoTitle ?? product.title,
    description,
    alternates: { canonical: product.productUrl },
    openGraph: {
      title: `${product.seoTitle ?? product.title} | provibe`,
      description,
      url: product.productUrl,
      images: image
        ? [
            {
              url: image.src,
              width: image.width,
              height: image.height,
              alt: image.alt || product.title,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { handle } = await params;
  const [product, shipping] = await Promise.all([getProductByHandle(handle), getShippingInfo()]);
  if (!product) notFound();

  const isDrink = product.type === "sorte" || product.type === "mixed";
  const isBundle = product.type === "bundle";
  const collection = product.breadcrumbCollection;
  const heading = product.type === "sorte" ? product.shortTitle : product.title;
  const faq = product.faq.length ? product.faq : isDrink ? defaultFaq(product, shipping) : [];
  const deliveryTime = readableRange(product.deliveryTimeText ?? shipping.deliveryTimeText);
  const cans = product.bundleComponents.filter((c) => c.kind === "dose");
  const bundleCans = isBundle
    ? {
        count: cans.reduce((s, c) => s + c.quantity * c.unitCount, 0),
        depositPerCanCents: cans[0]?.depositCentsPerUnit ?? 0,
      }
    : null;

  const crumbs = [
    { label: "Shop", href: "/pages/shop" },
    ...(collection ? [{ label: collection.title, href: collection.url }] : []),
    { label: product.shortTitle },
  ];

  const ld: Record<string, unknown>[] = [
    productLd(product),
    breadcrumbLd([
      { name: "Shop", path: "/pages/shop" },
      ...(collection ? [{ name: collection.title, path: collection.url }] : []),
      { name: product.title, path: product.productUrl },
    ]),
  ];
  if (faq.length) ld.push(faqLd(faq));

  return (
    <SiteShell>
      <JsonLd data={ld} />

      <div className="mx-auto grid w-full max-w-[1200px] gap-6 pb-12 lg:grid-cols-[minmax(0,588px)_minmax(0,564px)] lg:justify-between lg:gap-12 lg:px-6 lg:pt-7 lg:pb-16">
        {/* Galerie (mobil randlos), bei Bundles darunter "Über das Set" */}
        <div className="min-w-0">
          <div className={isBundle ? "px-4 pt-3 lg:px-0 lg:pt-0" : ""}>
            <ProductGallery
              id={`galerie-${product.handle}`}
              slides={gallerySlides(product)}
              palette={product.palette}
              showStickers={product.type === "sorte"}
              placeholderTitle={product.title}
              badges={
                isBundle
                  ? [
                      { label: "Bundle", tone: "berry" },
                      { label: "Limitiertes Set", tone: "butter" },
                    ]
                  : []
              }
            />
          </div>
          {isBundle && product.bodyHtml ? (
            <section className="mt-10 hidden lg:block" aria-labelledby="ueber-das-set">
              <Eyebrow>Über das Set</Eyebrow>
              <h2 id="ueber-das-set" className="pvc-h2 mt-3">
                {product.lead ?? product.title}
              </h2>
              <div
                className="pvc-richtext mt-5 text-[17px] leading-[1.55]"
                dangerouslySetInnerHTML={{ __html: product.bodyHtml }}
              />
            </section>
          ) : null}
        </div>

        {/* Kaufbereich */}
        <div className="flex min-w-0 flex-col gap-5 px-4 sm:px-6 lg:px-0">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col gap-1.5">
            <Eyebrow>
              {isDrink
                ? ["Eistee", product.netContentText].filter(Boolean).join(" · ")
                : isBundle
                  ? (collection?.title ?? "Founder Bundles")
                  : "Merch"}
            </Eyebrow>
            <h1 className="text-berry text-[52px] leading-[0.92] font-bold tracking-[-0.02em] break-words sm:text-[64px] lg:text-[80px]">
              {heading}
            </h1>
            {(isDrink ? product.line2 : isBundle ? product.lead : product.line1) ? (
              <p className="text-wine text-[20px] leading-[1.15] font-semibold lg:text-[24px]">
                {isDrink ? product.line2 : isBundle ? product.lead : product.line1}
              </p>
            ) : null}
          </div>

          {isDrink ? (
            <ul className="flex flex-wrap items-center gap-2.5" aria-label="Eigenschaften">
              {product.proteinPerUnitG ? (
                <li>
                  <span className="pvc-sticker-protein pvc-sticker-protein--inline [--s:62px]">
                    <b>{product.proteinPerUnitG.toLocaleString("de-DE")} g</b>
                    <small>Protein</small>
                  </span>
                </li>
              ) : null}
              {product.stickers.map((s, i) => (
                <li key={s}>
                  <span
                    className={`pvc-pill ${i === 0 ? "bg-butter" : i === 1 ? "bg-pink-light" : "bg-cream-2"}`}
                  >
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {isDrink && product.descriptionHtml ? (
            <div
              className="pvc-richtext text-[17px] leading-[1.5]"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          ) : null}
          {!isDrink && !isBundle && product.descriptionHtml ? (
            <div
              className="pvc-richtext text-[17px] leading-[1.5]"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          ) : null}

          {isBundle && product.bundleComponents.length ? (
            <div className="bg-cream-2 rounded-[22px] p-5">
              <h2 className="text-[17px] font-semibold">Im Set</h2>
              <ul className="mt-2 flex flex-col">
                {product.bundleComponents.map((c) => (
                  <li
                    key={c.productHandle}
                    className="flex min-h-[54px] items-center gap-4 text-[17px]"
                  >
                    <span className="flex w-9 shrink-0 justify-center" aria-hidden="true">
                      {c.imageUrl ? (
                        <Image
                          src={c.imageUrl}
                          alt=""
                          width={405}
                          height={760}
                          sizes="30px"
                          className="h-11 w-auto"
                        />
                      ) : c.kind === "becher" ? (
                        <CupIcon className="h-7 w-7" />
                      ) : (
                        <ShirtIcon className="h-7 w-7" />
                      )}
                    </span>
                    <span>
                      <strong className="font-semibold">{c.quantity} ×</strong> {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ProductPurchase
            productTitle={product.title}
            type={product.type}
            variants={product.variants}
            defaultVariantId={product.defaultVariant.id}
            optionName={product.optionName}
            bundleCans={bundleCans}
            deliveryTimeText={deliveryTime}
          />

          <ShippingNote product={product} shipping={shipping} deliveryTime={deliveryTime} />
          <p className="text-plum text-[14px] leading-[1.45]">
            Bezahlen mit Karte, Apple Pay, Google Pay, PayPal oder Klarna.
          </p>

          {isBundle && product.bodyHtml ? (
            <section className="mt-4 lg:hidden" aria-labelledby="ueber-das-set-mobil">
              <Eyebrow>Über das Set</Eyebrow>
              <h2 id="ueber-das-set-mobil" className="pvc-h2 mt-3">
                {product.lead ?? product.title}
              </h2>
              <div
                className="pvc-richtext mt-4 text-[16px] leading-[1.55]"
                dangerouslySetInnerHTML={{ __html: product.bodyHtml }}
              />
            </section>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-12 pb-16 lg:gap-16 lg:pb-24">
        <LmivSections product={product} />
        <FaqSection faq={faq} />

        {product.related.length ? (
          <section
            aria-labelledby="auch-lecker"
            className="mx-auto w-full max-w-[1200px] px-4 sm:px-6"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
              <div>
                <Eyebrow>{isDrink ? "Mehr Sorten" : "Mehr entdecken"}</Eyebrow>
                <h2 id="auch-lecker" className="pvc-h2 mt-3">
                  {isDrink ? "Auch lecker" : "Das passt dazu"}
                </h2>
              </div>
              <SiteLink
                href="/collections/all"
                className="flex min-h-11 items-center gap-1.5 text-[15px] font-semibold underline underline-offset-4"
              >
                Alle Produkte ansehen
                <ArrowRightIcon className="h-4 w-4" />
              </SiteLink>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
              {product.related.map((p) => (
                <li key={p.id} className="flex">
                  <ProductCard product={p} layout="grid" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}

function gallerySlides(product: ProductDetail): GallerySlide[] {
  const photos: GallerySlide[] = product.gallery.map((image) => ({
    kind: "photo",
    image,
    label: image.alt || product.title,
  }));
  switch (product.type) {
    case "sorte":
      return product.image
        ? [
            { kind: "can", image: product.image, label: `Dose provibe ${product.shortTitle}` },
            ...photos,
          ]
        : photos;
    case "mixed":
      return [
        { kind: "trio", label: "Drei Dosen: Raspberry Lime, Wildberry und Peach" },
        ...photos,
      ];
    case "bundle":
      return product.image
        ? [{ kind: "photo", image: product.image, label: product.title }, ...photos]
        : photos;
    default:
      return photos.length
        ? photos
        : [{ kind: "placeholder", label: `${product.title}, Foto folgt` }];
  }
}

function ShippingNote({
  product,
  shipping,
  deliveryTime,
}: {
  product: ProductDetail;
  shipping: ShippingInfo;
  deliveryTime: string;
}) {
  const v = product.defaultVariant;
  const overThreshold =
    shipping.freeAboveCents !== null && v.goodsPriceCents >= shipping.freeAboveCents;
  const free =
    shipping.freeAboveCents !== null ? formatEur(shipping.freeAboveCents).replace(",00", "") : null;
  return (
    <div className="bg-cream-2 flex gap-3.5 rounded-[20px] p-[18px]">
      <TruckIcon className="text-plum mt-0.5 h-[26px] w-[26px] shrink-0" />
      <div>
        <p className="text-[16px] leading-[1.5] font-semibold">
          Versand {formatEur(shipping.priceCents)}
          {free ? `, ab ${free} versandkostenfrei` : ""}
          {product.type === "bundle" && overThreshold ? ". Dieses Set liegt drüber." : ""}
        </p>
        <p className="text-[14px] leading-[1.45]">
          Lieferzeit {deliveryTime}. Wir liefern innerhalb Deutschlands.{" "}
          <SiteLink href="/pages/versand" className="underline underline-offset-2">
            Versand und Zahlung
          </SiteLink>
        </p>
      </div>
    </div>
  );
}

/** FAQ laut Entscheidung H7 (Protein, Pfand, Versand), solange im Backoffice keine gepflegt ist. */
function defaultFaq(product: ProductDetail, shipping: ShippingInfo): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const proteinRow = product.nutrition?.rows.find((r) => r.label === "Eiweiß");
  if (product.proteinPerUnitG) {
    out.push({
      q: "Wie viel Protein steckt in einer Dose?",
      a: `${product.proteinPerUnitG.toLocaleString("de-DE")} g pro Dose${product.netContentText ? ` (${product.netContentText})` : ""}, aus Molkenprotein.${
        proteinRow ? ` Das sind ${proteinRow.values[0]} je 100 ml.` : ""
      }`,
    });
  }
  const v = product.defaultVariant;
  if (v.depositPerUnitCents > 0) {
    out.push({
      q: "Wie funktioniert das Pfand?",
      a: `Auf jede Dose kommen ${formatEur(v.depositPerUnitCents)} Pfand. Das Pfand kommt zum Packpreis hinzu und wird getrennt ausgewiesen, beim ${v.unitCount}er-Pack sind das ${formatEur(v.depositCents)}. Die leeren Dosen gibst du wie andere Pfanddosen im Handel zurück.`,
    });
  }
  const days = shipping.deliveryTimeText.endsWith("Werktage")
    ? `${shipping.deliveryTimeText}n`
    : shipping.deliveryTimeText;
  out.push({
    q: "Wann kommt meine Bestellung?",
    a: `Wir liefern innerhalb Deutschlands in ${days}. Der Versand kostet ${formatEur(shipping.priceCents)}${
      shipping.freeAboveCents !== null
        ? `, ab ${formatEur(shipping.freeAboveCents).replace(",00", "")} Bestellwert ist er kostenlos`
        : ""
    }.`,
  });
  return out;
}
