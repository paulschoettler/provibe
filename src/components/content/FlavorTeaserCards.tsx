import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import type { HomeFlavor } from "@/lib/catalog/home";
import { formatEur } from "@/lib/money";
import { InhaltIcon } from "./Decor";

const CAN_SIZE: Record<string, { width: number; height: number }> = {
  wildberry: { width: 750, height: 1400 },
  "raspberry-lime": { width: 405, height: 760 },
  peach: { width: 405, height: 760 },
};

/**
 * Drei Sortenkarten mit Link (Figma 404, 28:6944). Preise aus der Datenbank, Darstellung nach H11:
 * Hauptpreis ist der Packpreis ohne Pfand "ab …" mit Dosenzahl, darunter Dosenpreis, Pfand und
 * Grundpreis. Pfand steht getrennt, nie im Preis (§ 7 PAngV, Entscheidung H22).
 */
export function FlavorTeaserCards({
  flavors,
  headingLevel = 3,
}: {
  flavors: HomeFlavor[];
  headingLevel?: 2 | 3;
}) {
  const H = `h${headingLevel}` as const;
  return (
    <ul className="grid gap-4 md:grid-cols-3 lg:gap-5">
      {flavors.map((f) => {
        const size = CAN_SIZE[f.slug] ?? CAN_SIZE.peach;
        return (
          <li key={f.slug}>
            <article className="pv-flavor-card h-full">
              <div
                className="pv-flavor-card-media"
                style={{
                  background: `linear-gradient(180deg, ${f.palette.from} 0%, ${f.palette.via} 55%, ${f.palette.to} 100%)`,
                }}
              >
                <Image
                  src={f.imageUrl}
                  alt={`Dose provibe ${f.shortName}`}
                  width={size.width}
                  height={size.height}
                  sizes="120px"
                  className="pv-can-shadow"
                />
              </div>
              <div className="pv-flavor-card-body">
                <H className="text-wine m-0 text-[24px] leading-[1.15] font-semibold">
                  {f.shortName}
                </H>
                {f.notes ? <p className="text-plum m-0 text-[15px]">{f.notes}</p> : null}
                <span className="pv-pill pv-pill--pink self-start !py-[5px] !text-[13px]">
                  15 g Protein
                </span>
                <p className="pv-flavor-card-price">
                  ab {formatEur(f.pack.priceWithoutDepositCents)}{" "}
                  <small>{f.pack.unitCount} Dosen</small>
                </p>
                <p className="pv-flavor-card-fine">
                  {formatEur(f.perCanCents)} je Dose · zzgl. {formatEur(f.depositPerCanCents)} Pfand
                  je Dose · {f.pack.basePriceText} · inkl. MwSt.,{" "}
                  <SiteLink href="/pages/versand" className="underline">
                    zzgl. Versand
                  </SiteLink>
                </p>
                <SiteLink
                  href={f.productUrl}
                  className="pv-textlink !min-h-[40px] !text-[15px] !font-semibold"
                >
                  Zur Sorte<span className="sr-only"> {f.shortName}</span>
                  <InhaltIcon name="arrow" size={18} />
                </SiteLink>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export default FlavorTeaserCards;
