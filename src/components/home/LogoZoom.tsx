import Image from "next/image";
import { SiteLink } from "@/components/layout/SiteLink";
import type { HomeFlavor } from "@/lib/catalog/home";
import { Brombeere, Erdbeere, Pfirsichhaelfte } from "./hero/FruitStickers";
import { LogoZoomMotion } from "./LogoZoomMotion";
import { FinaleMarquee } from "./finale/FinaleMarquee";
import type { FinaleCanKey } from "./finale/choreography";
import { finalePriceLine } from "./finale/price";

/**
 * Finale vor dem Footer (#pvlogo): Logo-Zoom mit drei Dosen und finalem CTA.
 *
 * Figma: Datei wttVzqEheGArNkqUliXd3x, Sektion "Finale" (95:577), Frames "Finale / Mobil",
 * "Finale / Desktop" und "Finale / Choreografie". Die Bühne besteht aus zwei
 * übereinanderliegenden, gleich großen Ebenen in einer Pin-Strecke:
 *
 * - hinten: Blobs und Logo
 * - vorne: Eyebrow, Dosen, Sticker, Headline, Subline, CTA und Pills
 *
 * Die Trennung erlaubt der fixen 3D-Canvas (z-index 0), sich zwischen beide Ebenen zu
 * schieben: Mit html[data-tier="3d"] rutscht die hintere Ebene auf z-index -1, die
 * Szene zeichnet die drei Dosen genau an die Stelle der PNG-Platzhalter (CanScene liest
 * deren Lage aus dem DOM), und Sticker und Text bleiben davor.
 *
 * Alles Inhaltliche steht im Server-HTML. Ohne JavaScript und bei reduzierter Bewegung
 * gilt der Endzustand aus dem CSS; die Bewegung setzt LogoZoomMotion als Inline-Styles.
 */

interface FinaleCan {
  key: FinaleCanKey;
  src: string;
  width: number;
  height: number;
  fallbackName: string;
}

/** Reihenfolge = Zeichenreihenfolge: Raspberry Lime steht vorn. */
const CANS: FinaleCan[] = [
  {
    key: "wildberry",
    src: "/images/cans/wildberry.webp",
    width: 750,
    height: 1400,
    fallbackName: "Wildberry",
  },
  {
    key: "peach",
    src: "/images/cans/peach.webp",
    width: 405,
    height: 760,
    fallbackName: "Peach",
  },
  {
    key: "raspberry-lime",
    src: "/images/cans/raspberry-lime.webp",
    width: 405,
    height: 760,
    fallbackName: "Raspberry Lime",
  },
];

/** Endwinkel der Dosen (Zustand 3), damit CanScene ihn auch ohne Bewegung kennt. */
const CAN_END_ROTATE: Record<FinaleCanKey, number> = {
  wildberry: -9,
  peach: 9,
  "raspberry-lime": 0,
};

const BLOBS = [
  { name: "pink", src: "/images/finale/blob-pink.svg", width: 300, height: 270 },
  { name: "peach", src: "/images/finale/blob-peach.svg", width: 280, height: 250 },
  { name: "butter", src: "/images/finale/blob-butter.svg", width: 220, height: 200 },
] as const;

export interface LogoZoomProps {
  flavors: HomeFlavor[];
}

export function LogoZoom({ flavors }: LogoZoomProps) {
  const price = finalePriceLine(flavors);
  const nameOf = (key: FinaleCanKey, fallback: string) =>
    flavors.find((f) => f.slug === key)?.shortName ?? fallback;

  return (
    <section id="pvlogo" className="finale" aria-labelledby="finale-title">
      <div className="finale-pin">
        {/* Hintere Ebene: Blobs und Logo */}
        <div className="finale-layer finale-back">
          <div className="finale-box">
            {BLOBS.map((blob) => (
              <Image
                key={blob.name}
                src={blob.src}
                alt=""
                aria-hidden="true"
                width={blob.width}
                height={blob.height}
                className={`finale-blob finale-blob--${blob.name}`}
              />
            ))}
            <Image
              src="/images/finale/blob-buehne.svg"
              alt=""
              aria-hidden="true"
              width={720}
              height={560}
              className="finale-blob finale-blob--stage"
              data-finale="blob"
            />
            <Image
              src="/images/brand/logo-wine.png"
              alt="provibe"
              width={1000}
              height={297}
              sizes="(min-width: 900px) 66vw, 88vw"
              className="finale-logo"
              data-finale="logo"
            />
          </div>
        </div>

        {/* Vordere Ebene: Eyebrow, Dosen, Sticker und Text */}
        <div className="finale-layer finale-front">
          <div className="finale-box">
            <p className="pv-eyebrow finale-eyebrow">Bereit für deinen Vibe?</p>

            {CANS.map((can) => (
              <div
                key={can.key}
                className={`finale-can finale-can--${can.key}`}
                data-finale-can={can.key}
                data-r={CAN_END_ROTATE[can.key]}
                data-r-end={CAN_END_ROTATE[can.key]}
                data-o="1"
              >
                <Image
                  src={can.src}
                  alt={`provibe ${nameOf(can.key, can.fallbackName)}, 0,33 l Dose`}
                  width={can.width}
                  height={can.height}
                  sizes="(min-width: 900px) 15vw, 40vw"
                  className="finale-can__img"
                />
              </div>
            ))}

            <span className="finale-sticker" data-finale="sticker" aria-hidden="true">
              <span className="finale-sticker__value">15 g</span>
              <span className="finale-sticker__label">Protein</span>
            </span>
            <span
              className="finale-fruit finale-fruit--brombeere"
              data-finale="fruit"
              aria-hidden="true"
            >
              <span className="finale-fruit__float">
                <Brombeere />
              </span>
            </span>
            <span
              className="finale-fruit finale-fruit--erdbeere"
              data-finale="fruit"
              aria-hidden="true"
            >
              <span className="finale-fruit__float">
                <Erdbeere />
              </span>
            </span>
            <span
              className="finale-fruit finale-fruit--pfirsich"
              data-finale="fruit"
              aria-hidden="true"
            >
              <span className="finale-fruit__float">
                <Pfirsichhaelfte />
              </span>
            </span>
          </div>

          <div className="finale-copy" data-finale="copy">
            <h2 id="finale-title" className="finale-title">
              <span className="finale-title__line">Dein Vibe.</span>{" "}
              <span className="finale-title__line finale-title__line--accent">Deine Dose.</span>
            </h2>
            <p className="finale-sub">
              15 g Protein in jeder 0,33 l Dose, laktosefrei und in drei Sorten. Versand in 3 bis 5
              Werktagen, ab 50 € versandkostenfrei.
            </p>
          </div>

          <div className="finale-cta">
            <SiteLink href="/pages/shop" className="btn-primary finale-btn">
              Jetzt Dosen sichern
            </SiteLink>
            <SiteLink
              href="/collections/aktion"
              className="btn-pill finale-btn finale-btn--outline"
            >
              Founder Bundles ansehen
            </SiteLink>
            {price ? (
              <p className="finale-price">
                {price.unitCount}er-Pack ab {price.price} zzgl. {price.deposit} Pfand{" "}
                <span className="finale-nowrap">({price.basePrice})</span>
                <br />
                inkl. MwSt., zzgl. Versand
              </p>
            ) : null}
            <ul className="finale-pills" aria-label="Versand, Pfand und Zahlarten">
              <li className="finale-pill finale-pill--butter">Versand 3 bis 5 Werktage</li>
              {price ? (
                <li className="finale-pill finale-pill--pink">
                  Pfand {price.depositPerCan} je Dose
                </li>
              ) : null}
              <li className="finale-pill finale-pill--cream">
                Karte · Apple Pay · Google Pay · PayPal · Klarna
              </li>
            </ul>
          </div>
        </div>

        {/* Pin-Strecke: Höhe nur mit JavaScript und ohne reduzierte Bewegung (CSS). */}
        <div className="finale-pin-space" aria-hidden="true" />
      </div>

      <FinaleMarquee />

      <LogoZoomMotion />
    </section>
  );
}

export default LogoZoom;
