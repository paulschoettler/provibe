/**
 * Kleine Inline-Icons des Heros (Richtung A). Farbe kommt immer aus currentColor,
 * damit die Varianten (Creme auf Wine, Aubergine auf Creme) reines CSS bleiben.
 */

export function Chevron({
  direction,
  size = 24,
}: {
  direction: "left" | "right" | "down";
  size?: number;
}) {
  const path =
    direction === "left"
      ? "M15 5 8 12l7 7"
      : direction === "right"
        ? "M9 5l7 7-7 7"
        : "M5 9l7 7 7-7";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Dosen-Silhouette als Fortschrittspunkt. Gefüllt, sobald der Knopf aktiv ist (CSS). */
export function CanSilhouette() {
  return (
    <svg
      className="pv-dot__mark"
      viewBox="0 0 14 26"
      width="14"
      height="26"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="pv-dot__body"
        d="M3 2h8l1.5 3v16L11 24H3l-1.5-3V5L3 2Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path className="pv-dot__line" d="M4 8h6" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2.25 3H3.9l1.58 7.65a1.2 1.2 0 0 0 1.2.98h6.3a1.2 1.2 0 0 0 1.2-.9L15.75 6H4.58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.13" cy="14.63" r="1.05" fill="currentColor" />
      <circle cx="12.75" cy="14.63" r="1.05" fill="currentColor" />
    </svg>
  );
}
