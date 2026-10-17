import type { IconName } from "@/components/admin/ui/Icon";

/** Client-taugliche Teile der Navigation (ohne Rechteprüfung, die steht in nav.ts). */
/** Serialisierbare Fassung für die Client-Komponenten der Seitenleiste */
export interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  count?: number;
}

/** Weitere Seitentitel für die Kopfzeile, die nicht in der Navigation stehen */
export const EXTRA_TITLES: Record<string, string> = {
  "/admin/suche": "Suche",
};

export function isActive(pathname: string, item: Pick<NavLink, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function titleFor(
  pathname: string,
  items: Pick<NavLink, "href" | "label" | "exact">[],
): string {
  const extra = Object.entries(EXTRA_TITLES).find(
    ([p]) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (extra) return extra[1];
  const match = items
    .filter((i) => isActive(pathname, i))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Backoffice";
}
