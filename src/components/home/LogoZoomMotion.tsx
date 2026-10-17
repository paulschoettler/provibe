"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { useHomeStore } from "@/lib/home/store";
import { canTransform, finaleFrame, type FinaleCanKey } from "./finale/choreography";

/**
 * Bewegung der Finale-Sektion (#pvlogo), Choreografie aus dem Figma-Frame
 * "Finale / Choreografie" (Werte in finale/choreography.ts).
 *
 * - Ein ScrollTrigger über die Pin-Strecke (.finale-pin-space, mobil 90vh, Desktop
 *   100vh). Er arbeitet wie scrub: true: Jede Scrollbewegung rechnet den Zustand aus
 *   dem Fortschritt neu und schreibt ihn als Inline-Style. Das Kleben selbst macht
 *   CSS (position: sticky unter dem Header), deshalb gibt es keinen Layout-Sprung.
 * - Die Dosen bekommen zusätzlich data-r (Winkel) und data-o (Deckkraft). Daraus und
 *   aus ihrer Lage im DOM setzt CanScene die 3D-Dosen, falls die Szene läuft.
 * - footerProgress im Store ist größer als 0, solange die Sektion im Bild ist. Daran
 *   hängt, ob die Canvas weiterzeichnet.
 * - Bei prefers-reduced-motion keine Flugbahnen: Endzustand aus dem CSS, nur ein
 *   weiches Einblenden, sobald die Sektion ins Bild kommt.
 */

const CAN_KEYS: FinaleCanKey[] = ["wildberry", "peach", "raspberry-lime"];

export function LogoZoomMotion({ sectionId = "pvlogo" }: { sectionId?: string }) {
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const pin = section?.querySelector<HTMLElement>(".finale-pin");
    const space = section?.querySelector<HTMLElement>(".finale-pin-space");
    if (!section || !pin || !space) return;

    // Die Bühne klebt direkt unter der Leiste des Headers (die Announcement-Bar
    // scrollt weg). Die Höhe hängt am Breakpoint, deshalb messen statt raten.
    const headerBar = document.querySelector<HTMLElement>(".pv-headerbar");
    const measureHeader = () => {
      const height = Math.round(headerBar?.getBoundingClientRect().height ?? 0);
      section.style.setProperty("--finale-top", `${height}px`);
      return height;
    };
    measureHeader();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Nur einblenden, wenn die Sektion noch unterhalb des Bildes liegt. Ist sie
      // schon zu sehen (Sprung per Anker, Reload), bleibt alles sofort stehen.
      if (section.getBoundingClientRect().top < window.innerHeight) return;
      section.dataset.fade = "wait";
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          section.dataset.fade = "in";
          observer.disconnect();
        },
        { threshold: 0.15 },
      );
      observer.observe(section);
      return () => {
        observer.disconnect();
        delete section.dataset.fade;
      };
    }

    const logo = section.querySelector<HTMLElement>('[data-finale="logo"]');
    const blob = section.querySelector<HTMLElement>('[data-finale="blob"]');
    const copy = section.querySelector<HTMLElement>('[data-finale="copy"]');
    const sticker = section.querySelector<HTMLElement>('[data-finale="sticker"]');
    const fruits = Array.from(section.querySelectorAll<HTMLElement>('[data-finale="fruit"]'));
    const cans = CAN_KEYS.map((key) => ({
      key,
      el: section.querySelector<HTMLElement>(`[data-finale-can="${key}"]`),
    }));

    const apply = (progress: number) => {
      const frame = finaleFrame(progress);
      if (logo) logo.style.transform = `scale(${frame.logo.scale})`;
      if (blob) {
        blob.style.transform = `rotate(${frame.blob.rotate}deg) scale(${frame.blob.scale})`;
        blob.style.opacity = String(frame.blob.opacity);
      }
      for (const { key, el } of cans) {
        if (!el) continue;
        const pose = frame.cans[key];
        el.style.transform = canTransform(pose);
        el.style.opacity = String(pose.opacity);
        el.dataset.r = pose.rotate.toFixed(3);
        el.dataset.o = pose.opacity.toFixed(3);
      }
      if (copy) {
        copy.style.opacity = String(frame.copy.opacity);
        copy.style.transform = `translate3d(0, ${frame.copy.y}px, 0)`;
      }
      if (sticker) {
        sticker.style.transform = `rotate(${frame.sticker.rotate}deg) scale(${frame.sticker.scale})`;
      }
      for (const fruit of fruits) fruit.style.opacity = String(frame.fruit.opacity);
    };

    gsap.registerPlugin(ScrollTrigger);
    const setFooterProgress = useHomeStore.getState().setFooterProgress;
    let progress = 0;
    let inView = false;
    const report = () => setFooterProgress(inView ? Math.max(progress, 0.001) : 0);

    section.dataset.motion = "on";

    const choreography = ScrollTrigger.create({
      trigger: pin,
      start: () => `top top+=${measureHeader()}`,
      end: () => `+=${space.offsetHeight}`,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progress = self.progress;
        apply(progress);
        report();
      },
      onRefresh: (self) => {
        progress = self.progress;
        apply(progress);
      },
    });

    const visibility = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        inView = self.isActive;
        report();
      },
    });

    progress = choreography.progress;
    inView = visibility.isActive;
    apply(progress);
    report();

    return () => {
      choreography.kill();
      visibility.kill();
      setFooterProgress(0);
      delete section.dataset.motion;
      const reset = [logo, blob, copy, sticker, ...fruits, ...cans.map((c) => c.el)];
      for (const el of reset) {
        if (!el) continue;
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      }
      for (const { key, el } of cans) {
        if (!el) continue;
        el.dataset.o = "1";
        el.dataset.r = String(finaleFrame(1).cans[key].rotate);
      }
    };
  }, [sectionId]);

  return null;
}

export default LogoZoomMotion;
