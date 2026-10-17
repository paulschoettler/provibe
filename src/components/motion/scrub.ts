import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * An den Scroll gekoppelte Effekte der Unterseiten, wie auf der Startseite mit GSAP ScrollTrigger
 * und scrub. Wird von PageMotion erst bei Bedarf nachgeladen.
 *
 * - data-pv-parallax="24": CSS-Variable --pv-py läuft von +24 px auf -24 px, solange das
 *   Elternelement durch den Bildschirm wandert. globals.css setzt daraus `translate`, damit
 *   vorhandene Drehungen der Blobs und Sticker (transform) erhalten bleiben.
 * - data-pv-zoom: --pv-zoom läuft von 1,1 auf 1, bis das Bild die Bildschirmmitte erreicht.
 *
 * Mobil halbieren wir den Versatz, damit kleine Bildschirme ruhig bleiben.
 */
export function scrubOnScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const small = window.matchMedia("(max-width: 767px)").matches;

  const ctx = gsap.context(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-pv-parallax]")) {
      const amount = Number(el.dataset.pvParallax) || 24;
      const px = small ? amount / 2 : amount;
      gsap.fromTo(
        el,
        { "--pv-py": `${px}px` },
        {
          "--pv-py": `${-px}px`,
          ease: "none",
          scrollTrigger: {
            trigger: el.parentElement ?? el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        },
      );
    }
    for (const el of document.querySelectorAll<HTMLElement>("[data-pv-zoom]")) {
      // Was beim Start schon im Bild ist, bleibt ruhig, sonst springt es beim Nachladen.
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      gsap.fromTo(
        el,
        { "--pv-zoom": 1.1 },
        {
          "--pv-zoom": 1,
          ease: "none",
          scrollTrigger: {
            trigger: el.parentElement ?? el,
            start: "top bottom",
            end: "center 55%",
            scrub: 0.6,
          },
        },
      );
    }
  });

  // Bilder und Schriften verändern die Höhen nach dem ersten Layout.
  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState !== "complete") window.addEventListener("load", refresh, { once: true });
  const timer = window.setTimeout(refresh, 0);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("load", refresh);
    ctx.revert();
  };
}
