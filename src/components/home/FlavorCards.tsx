import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import { WaveDivider } from "@/components/layout/WaveDivider";
import type { HomeFlavor } from "@/lib/catalog/home";
import { formatEur } from "@/lib/money";
import { RevealObserver } from "./use-reveal";

/** Maße der freigestellten Dosen in public/images/cans */
const CAN_SIZE: Record<string, { width: number; height: number }> = {
  wildberry: { width: 750, height: 1400 },
  "raspberry-lime": { width: 405, height: 760 },
  peach: { width: 405, height: 760 },
};

/**
 * "Unsere Sorten": Aufbau, Klassen und Maße 1:1 aus dem alten Shop (#pvshop).
 * Preise, Pfand und Grundpreis kommen aus der Datenbank, der Grundpreis steht
 * an jedem Preis, weil die Preisangabenverordnung das verlangt. Der Dosenpreis ist ohne
 * Pfand, das Pfand steht getrennt daneben (§ 7 PAngV, Entscheidung H22).
 */
export function FlavorCards({ flavors }: { flavors: HomeFlavor[] }) {
  return (
    <section id="pvshop" className="pvshop-section">
      <RevealObserver />
      <WaveDivider shape="swell" fill="#fbfaf3" position="top" />

      <div className="pvshop-head reveal">
        <div>
          <div className="pvshop-eyebrow">Unsere Sorten</div>
          <h2 className="pvshop-title">Such dir deinen Vibe.</h2>
        </div>
        <SiteLink className="pvshop-all" href="/collections/all">
          Alle ansehen
        </SiteLink>
      </div>

      <div className="pvshop-grid">
        {flavors.map((flavor, index) => {
          const size = CAN_SIZE[flavor.slug] ?? { width: 405, height: 760 };
          return (
            <SiteLink
              key={flavor.slug}
              className="pvshop-card reveal"
              href={flavor.productUrl}
              style={{ transitionDelay: `${index * 110}ms` }}
            >
              <h3 className="pvshop-flavor">{flavor.shortName}</h3>
              <span className="pvshop-badge">15 g Protein</span>
              <div className="pvshop-can">
                <Image
                  src={flavor.imageUrl}
                  alt={`provibe ${flavor.shortName}`}
                  width={size.width}
                  height={size.height}
                  sizes="(min-width: 861px) 220px, 180px"
                />
              </div>
              <div className="pvshop-meta">
                <div>
                  <div className="pvshop-name">Eistee · 0,33 l</div>
                  <div className="pvshop-sub">{flavor.notes}</div>
                </div>
                <div className="pvshop-price">{formatEur(flavor.perCanCents)}</div>
              </div>
              <div className="pvshop-fine">
                je Dose, zzgl. {formatEur(flavor.depositPerCanCents)} Pfand ·{" "}
                {flavor.pack.basePriceText}
              </div>
            </SiteLink>
          );
        })}
      </div>
    </section>
  );
}

export default FlavorCards;
