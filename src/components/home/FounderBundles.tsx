import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import type { HomeBundle } from "@/lib/catalog/home";
import { formatEur } from "@/lib/money";
import { RevealObserver } from "./use-reveal";

/**
 * "Founder Bundles": gleicher Aufbau wie #pvshop, Inhalte aus der Datenbank in der
 * gelieferten Reihenfolge. Statt eines Streichpreises steht "Einzeln: X €" darunter
 * (Entscheidung B4), weil ein durchgestrichener Preis eine Preisherabsetzung im Sinne
 * des § 11 PAngV wäre.
 */
export function FounderBundles({ bundles }: { bundles: HomeBundle[] }) {
  if (bundles.length === 0) return null;

  return (
    <section id="pvbundles" className="pvshop-section pvshop-section--cream">
      <RevealObserver />
      <div className="pvshop-head reveal">
        <div>
          <div className="pvshop-eyebrow">Founder Bundles</div>
          <h2 className="pvshop-title">Alles in einem Set.</h2>
        </div>
        <SiteLink className="pvshop-all" href="/collections/aktion">
          Alle ansehen
        </SiteLink>
      </div>

      <div className="pvshop-grid">
        {bundles.map((bundle, index) => (
          <SiteLink
            key={bundle.handle}
            className="pvshop-card pvshop-card--bundle reveal"
            href={bundle.productUrl}
            style={{ transitionDelay: `${index * 110}ms` }}
          >
            <span className="pvshop-badge">Bundle</span>
            <div className="pvbundle-media">
              <Image
                src={bundle.imageUrl}
                alt={bundle.title}
                width={1400}
                height={924}
                sizes="(min-width: 861px) 33vw, 88vw"
                className="pvbundle-img"
              />
            </div>
            <h3 className="pvbundle-title">{bundle.title}</h3>
            <div className="pvshop-meta">
              <div>
                <div className="pvshop-name">{bundle.badge}</div>
                {bundle.componentsSumCents > bundle.priceCents ? (
                  <div className="pvshop-sub">Einzeln: {formatEur(bundle.componentsSumCents)}</div>
                ) : null}
              </div>
              <div className="pvshop-price">{formatEur(bundle.priceCents)}</div>
            </div>
          </SiteLink>
        ))}
      </div>
    </section>
  );
}

export default FounderBundles;
