/**
 * Eigene SVG-Icons (keine fremden Logos, keine Icon-Library, kein CDN).
 * Alle Icons sind rein dekorativ: Bedeutung steht im aria-label des umgebenden Links oder Buttons.
 */

type IconProps = { className?: string };

const base = "pointer-events-none";

export function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16L21 21" />
    </svg>
  );
}

export function AccountIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.4-3.7 4.2-5.6 7.5-5.6s6.1 1.9 7.5 5.6" />
    </svg>
  );
}

export function CartIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 8h11l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H9a1.5 1.5 0 0 1-1.5-1.4z" />
      <path d="M9.2 8V6.6a2.8 2.8 0 0 1 5.6 0V8" />
    </svg>
  );
}

export function BurgerIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function InstagramIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TiktokIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={`${base} ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.1 3h2.3c.2 1.6 1.1 2.9 2.5 3.5.6.3 1.3.4 2 .5v2.4c-1.6 0-3.1-.5-4.4-1.4v5.9a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.5a3.2 3.2 0 1 0 2.3 3V3z" />
    </svg>
  );
}
