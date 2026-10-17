import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import type { CatalogProduct } from "@/lib/catalog/products";
import { formatEur } from "@/lib/money";
import { AddToCartForm } from "./AddToCartForm";
import { CanTrio } from "./CanTrio";
import { ArrowRightIcon, Blob, CartLineIcon, CupIcon, ShirtIcon } from "./icons";

/**
 * Produktkarte (Figma Katalog/Produktkarte 22:1359) als Server-Komponente.
 *
 * Typen: Sorte, Mixed, Bundle, Merch. Größen wie im Entwurf: "standard" (Desktop-Raster),
 * "klein" (mobil zweispaltig), "kompakt" (mobil als Liste, Bild links). Über layout wird die
 * Größe responsiv gewählt, ohne den Inhalt doppelt ins HTML zu schreiben:
 * "grid" = klein, ab 768 px standard; "list" = kompakt, ab 768 px standard; "compact" = immer
 * kompakt (Suche). Das Raster dafür steht im Block "Katalog" in globals.css.
 *
 * Preise nach Entscheidung H11 und H22: Hauptpreis ist der Packpreis ohne Pfand "ab 23,85 €" mit
 * "9 Dosen", darunter Preis je Dose, Pfand je Dose und Grundpreis (PAngV). Pfand wird nie in den
 * Preis eingerechnet (§ 7 PAngV), Bundles zeigen "zzgl. X Pfand" aus den Komponenten (H1).
 */
export type ProductCardLayout = "grid" | "list" | "compact";

/** Blob-Farbe je Sorte: die Sortenfarbe aus dem CI-Guide (Wildberry, Lime-Raspberry, Peach). */
const BLOB_COLOR: Record<string, string> = {
  wildberry: "var(--pv-wildberry)",
  "raspberry-lime": "var(--pv-lime-raspberry)",
  peach: "var(--pv-peach)",
};

export function ProductCard({
  product,
  layout = "grid",
  headingLevel = 3,
  priority = false,
}: {
  product: CatalogProduct;
  layout?: ProductCardLayout;
  headingLevel?: 2 | 3;
  priority?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const { type, defaultVariant: v } = product;
  const isDrink = type === "sorte" || type === "mixed";
  const pack = product.variants.find((x) => x.unitCount === 9);
  const drink = pack ?? v;
  const mainCents = isDrink ? drink.goodsPriceCents : product.priceFromGoodsCents;
  const depositCents = isDrink ? drink.depositCents : product.priceFromDepositCents;

  return (
    <article
      className={`pvc-card pvc-card--${layout} pvc-card--${type}`}
      data-pv-tilt=""
      style={
        {
          "--pvc-blob": BLOB_COLOR[product.handle] ?? "var(--pv-wildberry)",
        } as React.CSSProperties
      }
    >
      <span className="pvc-badge">{product.badge}</span>

      <Heading className="pvc-title">
        <SiteLink href={product.productUrl} className="pvc-link">
          {product.shortTitle}
        </SiteLink>
      </Heading>

      <div className="pvc-media" aria-hidden={product.image ? undefined : true}>
        <CardMedia product={product} priority={priority} />
      </div>

      <div className="pvc-lines">
        <p className="pvc-line1">{product.line1}</p>
        {product.line2 ? <p className="pvc-line2">{product.line2}</p> : null}
      </div>

      <p className="pvc-price">
        <span className="pvc-price-main">
          {product.hasPriceRange ? "ab " : ""}
          {formatEur(mainCents)}
        </span>
        {isDrink ? <span className="pvc-price-unit">{drink.unitCount} Dosen</span> : null}
      </p>

      <p className="pvc-fine">
        {isDrink ? (
          <>
            <span className="pvc-nowrap">{formatEur(drink.perUnitCents)} je Dose</span>
            {drink.depositPerUnitCents > 0 ? (
              <>
                <span className="pvc-sep"> · </span>
                <span className="pvc-nowrap">
                  zzgl. {formatEur(drink.depositPerUnitCents)} Pfand je Dose
                </span>
              </>
            ) : null}
            {drink.basePriceText ? (
              <>
                <span className="pvc-sep"> · </span>
                <span className="pvc-nowrap">{drink.basePriceText}</span>
              </>
            ) : null}
          </>
        ) : depositCents > 0 ? (
          <>zzgl. {formatEur(depositCents)} Pfand</>
        ) : (
          <>inkl. MwSt., zzgl. Versand</>
        )}
      </p>

      <div className="pvc-action">
        <CardAction product={product} />
      </div>
    </article>
  );
}

function CardMedia({ product, priority }: { product: CatalogProduct; priority: boolean }) {
  const { type, image } = product;
  if (type === "mixed") {
    return (
      <>
        <Blob className="pvc-blob" />
        <CanTrio
          className="pvc-card-trio"
          sizes="(min-width: 768px) 130px, 80px"
          preload={priority}
        />
      </>
    );
  }
  if (type === "sorte" && image) {
    return (
      <>
        <Blob className="pvc-blob" />
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(min-width: 768px) 150px, 90px"
          preload={priority}
          className="pvc-can"
        />
      </>
    );
  }
  if (image) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes="(min-width: 1024px) 330px, (min-width: 768px) 45vw, 50vw"
        preload={priority}
        className="pvc-photo"
      />
    );
  }
  // Platzhalter (Entscheidung H13): Merch ohne Foto
  return (
    <span className="pvc-placeholder">
      {product.handle.includes("cup") ? (
        <CupIcon className="pvc-placeholder-icon" />
      ) : (
        <ShirtIcon className="pvc-placeholder-icon" />
      )}
      <span className="pvc-placeholder-name">{product.title}</span>
      <span className="pvc-placeholder-note">Foto folgt</span>
    </span>
  );
}

function CardAction({ product }: { product: CatalogProduct }) {
  const { type, variants, defaultVariant } = product;
  const isDrink = type === "sorte" || type === "mixed";
  const pack = variants.find((x) => x.unitCount === 9);

  // Sorten und Mix: 9er-Pack direkt in den Warenkorb (Entscheidung G6/H11)
  if (isDrink && pack) {
    return (
      <AddToCartForm
        variantId={pack.id}
        label="In den Warenkorb"
        ariaLabel={`${product.shortTitle}, 9er-Pack für ${priceForLabel(pack)}: In den Warenkorb`}
        buttonClassName="pvc-btn"
        icon={<CartLineIcon className="pvc-btn-icon" />}
      />
    );
  }
  // Ein einziger Artikel (Founder Bundle I, Becher): direkt kaufbar
  if (variants.length === 1) {
    return (
      <AddToCartForm
        variantId={defaultVariant.id}
        label="In den Warenkorb"
        ariaLabel={`${product.shortTitle} für ${priceForLabel(defaultVariant)}: In den Warenkorb`}
        buttonClassName="pvc-btn"
        icon={<CartLineIcon className="pvc-btn-icon" />}
      />
    );
  }
  // Mehrere Größen: Auswahl auf der Produktseite
  return (
    <SiteLink
      href={product.productUrl}
      className="pvc-btn"
      aria-label={`${product.shortTitle}: Größe wählen`}
    >
      <CartLineIcon className="pvc-btn-icon" />
      <span className="pvc-btn-label">Größe wählen</span>
      <ArrowRightIcon className="pvc-btn-arrow" />
    </SiteLink>
  );
}

/** Preis für Screenreader-Labels: Preis ohne Pfand, Pfand getrennt (H22). */
function priceForLabel(v: CatalogProduct["defaultVariant"]): string {
  return v.depositCents > 0
    ? `${formatEur(v.goodsPriceCents)} zzgl. ${formatEur(v.depositCents)} Pfand`
    : formatEur(v.goodsPriceCents);
}

export default ProductCard;
