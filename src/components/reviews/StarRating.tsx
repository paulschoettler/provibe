import { starsLabel } from "@/lib/reviews/logic";
import { StarIcon } from "./icons";

/**
 * Sterneanzeige (nur lesend). Bei Durchschnittswerten wird die gefüllte Reihe anteilig über die
 * leere gelegt (4,7 von 5 = 94 % Breite). Screenreader lesen den Text aus aria-label.
 */
export function StarRating({
  value,
  size = 18,
  label,
  className = "",
}: {
  value: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const pct = `${(clamped / 5) * 100}%`;
  const rounded = Math.round(clamped * 10) / 10;
  const text =
    label ??
    (Number.isInteger(rounded)
      ? starsLabel(rounded)
      : `${rounded.toLocaleString("de-DE")} von 5 Sternen`);
  const row = (filled: boolean) =>
    [0, 1, 2, 3, 4].map((i) => (
      <StarIcon key={i} filled={filled} size={size} className="shrink-0" />
    ));
  return (
    <span
      role="img"
      aria-label={text}
      className={`relative inline-flex w-max shrink-0 ${className}`}
      style={{ height: size }}
    >
      <span className="text-pv-wildberry flex gap-[2px]">{row(false)}</span>
      <span
        className="text-pv-wildberry absolute inset-y-0 left-0 flex gap-[2px] overflow-hidden"
        style={{ width: pct }}
      >
        {row(true)}
      </span>
    </span>
  );
}
