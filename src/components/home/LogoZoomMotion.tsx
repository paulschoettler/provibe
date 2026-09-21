"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { useHomeStore } from "@/lib/home/store";

/**
 * Bewegung des Logo-Zooms. Zwei ScrollTrigger auf derselben Sektion:
 *
 * 1. scrub: true skaliert das Logo linear von 0,5 auf 1,45 (Kurve aus dem alten Shop:
 *    scale = 0,5 + 0,95 × Fortschritt) und schreibt den Fortschritt als CSS-Variable
 *    --footer-p, aus der die PNG-Dosen ihre Transformation ableiten.
 * 2. scrub: 0.6 meldet den Fortschritt weich an den Store, damit die 3D-Szene die
 *    beiden Dosen hereinfliegen lassen kann.
 *
 * Bei prefers-reduced-motion passiert nichts, dann gilt der Endzustand aus dem CSS.
 */
export function LogoZoomMotion({ sectionId = "pvlogo" }: { sectionId?: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const section = document.getElementById(sectionId);
    const logo = section?.querySelector<HTMLElement>(".pvlogo-img");
    if (!section || !logo) return;

    gsap.registerPlugin(ScrollTrigger);
    const setFooterProgress = useHomeStore.getState().setFooterProgress;
    const proxy = { value: 0 };

    const zoom = gsap.fromTo(
      logo,
      { scale: 0.5 },
      {
        scale: 1.45,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => {
            section.style.setProperty("--footer-p", self.progress.toFixed(4));
          },
        },
      },
    );

    const flyIn = gsap.to(proxy, {
      value: 1,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
      },
      onUpdate: () => setFooterProgress(proxy.value),
    });

    return () => {
      zoom.scrollTrigger?.kill();
      zoom.kill();
      flyIn.scrollTrigger?.kill();
      flyIn.kill();
      section.style.removeProperty("--footer-p");
      gsap.set(logo, { clearProps: "transform" });
    };
  }, [sectionId]);

  return null;
}

export default LogoZoomMotion;
