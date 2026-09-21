"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { FlavorPalette } from "@/lib/catalog/home";
import { useHomeStore } from "@/lib/home/store";
import { heroGeometry } from "./hero-geometry";

/**
 * Interaktivität des Heros (Arbeitspaket A). Rendert nichts, hängt sich an die
 * Server-Markup-Knoten von Hero.tsx über data-Attribute.
 *
 * Aufgaben:
 * - Maße von Dose und Sequenz als CSS-Variablen auf die Sektion schreiben, damit
 *   das PNG im DOM exakt dort steht, wo CanScene die 3D-Dose rendert.
 * - ScrollTrigger mit scrub 0,8 über #pv-hero: schreibt --seq und store.seqProgress.
 * - Sortenwechsel per Pfeilen, Punkten, Tastatur und Wischen.
 * - Farbwelt (--flavor-*) auf dem <html>-Element weich überblenden.
 * - PNG ausblenden, sobald das 3D-Modell der Sorte bereit ist.
 */

export interface HeroFlavorView {
  slug: string;
  shortName: string;
  palette: FlavorPalette;
}

const SWIPE_THRESHOLD = 40;
/** Ab diesem Fortschritt sind die Hero-Texte weg und nicht mehr fokussierbar. */
const HERO_TEXT_GONE = 0.34;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export default function HeroExperience({ flavors }: { flavors: HeroFlavorView[] }) {
  useEffect(() => {
    const section = document.getElementById("pv-hero");
    const stage = document.getElementById("pv-sequence");
    if (!section || !stage || flavors.length === 0) return;

    const store = useHomeStore;
    store.setState({ flavorCount: flavors.length });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    // ---------------------------------------------------------------- Maße
    let lastWidth = 0;
    let lastHeight = 0;

    const applyGeometry = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const geometry = heroGeometry(width, height);
      const style = section.style;
      style.setProperty("--pv-vh", `${height}px`);
      style.setProperty("--pv-can-h", `${geometry.canHeightFraction * height}px`);
      style.setProperty("--pv-can-top", `${(0.5 - geometry.canCenterYFraction) * height}px`);
      style.setProperty("--pv-seq-x", `${geometry.seqShiftXFraction * width}px`);
      style.setProperty("--pv-seq-y", `${geometry.seqShiftYFraction * height}px`);
      style.setProperty("--pv-seq-scale", String(geometry.seqScale - 1));
      lastWidth = width;
      lastHeight = height;
    };

    applyGeometry();

    // Auf Mobil ändert die ein- und ausfahrende Adressleiste nur die Höhe. Erst ab
    // 120 px neu rechnen, sonst springt das Layout beim Scrollen.
    const onResize = () => {
      const widthChanged = window.innerWidth !== lastWidth;
      const heightChanged = Math.abs(window.innerHeight - lastHeight) > 120;
      if (!widthChanged && !heightChanged) return;
      applyGeometry();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    cleanups.push(() => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    });

    // ------------------------------------------------------- Scroll-Sequenz
    const setSeq = (value: number) => {
      section.style.setProperty("--seq", value.toFixed(4));
      stage.dataset.seqPast = value >= HERO_TEXT_GONE ? "true" : "false";
      stage.dataset.facts = value >= 0.45 ? "true" : "false";
      store.getState().setSeqProgress(value);
    };

    if (reduced) {
      // Ohne Bewegung bleibt die Sequenz statisch, die Zutaten stehen sofort da.
      document.documentElement.setAttribute("data-flat", "");
      cleanups.push(() => document.documentElement.removeAttribute("data-flat"));
      setSeq(1);
    } else {
      gsap.registerPlugin(ScrollTrigger);
      const proxy = { value: 0 };
      const tween = gsap.to(proxy, {
        value: 1,
        ease: "none",
        onUpdate: () => setSeq(proxy.value),
      });
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
        animation: tween,
        invalidateOnRefresh: true,
      });
      cleanups.push(() => {
        trigger.kill();
        tween.kill();
      });
    }

    // ------------------------------------------------------- Sortenwechsel
    const flavorNodes = Array.from(section.querySelectorAll<HTMLElement>("[data-pv-flavor]"));
    const dots = Array.from(section.querySelectorAll<HTMLButtonElement>("[data-pv-dot]"));

    /** PNG der Sorte ausblenden, sobald ihr 3D-Modell steht (G11). */
    const cans = Array.from(section.querySelectorAll<HTMLElement>(".pv-can[data-pv-flavor]"));
    const applyModelReady = () => {
      const state = store.getState();
      for (const can of cans) {
        const own = Number(can.dataset.pvFlavor);
        const ready = state.tier === "3d" && state.modelReady[own] === true;
        can.dataset.modelReady = ready ? "true" : "false";
      }
    };

    const applyFlavor = (index: number, duration: number) => {
      for (const node of flavorNodes) {
        const own = Number(node.dataset.pvFlavor);
        node.dataset.active = own === index ? "true" : "false";
      }
      for (const dot of dots) {
        const own = Number(dot.dataset.pvDot);
        if (own === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      }
      const palette = flavors[index]?.palette;
      if (palette) {
        gsap.to(document.documentElement, {
          duration,
          ease: "power2.out",
          overwrite: "auto",
          "--flavor-from": palette.from,
          "--flavor-via": palette.via,
          "--flavor-to": palette.to,
          "--flavor-accent": palette.accent,
        });
      }
      applyModelReady();
    };

    applyFlavor(store.getState().flavorIndex, 0);

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.flavorIndex !== previous.flavorIndex) {
        applyFlavor(state.flavorIndex, reduced ? 0 : 0.6);
      } else if (state.modelReady !== previous.modelReady || state.tier !== previous.tier) {
        applyModelReady();
      }
    });
    cleanups.push(unsubscribe);

    // ------------------------------------------------- Pfeile, Punkte, Tasten
    const onPrev = () => store.getState().prev();
    const onNext = () => store.getState().next();

    const prevButton = section.querySelector<HTMLButtonElement>("[data-pv-prev]");
    const nextButton = section.querySelector<HTMLButtonElement>("[data-pv-next]");
    prevButton?.addEventListener("click", onPrev);
    nextButton?.addEventListener("click", onNext);
    cleanups.push(() => {
      prevButton?.removeEventListener("click", onPrev);
      nextButton?.removeEventListener("click", onNext);
    });

    const dotHandlers = dots.map((dot) => {
      const handler = () => store.getState().setFlavor(Number(dot.dataset.pvDot));
      dot.addEventListener("click", handler);
      return () => dot.removeEventListener("click", handler);
    });
    cleanups.push(() => dotHandlers.forEach((off) => off()));

    // Tastatur nur, solange die Bühne im Bild ist und niemand in ein Feld tippt.
    let stageVisible = true;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) stageVisible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(stage);
    cleanups.push(() => observer.disconnect());

    const onKeyDown = (event: KeyboardEvent) => {
      if (!stageVisible || event.defaultPrevented || isTypingTarget(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown));

    // ------------------------------------------------------------- Wischen
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      if (deltaX < 0) onNext();
      else onPrev();
    };
    stage.addEventListener("pointerdown", onPointerDown, { passive: true });
    stage.addEventListener("pointerup", onPointerEnd, { passive: true });
    stage.addEventListener("pointercancel", onPointerEnd, { passive: true });
    cleanups.push(() => {
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointerup", onPointerEnd);
      stage.removeEventListener("pointercancel", onPointerEnd);
    });

    return () => {
      for (const off of cleanups) off();
    };
  }, [flavors]);

  return null;
}
