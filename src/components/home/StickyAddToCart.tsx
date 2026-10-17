"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useHomeStore } from "@/lib/home/store";
import { CartIcon } from "./hero/HeroIcons";

/**
 * Dauerhafter Warenkorb-Button als Dock (Arbeitspaket A, Antworten G5 und G6,
 * Figma-Richtung A): cremefarbene Pill mit Mini-Dose der aktiven Sorte, Zeile
 * "Wildberry · 9 Dosen" und Magenta-Button.
 *
 * Mobil unten mittig über der Safe-Area, auf Desktop unten links. Zeigt die
 * aktive Sorte und die Packgröße, aber keinen Preis (G4: kein Preis im Hero).
 * Steht immer im Server-HTML, die Sichtbarkeit steuert ein data-Attribut:
 * sichtbar, solange die Hero- und Sequenz-Bühne im Bild ist, danach fährt er
 * nach unten und kommt beim Zurückscrollen wieder.
 */

export interface StickyFlavor {
  shortName: string;
  variantId: string;
  unitCount: number;
  /** Freigestelltes Dosenbild. Fehlt es, nimmt das Dock das Bild aus dem Hero. */
  imageUrl?: string;
}

/**
 * Die Mini-Dose nutzt dieselben Dateien wie die Dosen-PNGs im Hero. Die liegen
 * dann schon im Cache, das Dock lädt keine zusätzlichen Bytes. Als Zeichenkette,
 * damit useSyncExternalStore einen stabilen Wert vergleicht.
 */
function readHeroImages(): string {
  return Array.from(document.querySelectorAll<HTMLImageElement>("#pv-hero .pv-can[data-pv-flavor]"))
    .sort((a, b) => Number(a.dataset.pvFlavor) - Number(b.dataset.pvFlavor))
    .map((image) => image.getAttribute("src") ?? "")
    .join("\n");
}
function serverHeroImages(): string {
  return "";
}
/** Die Bilder im Hero ändern sich nach dem Laden nicht mehr. */
function noSubscription(): () => void {
  return () => {};
}

export default function StickyAddToCart({ flavors }: { flavors: StickyFlavor[] }) {
  const flavorIndex = useHomeStore((state) => state.flavorIndex);
  const { addLine, pending } = useCart();
  const [visible, setVisible] = useState(true);
  const heroImageList = useSyncExternalStore(noSubscription, readHeroImages, serverHeroImages);
  const heroImages = heroImageList ? heroImageList.split("\n") : [];

  useEffect(() => {
    const stage = document.getElementById("pv-sequence");
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  const flavor = flavors[flavorIndex] ?? flavors[0];
  if (!flavor) return null;
  const image = flavor.imageUrl ?? heroImages[flavorIndex] ?? "";

  const onClick = () => {
    if (pending) return;
    void addLine(flavor.variantId, 1);
  };

  return (
    <div className="pv-atc" data-visible={visible ? "true" : "false"}>
      <div className="pv-atc__dock">
        <span
          className="pv-atc__can"
          aria-hidden="true"
          style={image ? { backgroundImage: `url("${image}")` } : undefined}
        />
        <p className="pv-atc__meta" aria-live="polite" aria-atomic="true">
          <span className="pv-atc__name">{flavor.shortName}</span>
          <span className="pv-atc__sep"> · </span>
          <span className="pv-atc__count">{flavor.unitCount} Dosen</span>
        </p>
        <button
          className="btn-primary pv-atc__button"
          type="button"
          onClick={onClick}
          disabled={pending}
        >
          <span className="pv-atc__icon">
            <CartIcon />
          </span>
          {pending ? "Wird hinzugefügt…" : `${flavor.unitCount}er-Pack in den Warenkorb`}
        </button>
      </div>
    </div>
  );
}
