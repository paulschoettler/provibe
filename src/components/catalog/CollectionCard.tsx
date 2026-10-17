import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import { CanTrio } from "./CanTrio";
import { ArrowRightIcon, Blob, CupIcon, ShirtIcon } from "./icons";

/**
 * Kollektionskarte (Figma Katalog/Kollektionskarte 23:477): Einstieg in die Kollektionen auf
 * /pages/shop und /collections. Mobil 2 × 2, Desktop vier nebeneinander.
 */
export type CollectionMotif = "alle" | "eistee" | "bundles" | "merch";

const BG: Record<CollectionMotif, string> = {
  alle: "bg-pink-light",
  eistee: "bg-peach",
  bundles: "bg-butter",
  merch: "bg-cream-2 border border-mauve",
};

export function CollectionCard({
  title,
  href,
  motif,
  count,
  headingLevel = 3,
}: {
  title: string;
  href: string;
  motif: CollectionMotif;
  count?: number;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`pvc-coll ${BG[motif]}`} data-pv-tilt="">
      <div className="pvc-coll-motif" aria-hidden="true">
        <Motif motif={motif} />
      </div>
      <H className="pvc-coll-title">
        <SiteLink href={href} className="pvc-link">
          {title}
        </SiteLink>
      </H>
      <p className="text-plum flex items-center gap-1.5 text-[14px] font-semibold">
        Alle ansehen
        {typeof count === "number" ? <span className="sr-only">, {count} Produkte</span> : null}
        <ArrowRightIcon className="h-4 w-4" />
      </p>
    </article>
  );
}

function Motif({ motif }: { motif: CollectionMotif }) {
  switch (motif) {
    case "alle":
      return <CanTrio className="pvc-coll-trio" sizes="80px" />;
    case "eistee":
      return (
        <>
          <Blob className="pvc-coll-blob text-butter" opacity={0.9} />
          <Image
            src="/images/cans/peach.webp"
            alt=""
            width={405}
            height={760}
            sizes="70px"
            className="pvc-coll-can"
          />
        </>
      );
    case "bundles":
      return (
        <Image
          src="/images/bundle-3.jpg"
          alt=""
          width={1400}
          height={924}
          sizes="(min-width: 1024px) 240px, 45vw"
          className="pvc-coll-photo"
          data-pv-zoom=""
        />
      );
    default:
      return (
        <span className="text-aubergine flex items-center gap-3.5">
          <ShirtIcon className="h-11 w-11" />
          <CupIcon className="h-10 w-10" />
        </span>
      );
  }
}

export default CollectionCard;
