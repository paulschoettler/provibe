import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import { WaveDivider } from "@/components/layout/WaveDivider";
import { RevealObserver } from "./use-reveal";

/**
 * "Protein for your purse" (#pvbanner). Text wörtlich aus dem alten Shop, inklusive
 * des Gedankenstrichs: das ist Kundentext und wird nicht umformuliert.
 *
 * Abweichung vom Ist: Hintergrund ist Butter statt Creme, damit die Wellen oben und
 * unten sichtbar werden (Wellen-Stellen 2 und 3).
 */
export function PurseBanner() {
  return (
    <section id="pvbanner" className="pvbanner-section">
      <RevealObserver />
      <WaveDivider shape="swell" fill="var(--pv-lime-raspberry)" position="top" flip />

      <div className="pvbanner-media reveal">
        <Image
          src="/images/purse-circle.jpg"
          alt="provibe Protein Eistee"
          width={1200}
          height={1600}
          sizes="(min-width: 861px) 520px, 80vw"
          className="pvbanner-img"
        />
      </div>

      <div className="pvbanner-copy reveal" style={{ transitionDelay: "120ms" }}>
        <div className="pvbanner-eyebrow">Protein for your purse</div>
        <h2 className="pvbanner-title">Schluss mit dem pelzigen Proteingefühl.</h2>
        <p className="pvbanner-text">
          Keine Lust mehr auf eine 30-€-Riesendose Pulver, die nach Sport schmeckt und null
          erfrischt? provibe ist der erfrischendste Eistee mit 15 g Protein – ready to drink, klein
          genug für jede Tasche.
        </p>
        <SiteLink href="/collections/all" className="link-caps pvbanner-link">
          Jetzt entdecken
        </SiteLink>
      </div>

      <WaveDivider shape="soft" fill="var(--pv-lime-raspberry)" position="bottom" />
    </section>
  );
}

export default PurseBanner;
