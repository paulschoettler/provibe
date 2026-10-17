/**
 * Icons der Katalog-Bausteine (Figma "02 Katalog", Bausteine 21:263), als Inline-SVG ohne
 * Bibliothek und ohne CDN. Rein dekorativ: die Bedeutung trägt immer der umgebende Text oder
 * das aria-label des Buttons.
 */

type IconProps = { className?: string };

const svgProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function CartLineIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M2.5 3.33H4.58L6.42 12.5H15.25L16.92 5.83H5.5" />
      <circle cx="7.92" cy="16.25" r="1.25" />
      <circle cx="14.17" cy="16.25" r="1.25" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 14 14" strokeWidth={2.6} className={className} {...svgProps}>
      <path d="M2.92 7.29L5.54 9.92L11.08 4.38" />
    </svg>
  );
}

export function MinusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M4.17 10H15.83" />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M10 4.17V15.83M4.17 10H15.83" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" strokeWidth={2} className={className} {...svgProps}>
      <path d="M3.33 8H12.67M8.67 12L12.67 8L8.67 4" />
    </svg>
  );
}

export function ChevronIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M5 7.5L10 12.5L15 7.5" />
    </svg>
  );
}

export function TruckIcon({ className = "h-[26px] w-[26px]" }: IconProps) {
  return (
    <svg viewBox="0 0 26 26" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M15.17 9.75V6.5H3.25V17.33H15.17M15.17 9.75V17.33M15.17 9.75H19.5L22.75 13V17.33H15.17" />
      <circle cx="7.58" cy="19.5" r="1.95" />
      <circle cx="18.96" cy="19.5" r="1.95" />
    </svg>
  );
}

export function ClockIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.2V10L12.6 11.6" />
    </svg>
  );
}

export function ShirtIcon({ className = "h-10 w-10" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" strokeWidth={1.6} className={className} {...svgProps}>
      <path d="M13.33 6.67L6.67 10.83L9.67 16.67L13.33 15V33.33H26.67V15L30.33 16.67L33.33 10.83L26.67 6.67C25.67 9.17 23 10.83 20 10.83C17 10.83 14.33 9.17 13.33 6.67Z" />
    </svg>
  );
}

export function CupIcon({ className = "h-10 w-10" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" strokeWidth={1.5} className={className} {...svgProps}>
      <path d="M8.33 11.67H31.67M10 11.67L12.5 33.33H27.5L30 11.67M16.67 11.67L20 5" />
    </svg>
  );
}

export function DocumentIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.6} className={className} {...svgProps}>
      <path d="M11.5 2.5H5.5A1.5 1.5 0 0 0 4 4V16A1.5 1.5 0 0 0 5.5 17.5H14.5A1.5 1.5 0 0 0 16 16V7L11.5 2.5Z" />
      <path d="M11.5 2.5V7H16M7 10.5H13M7 13.5H13" />
    </svg>
  );
}

export function SearchLineIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={1.8} className={className} {...svgProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16L21 21" />
    </svg>
  );
}

export function CloseLineIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} className={className} {...svgProps}>
      <path d="M5 5L15 15M15 5L5 15" />
    </svg>
  );
}

/** Organische Fläche hinter Dosen (Figma "Blob"), Farbe über currentColor. */
export function Blob({
  className = "",
  opacity = 0.45,
  parallax,
}: IconProps & {
  opacity?: number;
  /** Versatz in px für den Scroll-Parallax (src/components/motion), ohne Angabe kein Effekt */
  parallax?: number;
}) {
  return (
    <svg
      viewBox="0 0 229.6 224"
      className={className}
      data-pv-parallax={parallax}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <path
        opacity={opacity}
        fill="currentColor"
        d="M229.366 109.302C232.034 135.021 211.45 177.672 189.087 196.541C166.787 215.411 123.713 228.658 95.3141 222.455C66.9789 216.186 33.8153 187.43 18.8854 159.19C3.89186 130.95 -7.2262 79.4464 5.67075 52.9514C18.5677 26.3918 68.2495 1.90011 96.2035 0.0906945C124.158 -1.71872 151.159 23.9362 173.331 42.1595C195.567 60.3829 226.761 83.5822 229.366 109.302Z"
      />
    </svg>
  );
}
