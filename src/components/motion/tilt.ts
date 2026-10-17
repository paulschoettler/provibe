/**
 * Leichte Neigung von Karten zur Maus (data-pv-tilt), nur auf Desktop mit feinem Zeiger.
 * Schreibt zwei CSS-Variablen je Karte, die Transformation steht in globals.css
 * ("Motion Unterseiten"). Höchstens MAX_DEG Grad, kein Layout-Shift, ein Frame je Bewegung.
 */

const MAX_DEG = 4;

export function enableTilt(): () => void {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
  if (!fine.matches) return () => undefined;

  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-pv-tilt]"));
  const offs: Array<() => void> = [];

  for (const card of cards) {
    let frame = 0;
    let x = 0.5;
    let y = 0.5;
    const apply = () => {
      frame = 0;
      card.style.setProperty("--pv-ry", `${((x - 0.5) * 2 * MAX_DEG).toFixed(2)}deg`);
      card.style.setProperty("--pv-rx", `${((0.5 - y) * 2 * MAX_DEG).toFixed(2)}deg`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const box = card.getBoundingClientRect();
      x = (e.clientX - box.left) / box.width;
      y = (e.clientY - box.top) / box.height;
      card.setAttribute("data-pv-tilting", "");
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      card.removeAttribute("data-pv-tilting");
      card.style.removeProperty("--pv-rx");
      card.style.removeProperty("--pv-ry");
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    offs.push(() => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      leave();
    });
  }

  return () => {
    for (const off of offs) off();
  };
}
