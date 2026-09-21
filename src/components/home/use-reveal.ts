"use client";

import { useEffect } from "react";

/**
 * Scroll-Reveal nach dem Muster der BYQ-Komponente "hummingbird-ecommerce-1":
 * Überschrift und Karten blenden beim Hereinscrollen einmalig ein.
 *
 * Die Klassen .reveal und .is-visible stehen in globals.css, die Staffelung kommt
 * serverseitig als transition-delay an den Karten. Der Hook beobachtet alle
 * .reveal-Elemente im Dokument; ohne JavaScript und bei prefers-reduced-motion
 * ist alles sofort sichtbar (ebenfalls in globals.css geregelt).
 */
export function useReveal(threshold = 0.15) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
    if (elements.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      for (const element of elements) element.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);
}

/**
 * Winziger Client-Baustein ohne eigene Ausgabe. Er hängt den Beobachter an das Dokument,
 * damit die Sektionen selbst reine Server-Komponenten bleiben können.
 */
export function RevealObserver(): null {
  useReveal();
  return null;
}
