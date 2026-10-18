"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { FlavorPalette } from "@/lib/catalog/home";
import { useHomeStore } from "@/lib/home/store";
import { heroGeometry } from "./hero-geometry";
import {
  HERO_DRAG_END_EVENT,
  HERO_DRAG_EVENT,
  HERO_SPIN_END_EVENT,
  HERO_SPIN_EVENT,
  type HeroDragDetail,
  type HeroSpinDetail,
} from "./hero-drag";

/**
 * Interaktivität des Heros (Arbeitspaket A). Rendert nichts, hängt sich an die
 * Server-Markup-Knoten von Hero.tsx über data-Attribute.
 *
 * Aufgaben:
 * - Maße von Dose, Nachbardosen, Pfeilen und Sequenz als CSS-Variablen auf die
 *   Sektion schreiben, damit die PNGs exakt dort stehen, wo CanScene rendert.
 * - ScrollTrigger mit scrub 0,8 über #pv-hero: schreibt --seq und store.seqProgress.
 * - Sortenwechsel per Pfeilen, Punkten, Tastatur, Wischen und Ziehen mit der Maus.
 * - Farbwelt (--flavor-*) auf dem <html>-Element weich überblenden. Verlauf,
 *   Blobs, Riesentypo und Nährwertkacheln hängen an diesen Variablen.
 * - Nur die aktive Sorte sichtbar und fokussierbar halten.
 *
 * Zustände stehen grundsätzlich als data-Attribute an DOM-Knoten, nie als Klassen
 * auf <html> oder <body>: React setzt className beim erneuten Rendern neu, etwa
 * wenn eine Browser-Erweiterung vor der Hydration ins DOM schreibt.
 */

export interface HeroFlavorView {
  slug: string;
  shortName: string;
  palette: FlavorPalette;
}

/** Ab dieser gezogenen Strecke in Pixeln wechselt die Sorte. */
const SWIPE_THRESHOLD = 40;
/** Ab dieser Strecke entscheidet sich, ob quer gezogen oder gescrollt wird. */
const AXIS_LOCK = 8;
/** Ab diesem Fortschritt sind die Hero-Texte weg und nicht mehr fokussierbar. */
const HERO_TEXT_GONE = 0.34;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Klicks auf Bedienelemente dürfen kein Ziehen starten. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("a, button, input, textarea, select, label, [role='button']"));
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
      const half = width / 2;
      const geometry = heroGeometry(width, height);
      const style = section.style;

      style.setProperty("--pv-vh", `${height}px`);
      style.setProperty("--pv-can-h", `${geometry.canHeightFraction * height}px`);
      style.setProperty("--pv-can-top", `${(0.5 - geometry.canCenterYFraction) * height}px`);
      style.setProperty("--pv-seq-x", `${geometry.seqShiftXFraction * width}px`);
      style.setProperty("--pv-seq-y", `${geometry.seqShiftYFraction * height}px`);
      style.setProperty("--pv-seq-scale", String(geometry.seqScale - 1));

      // Nachbardosen als PNG (Ladezustand und Ersatz ohne WebGL).
      style.setProperty("--pv-neighbor-x", `${geometry.neighborCenterFraction * half}px`);
      style.setProperty("--pv-neighbor-scale", geometry.neighborScreenScale.toFixed(4));

      // Zutatenpanel: Aufbau und Oberkante kommen aus derselben Rechnung wie die
      // Dose, damit beide auf jeder Höhe zusammenpassen (globals.css, Block A).
      section.dataset.layout = geometry.factsLayout;
      style.setProperty("--pv-facts-top", `${geometry.factsTopFraction * height}px`);

      // Pfeile stehen immer neben der aktiven Dose, im Hero weit außen (Richtung A:
      // 76 px ab 1024 px Breite, sonst 56 px, Abstand zum Rand 4 Prozent bzw. 12 px).
      // Im Seitenlayout rücken sie im gezoomten Zustand an die Dose, damit sie
      // nicht über dem Zutatenpanel liegen; gestapelt bleiben sie am Rand.
      const arrowHalf = width >= 1024 ? 38 : 28;
      const edge = geometry.isSide ? width * 0.04 : 12;
      const heroRadius = Math.max(120, half - edge - arrowHalf);
      const zoomRadius = geometry.activeHalfFractionZoom * half + arrowHalf + 28;
      style.setProperty("--pv-arrow-r0", `${heroRadius}px`);
      style.setProperty(
        "--pv-arrow-r1",
        `${geometry.isSide ? Math.min(heroRadius, zoomRadius) : heroRadius}px`,
      );

      lastWidth = width;
      lastHeight = height;
    };

    applyGeometry();

    // Auf Mobil ändert die ein- und ausfahrende Adressleiste nur die Höhe. Die
    // Maße folgen ihr sofort, wie die 3D-Szene, die bei jeder Größenänderung der
    // Canvas neu rechnet: Sonst passt das Zutatenpanel mit eingeblendeter Leiste
    // nicht mehr zwischen Dose und Dock. Die Scrollstrecke hängt nicht an diesen
    // Maßen, ScrollTrigger rechnet deshalb erst ab 120 px neu, sonst springt die
    // Seite beim Scrollen.
    let refreshHeight = window.innerHeight;
    const onResize = () => {
      const widthChanged = window.innerWidth !== lastWidth;
      if (!widthChanged && window.innerHeight === lastHeight) return;
      applyGeometry();
      if (widthChanged || Math.abs(window.innerHeight - refreshHeight) > 120) {
        refreshHeight = window.innerHeight;
        ScrollTrigger.refresh();
      }
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
      // Ab 0,4 beginnt das Panel einzublenden, ab dann ist es bedienbar.
      stage.dataset.facts = value >= 0.4 ? "true" : "false";
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
    const factNodes = Array.from(section.querySelectorAll<HTMLElement>(".pv-facts__item"));
    const dots = Array.from(section.querySelectorAll<HTMLButtonElement>("[data-pv-dot]"));
    const count = flavors.length;

    const applyFlavor = (index: number, duration: number) => {
      // Blob-Formen im Hintergrund wechseln je Sorte ihre Lage (CSS-Übergang).
      section.dataset.flavorIndex = String(index);
      for (const node of flavorNodes) {
        const own = Number(node.dataset.pvFlavor);
        node.dataset.active = own === index ? "true" : "false";
        // Die PNGs bilden dasselbe Karussell ab wie die 3D-Szene: eine Dose vorn,
        // je eine links und rechts daneben.
        if (node.classList.contains("pv-can")) {
          const offset = (own - index + count) % count;
          node.dataset.pos =
            offset === 0
              ? "active"
              : offset === 1
                ? "next"
                : offset === count - 1
                  ? "prev"
                  : "back";
        }
      }
      // Die unsichtbaren Zutatenblöcke dürfen auch nicht fokussierbar sein.
      for (const node of factNodes) {
        const active = node.dataset.active === "true";
        if (active) node.removeAttribute("inert");
        else node.setAttribute("inert", "");
      }
      for (const dot of dots) {
        const own = Number(dot.dataset.pvDot);
        if (own === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      }
      const palette = flavors[index]?.palette;
      if (palette) {
        // Die Farbwelt hängt am Wurzelelement, deshalb wechselt der Hintergrund der
        // ganzen Sektion mit, egal wie weit die Sequenz schon gelaufen ist.
        gsap.to(document.documentElement, {
          duration,
          ease: "power2.out",
          overwrite: "auto",
          "--flavor-from": palette.from,
          "--flavor-via": palette.via,
          "--flavor-to": palette.to,
          "--flavor-accent": palette.accent,
          "--flavor-ink": palette.ink,
        });
      }
    };

    applyFlavor(store.getState().flavorIndex, 0);

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.flavorIndex !== previous.flavorIndex) {
        applyFlavor(state.flavorIndex, reduced ? 0 : 0.6);
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

    // ------------------------------------------------- Wischen und Ziehen
    // Touch und Maus laufen über dieselben Zeigerereignisse. Senkrecht bleibt das
    // Scrollen der Seite unberührt (touch-action: pan-y auf der Bühne), waagerecht
    // dreht der Ring mit und rastet beim Loslassen ein.
    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;
    let dragged = false;
    /**
     * "ring": Wischen wechselt die Sorte (Hero-Ansicht). "spin": Im Zutaten-Schritt dreht das
     * Ziehen die vordere Dose selbst; mit der Maus in jede Richtung, mit dem Finger nur, wenn
     * die Geste waagerecht beginnt, senkrecht scrollt die Seite weiter.
     */
    let mode: "ring" | "spin" = "ring";
    let freeAxis = false;

    const sendDrag = (name: string, detail: HeroDragDetail) => {
      window.dispatchEvent(new CustomEvent<HeroDragDetail>(name, { detail }));
    };
    const sendSpin = (name: string, detail: HeroSpinDetail) => {
      window.dispatchEvent(new CustomEvent<HeroSpinDetail>(name, { detail }));
    };

    const endDrag = () => {
      pointerId = null;
      axis = null;
      delete stage.dataset.dragging;
    };

    const onPointerDown = (event: PointerEvent) => {
      // Immer zuerst zurücksetzen, sonst verschluckt der Klickfilter unten den
      // nächsten echten Klick auf einen Pfeil.
      dragged = false;
      if (pointerId !== null) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isInteractive(event.target)) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      axis = null;
      mode = stage.dataset.facts === "true" ? "spin" : "ring";
      freeAxis = mode === "spin" && event.pointerType === "mouse";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (axis === null) {
        if (Math.abs(deltaX) < AXIS_LOCK && Math.abs(deltaY) < AXIS_LOCK) return;
        axis = freeAxis || Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
        if (axis === "x") {
          dragged = true;
          stage.dataset.dragging = "true";
          try {
            stage.setPointerCapture(event.pointerId);
          } catch {
            // Manche Browser verweigern das Einfangen, das Ziehen geht trotzdem.
          }
        }
      }
      if (axis !== "x") return;
      // Verhindert, dass die Maus beim Ziehen Text markiert.
      if (event.cancelable) event.preventDefault();
      if (mode === "spin") {
        sendSpin(HERO_SPIN_EVENT, {
          x: deltaX / window.innerWidth,
          y: deltaY / window.innerHeight,
        });
        return;
      }
      sendDrag(HERO_DRAG_EVENT, { progress: deltaX / window.innerWidth, settled: false });
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const deltaX = event.clientX - startX;
      const wasDragging = axis === "x";
      const wasSpin = mode === "spin";
      endDrag();
      if (!wasDragging) return;
      if (wasSpin) {
        sendSpin(HERO_SPIN_END_EVENT, { x: 0, y: 0 });
        return;
      }
      const switches = Math.abs(deltaX) >= SWIPE_THRESHOLD;
      sendDrag(HERO_DRAG_END_EVENT, { progress: 0, settled: switches });
      if (!switches) return;
      if (deltaX < 0) onNext();
      else onPrev();
    };

    // Nach dem Ziehen mit der Maus darf der abschließende Klick keinen Link auslösen.
    const onClickCapture = (event: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    };

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove, { passive: false });
    stage.addEventListener("pointerup", onPointerEnd);
    stage.addEventListener("pointercancel", onPointerEnd);
    stage.addEventListener("click", onClickCapture, true);
    cleanups.push(() => {
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerEnd);
      stage.removeEventListener("pointercancel", onPointerEnd);
      stage.removeEventListener("click", onClickCapture, true);
      delete stage.dataset.dragging;
    });

    return () => {
      for (const off of cleanups) off();
    };
  }, [flavors]);

  return null;
}
