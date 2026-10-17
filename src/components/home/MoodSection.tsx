import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import { WaveDivider } from "@/components/layout/WaveDivider";
import { RevealObserver } from "./use-reveal";

/**
 * Stimmungs-Sektion (Wellen-Stelle 4): vollbreites Schwarzweißbild, darüber eine
 * magentafarbene Fläche, die oben mit einer Welle beginnt (Muster royalbev.com,
 * siehe docs/referenzen-wellen-beispiel.jpg).
 */
export function MoodSection() {
  return (
    <section className="pvmood">
      <RevealObserver />
      <div className="pvmood-media">
        <Image
          src="/images/mood-bw.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="pvmood-img"
        />
      </div>

      <div className="pvmood-panel">
        <WaveDivider shape="soft" fill="var(--pv-wildberry)" position="top" />
        <div className="pvmood-copy reveal">
          <div className="pvmood-eyebrow">Powered by Protein</div>
          <h2 className="pvmood-title">Eiskalt. Erfrischend. 15 g Protein.</h2>
          <p className="pvmood-text">
            Kalt genießen, überall dabei: drei Sorten, kein Pulver, kein Shaker.
          </p>
          <SiteLink href="/collections/all" className="btn-pill pvmood-button">
            Zum Shop
          </SiteLink>
        </div>
      </div>
    </section>
  );
}

export default MoodSection;
