"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogImage } from "@/lib/catalog/products";
import { CanTrio } from "./CanTrio";
import { Blob, ChevronIcon } from "./icons";

/**
 * Galerie der Produktseite (Figma Hauptbild 35:10370, Vorschaubilder 35:10426).
 *
 * Alle Bilder stehen im Server-HTML in einer horizontalen Scroll-Snap-Spur; Vorschaubilder sind
 * Anker auf die Slides. Das funktioniert ohne JavaScript (wischen, scrollen, Anker). Mit
 * JavaScript kommen Pfeile dazu, die Vorschau markiert das aktive Bild und Anker scrollen nur
 * die Spur statt der ganzen Seite.
 */
export interface GallerySlide {
  kind: "can" | "trio" | "photo" | "placeholder";
  image?: CatalogImage;
  label: string;
}

export function ProductGallery({
  id,
  slides,
  palette,
  badges = [],
  showStickers = false,
  placeholderTitle,
}: {
  id: string;
  slides: GallerySlide[];
  palette: { from: string; via: string; to: string };
  badges?: { label: string; tone: "berry" | "butter" }[];
  showStickers?: boolean;
  placeholderTitle?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = slides.length;

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, track.children.length - 1));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: clamped * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => setActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const gradient = {
    "--g-from": palette.from,
    "--g-via": palette.via,
    "--g-to": palette.to,
  } as React.CSSProperties;

  return (
    <div className="pvc-gallery">
      <div className="relative">
        <div
          ref={trackRef}
          id={`${id}-spur`}
          className="pvc-gallery-track"
          tabIndex={0}
          role="group"
          aria-roledescription="Galerie"
          aria-label={`Produktbilder, ${count} ${count === 1 ? "Bild" : "Bilder"}`}
        >
          {slides.map((slide, i) => (
            <figure
              key={`${slide.kind}-${i}`}
              id={`${id}-bild-${i + 1}`}
              className={`pvc-slide ${slide.kind === "photo" ? "pvc-slide--photo" : "pvc-slide--can"}`}
              style={slide.kind === "photo" ? undefined : gradient}
              aria-label={`Bild ${i + 1} von ${count}: ${slide.label}`}
            >
              <SlideContent
                slide={slide}
                index={i}
                showStickers={showStickers}
                placeholderTitle={placeholderTitle}
              />
            </figure>
          ))}
        </div>

        {badges.length ? (
          <div className="pointer-events-none absolute top-4 left-4 z-[2] flex flex-wrap gap-2 lg:top-5 lg:left-5">
            {badges.map((b) => (
              <span
                key={b.label}
                className={`rounded-pill px-4 py-1.5 text-[14px] font-bold ${
                  b.tone === "berry"
                    ? "bg-pv-wildberry text-pv-white"
                    : "bg-pv-lime-raspberry text-pv-wildberry border-pv-wildberry border-2"
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        ) : null}

        {count > 1 ? (
          <>
            <button
              type="button"
              className="pvc-gallery-arrow left-4"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="Vorheriges Bild"
              aria-controls={`${id}-spur`}
            >
              <ChevronIcon className="h-6 w-6 rotate-90" />
            </button>
            <button
              type="button"
              className="pvc-gallery-arrow right-4"
              onClick={() => goTo(active + 1)}
              disabled={active >= count - 1}
              aria-label="Nächstes Bild"
              aria-controls={`${id}-spur`}
            >
              <ChevronIcon className="h-6 w-6 -rotate-90" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <>
          {/* Mobil: Punkte */}
          <div className="mt-3 flex justify-center gap-2 lg:hidden" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} className="pvc-dot" aria-current={i === active ? "true" : undefined} />
            ))}
          </div>
          {/* Desktop: Vorschaubilder als Anker */}
          <ul className="mt-3.5 hidden gap-3 lg:flex" aria-label="Vorschaubilder">
            {slides.map((slide, i) => (
              <li key={i}>
                <a
                  href={`#${id}-bild-${i + 1}`}
                  className="pvc-thumb"
                  style={
                    slide.kind === "photo" ? undefined : { ...gradient, background: palette.from }
                  }
                  aria-current={i === active ? "true" : undefined}
                  aria-label={`Bild ${i + 1} zeigen: ${slide.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(i);
                  }}
                >
                  <Thumb slide={slide} />
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function SlideContent({
  slide,
  index,
  showStickers,
  placeholderTitle,
}: {
  slide: GallerySlide;
  index: number;
  showStickers: boolean;
  placeholderTitle?: string;
}) {
  if (slide.kind === "photo" && slide.image) {
    return (
      <Image
        src={slide.image.src}
        alt={slide.image.alt}
        width={slide.image.width}
        height={slide.image.height}
        sizes="(min-width: 1024px) 588px, 100vw"
        preload={index === 0}
        className="pvc-slide-photo"
      />
    );
  }
  if (slide.kind === "placeholder") {
    return (
      <span className="text-pv-wildberry relative z-[1] flex flex-col items-center gap-2 text-center">
        <span className="text-[22px] font-medium">{placeholderTitle}</span>
        <span className="border-pv-wildberry rounded-pill border px-3 py-1 text-[12px] font-medium">
          Foto folgt
        </span>
      </span>
    );
  }
  return (
    <>
      <Blob className="pvc-slide-blob top-[35%] left-[-20%] h-[65%] w-[72%]" />
      <Blob className="pvc-slide-blob top-[-14%] right-[-14%] h-[46%] w-[52%]" />
      {slide.kind === "trio" ? (
        <CanTrio
          className="relative z-[1] [--trio-h:min(62vw,330px)]"
          sizes="(min-width: 1024px) 240px, 40vw"
          preload={index === 0}
          alt={slide.label}
        />
      ) : slide.image ? (
        <Image
          src={slide.image.src}
          alt={slide.image.alt}
          width={slide.image.width}
          height={slide.image.height}
          sizes="(min-width: 1024px) 270px, 45vw"
          preload={index === 0}
          className="pvc-slide-can"
        />
      ) : null}
      {showStickers && index === 0 ? (
        <>
          <span
            className="pvc-sticker-protein top-[8%] right-[10%] [--s:84px] lg:top-[10%] lg:right-[12%] lg:[--s:109px]"
            aria-hidden="true"
          >
            <b>15 g</b>
            <small>Protein</small>
          </span>
          <span
            className="pvc-sticker-butter bottom-[9%] left-[6%] text-[15px] lg:text-[19px]"
            aria-hidden="true"
          >
            Such dir deinen Vibe.
          </span>
        </>
      ) : null}
    </>
  );
}

function Thumb({ slide }: { slide: GallerySlide }) {
  if (slide.kind === "photo" && slide.image) {
    return (
      <Image
        src={slide.image.src}
        alt=""
        width={slide.image.width}
        height={slide.image.height}
        sizes="88px"
        className="h-full w-full object-cover"
      />
    );
  }
  if (slide.kind === "trio") return <CanTrio className="[--trio-h:60px]" sizes="40px" />;
  if (slide.kind === "can" && slide.image) {
    return (
      <Image
        src={slide.image.src}
        alt=""
        width={slide.image.width}
        height={slide.image.height}
        sizes="40px"
        className="h-[76px] w-auto"
      />
    );
  }
  return <span className="text-[11px] font-medium">Foto folgt</span>;
}

export default ProductGallery;
