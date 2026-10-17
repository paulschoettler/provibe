/**
 * Einblenden beim Scrollen für die Unterseiten (siehe PageMotion). Reines DOM, kein React.
 *
 * Anders als .reveal der Startseite (versteckt ab html[data-js], also schon vor der Hydration)
 * versteckt dieser Helfer nur Elemente, die beim Start außerhalb des Bildschirms liegen, und erst
 * im selben Zug, in dem html[data-motion] gesetzt wird. Was beim Laden schon sichtbar ist, bleibt
 * stehen und flackert nicht. Scheitert das JavaScript, bleibt alles sichtbar.
 */

export const MOTION_ATTR = "data-motion";
const IN_ATTR = "data-pv-in";
/** Abstand zwischen gestaffelten Elementen und Obergrenze der Staffel */
const STEP_MS = 80;
const MAX_STEPS = 6;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Markiert Ziele, versteckt nur die unsichtbaren und beobachtet sie. Gibt die Aufräumfunktion zurück. */
export function revealOnScroll(): () => void {
  for (const group of document.querySelectorAll<HTMLElement>("[data-pv-stagger]")) {
    for (const child of Array.from(group.children)) {
      if (!child.hasAttribute("data-pv-reveal")) child.setAttribute("data-pv-reveal", "");
    }
  }

  const targets = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-pv-reveal]:not([${IN_ATTR}])`),
  );
  if (targets.length === 0 || typeof IntersectionObserver === "undefined") {
    for (const el of targets) el.setAttribute(IN_ATTR, "");
    return () => undefined;
  }

  // Beim Start sichtbare Elemente sofort als eingeblendet markieren (ohne Übergang).
  const viewport = window.innerHeight;
  const pending: HTMLElement[] = [];
  for (const el of targets) {
    const box = el.getBoundingClientRect();
    if (box.top < viewport && box.bottom > 0) el.setAttribute(IN_ATTR, "");
    else pending.push(el);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const shown = entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      shown.forEach((el, i) => {
        el.style.setProperty("--pv-delay", `${Math.min(i, MAX_STEPS) * STEP_MS}ms`);
        el.setAttribute(IN_ATTR, "");
        observer.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  for (const el of pending) observer.observe(el);

  // Beim Abbau nur abmelden: PageMotion entfernt html[data-motion], damit ist alles sichtbar.
  // (React Strict Mode baut den Effekt in der Entwicklung einmal ab und wieder auf.)
  return () => observer.disconnect();
}
