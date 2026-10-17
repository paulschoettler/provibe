"use client";

import { useEffect } from "react";
import { MOTION_ATTR, prefersReducedMotion, revealOnScroll } from "./reveal";
import { enableTilt } from "./tilt";

/**
 * Bewegung der Unterseiten (Über uns, Partner, Shop). Rendert nichts, die Seiten bleiben
 * Server-Komponenten und markieren ihre Elemente nur mit data-Attributen:
 *
 * - data-pv-reveal: blendet beim Hereinscrollen einmal ein (Wert "pop" hebt kurz federnd an).
 *   Was in einem Rutsch sichtbar wird, kommt gestaffelt.
 * - data-pv-stagger: alle direkten Kinder bekommen data-pv-reveal (Karten-Raster).
 * - data-pv-parallax="24": kleiner vertikaler Versatz in px, an den Scroll gekoppelt (Blobs).
 * - data-pv-zoom: Bild zoomt beim Hereinscrollen weich von 1,1 auf 1 (Rahmen schneidet ab).
 * - data-pv-tilt: leichte Neigung zur Maus, nur Desktop mit Maus.
 *
 * Progressive Enhancement: Die Stile in globals.css ("Motion Unterseiten") greifen nur mit
 * html[data-motion]. Das Attribut setzt erst dieser Effekt und nur ohne prefers-reduced-motion.
 * Ohne JavaScript, vor der Hydration und bei reduzierter Bewegung ist alles sofort sichtbar.
 * Animiert werden nur translate, scale, transform und opacity (Compositor, 60 fps).
 * Bewegungssprache wie auf der Startseite: GSAP ScrollTrigger mit scrub für alles, was am
 * Scroll hängt, sanfte Ausklang-Kurven für das Einblenden.
 */
export function PageMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = document.documentElement;
    const cleanups: Array<() => void> = [];

    cleanups.push(revealOnScroll());
    root.setAttribute(MOTION_ATTR, "");
    cleanups.push(enableTilt());

    // GSAP erst nachladen, wenn es etwas am Scroll zu koppeln gibt.
    let disposed = false;
    const scrubbed = document.querySelectorAll("[data-pv-parallax], [data-pv-zoom]");
    if (scrubbed.length > 0) {
      void import("./scrub").then(({ scrubOnScroll }) => {
        if (disposed) return;
        cleanups.push(scrubOnScroll());
      });
    }

    return () => {
      disposed = true;
      for (const fn of cleanups.reverse()) fn();
      root.removeAttribute(MOTION_ATTR);
    };
  }, []);

  return null;
}

export default PageMotion;
