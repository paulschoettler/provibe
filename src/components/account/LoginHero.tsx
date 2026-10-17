import Image from "next/image";
import type { ReactNode } from "react";
import { Eyebrow } from "./ui";

/**
 * Kopfbereich der Login- und Aktivierungsseiten (Figma 29:2781 mobil, 29:3160 Desktop):
 * Sortenverlauf Wildberry, Blob, Dosen, Sticker "15 g Protein", Welle in Creme.
 * Mobil oben über der Karte, ab 1024 px linke Hälfte neben der Karte.
 */
export function LoginHero({
  title,
  lead,
  eyebrow = "Dein Konto",
}: {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="pv-acc-hero" aria-labelledby="konto-titel">
      <div className="pv-acc-hero__blob" aria-hidden="true" />
      <div className="pv-acc-hero__blob pv-acc-hero__blob--small" aria-hidden="true" />
      <div className="pv-acc-hero__text">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 id="konto-titel" className="pv-acc-hero__title">
          {title}
        </h1>
        {lead ? <p className="pv-acc-hero__lead">{lead}</p> : null}
      </div>

      <div className="pv-acc-hero__cans" aria-hidden="true">
        <Image
          src="/images/cans/peach.webp"
          alt=""
          width={405}
          height={760}
          sizes="(min-width: 1024px) 150px, 1px"
          className="pv-acc-hero__can pv-acc-hero__can--left"
        />
        <Image
          src="/images/cans/raspberry-lime.webp"
          alt=""
          width={405}
          height={760}
          sizes="(min-width: 1024px) 150px, 1px"
          className="pv-acc-hero__can pv-acc-hero__can--right"
        />
        <Image
          src="/images/cans/wildberry.webp"
          alt=""
          width={750}
          height={1400}
          priority
          sizes="(min-width: 1024px) 200px, 100px"
          className="pv-acc-hero__can pv-acc-hero__can--main"
        />
        <span className="pv-acc-sticker">
          <span className="pv-acc-sticker__big">15 g</span>
          <span className="pv-acc-sticker__small">Protein</span>
        </span>
      </div>

      <svg
        className="pv-acc-hero__wave"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 70 C 240 24, 470 24, 720 58 C 970 92, 1200 92, 1440 50 L1440 120 L0 120 Z" />
      </svg>
    </section>
  );
}

export default LoginHero;
