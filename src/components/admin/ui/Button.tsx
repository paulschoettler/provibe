import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/**
 * Buttons nach Figma (24:3047): Primär als Magenta-Pill (eine primäre Aktion je Ansicht),
 * Sekundär mit Rahmen, Gefährlich in Rot, Text in Magenta. Höhe 36 px am Desktop, 44 px mobil.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "text";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-1.5 text-[14px] leading-[1.4] font-semibold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-admin-badge bg-admin-akzent px-4 text-admin-auf-akzent hover:bg-admin-akzent-hover",
  secondary:
    "rounded-admin-feld border border-admin-rahmen-stark bg-admin-karte px-4 text-admin-text hover:bg-admin-flaeche",
  danger: "rounded-admin-feld bg-admin-rot px-4 text-admin-auf-akzent hover:bg-admin-rot-hover",
  text: "rounded-admin-feld px-2 text-admin-akzent hover:bg-admin-akzent-hell",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-11 md:h-9",
  sm: "h-9 md:h-8 text-[13px]",
};

export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon links vom Text (16 px) */
  icon?: IconName;
  /** Volle Breite (zum Beispiel im Login oder in mobilen Leisten) */
  block?: boolean;
  children?: ReactNode;
}

export type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "children">;

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, cx(block && "w-full", className))}
      {...rest}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "children" | "className"> & { className?: string };

/** Link im Button-Look (Navigation statt Aktion, zum Beispiel "Benutzer einladen" als eigene Seite). */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, cx(block && "w-full", className))} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </Link>
  );
}

export type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  icon: IconName;
  /** Pflicht: Beschriftung für Screenreader und Tooltip */
  label: string;
  /** "ghost" ohne Rahmen (Tabellenzeile, Kopfzeile), "outline" mit Rahmen */
  look?: "ghost" | "outline";
  size?: "md" | "lg";
};

/** Quadratischer Icon-Button: 32 px in Tabellen, 44 px Touch-Fläche mobil. */
export function IconButton({
  icon,
  label,
  look = "ghost",
  size = "md",
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClasses(look, size, className)}
      {...rest}
    >
      <Icon name={icon} size={size === "lg" ? 22 : 18} />
    </button>
  );
}

export function iconButtonClasses(
  look: "ghost" | "outline" = "ghost",
  size: "md" | "lg" = "md",
  extra?: string,
): string {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-admin-feld text-admin-text transition-colors hover:bg-admin-flaeche disabled:opacity-55",
    size === "lg" ? "size-11" : "size-11 md:size-8",
    look === "outline" && "border border-admin-rahmen-stark bg-admin-karte md:size-9",
    extra,
  );
}
