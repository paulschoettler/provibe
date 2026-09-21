import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps } from "react";

type LinkProps = Omit<ComponentProps<typeof Link>, "href">;

/**
 * next/link mit Zielen, die als Text aus der Datenbank kommen oder deren Seite erst in
 * einer späteren Phase entsteht (Kollektionen, Produkte, Rechtstexte, Konto, Suche).
 * Next 16 prüft Routen sonst zur Bauzeit gegen die vorhandenen Seiten.
 * Sobald alle Seiten existieren, kann diese Hülle entfallen.
 */
export function SiteLink({ href, ...rest }: LinkProps & { href: string }) {
  return <Link href={href as Route} {...rest} />;
}

export default SiteLink;
