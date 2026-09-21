"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useHomeStore } from "@/lib/home/store";

/**
 * Bewegungs-Grundlage der Startseite (Arbeitspaket A). Rendert nichts.
 *
 * Aufgaben:
 * 1. GSAP ScrollTrigger registrieren (einmal, vor allen anderen Triggern).
 * 2. Fähigkeitsprüfung: WebGL, prefers-reduced-motion, schwache Geräte. Ergebnis
 *    landet im Store als tier und als html[data-tier].
 * 3. Lenis nur auf Desktop (Pointer fine und mindestens 1024 px) und nur ohne
 *    reduced motion, sauber mit ScrollTrigger und dem gsap-Ticker verbunden.
 *
 * Gehört so weit oben wie möglich in den Baum, damit tier steht, bevor CanScene mountet.
 */

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
}

/** Testweise einen WebGL-Kontext anlegen und sofort wieder freigeben. */
function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Schwaches Gerät: wenige Kerne zusammen mit wenig Speicher. */
function isWeakDevice(): boolean {
  const nav = navigator as NavigatorWithHints;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
  return cores <= 4 && memory <= 2;
}

export default function HomeMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduced = prefersReducedMotion();
    const tier = !reduced && supportsWebgl() && !isWeakDevice() ? "3d" : "static";
    useHomeStore.getState().setTier(tier);

    // Lenis: weiches Scrollen nur auf Desktop mit Maus, natives Scrollen auf Mobil (G10).
    const wantsLenis =
      !reduced &&
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(min-width: 1024px)").matches;

    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    if (wantsLenis) {
      lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
      // Lenis setzt die Klassen html.lenis und html.lenis-smooth selbst, dazu die
      // Stile aus globals.css. Zusätzlich markieren wir die Seite für eigenes CSS.
      document.documentElement.setAttribute("data-lenis", "");
      lenis.on("scroll", ScrollTrigger.update);
      const instance = lenis;
      tick = (time: number) => instance.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    // Nach dem ersten Layout alle Trigger neu vermessen (Schriften, Bilder, svh).
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 0);

    return () => {
      window.clearTimeout(refresh);
      if (tick) gsap.ticker.remove(tick);
      if (lenis) {
        lenis.destroy();
        document.documentElement.removeAttribute("data-lenis");
        gsap.ticker.lagSmoothing(500, 33);
      }
    };
  }, []);

  return null;
}
