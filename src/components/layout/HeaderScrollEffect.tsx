"use client";

import { useEffect } from "react";

/**
 * Setzt data-scrolled auf <html>, sobald die Seite mehr als 8 px gescrollt ist.
 * Der Header bekommt darüber seinen leichten Schatten (CSS in globals.css).
 * Rein dekorativ, ohne Einfluss auf den Inhalt.
 */
export function HeaderScrollEffect() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (window.scrollY > 8) root.dataset.scrolled = "true";
      else delete root.dataset.scrolled;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      delete root.dataset.scrolled;
    };
  }, []);

  return null;
}

export default HeaderScrollEffect;
