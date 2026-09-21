"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useHomeStore } from "@/lib/home/store";

/**
 * Dauerhafter Warenkorb-Button (Arbeitspaket A, Antworten G5 und G6).
 *
 * Mobil unten mittig über der Safe-Area, auf Desktop unten links. Zeigt die
 * aktive Sorte und die Packgröße, aber keinen Preis (G4: kein Preis im Hero).
 * Steht immer im Server-HTML, die Sichtbarkeit steuert eine Klasse: sichtbar,
 * solange die Hero- und Sequenz-Bühne im Bild ist, danach fährt er nach unten
 * und kommt beim Zurückscrollen wieder.
 */

export interface StickyFlavor {
  shortName: string;
  variantId: string;
  unitCount: number;
}

export default function StickyAddToCart({ flavors }: { flavors: StickyFlavor[] }) {
  const flavorIndex = useHomeStore((state) => state.flavorIndex);
  const { addLine, pending } = useCart();
  const [visible, setVisible] = useState(true);

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

  const onClick = () => {
    if (pending) return;
    void addLine(flavor.variantId, 1);
  };

  return (
    <div className="pv-atc" data-visible={visible ? "true" : "false"}>
      <p className="pv-atc__meta" aria-live="polite" aria-atomic="true">
        {flavor.shortName} · {flavor.unitCount} Dosen
      </p>
      <button
        className="btn-primary pv-atc__button"
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Wird hinzugefügt…" : `${flavor.unitCount}er-Pack in den Warenkorb`}
      </button>
    </div>
  );
}
