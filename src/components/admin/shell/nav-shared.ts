import type { IconName } from "@/components/admin/ui/Icon";

/** Client-taugliche Teile der Navigation (ohne Rechteprüfung, die steht in nav.ts). */
/** Serialisierbare Fassung für die Client-Komponenten der Seitenleiste */
export interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  count?: number;
  /** Bereich in der Seitenleiste (Schlüssel aus NAV_GROUPS); ohne Gruppe steht der Punkt einzeln */
  group?: NavGroupId;
}

/** Auf- und zuklappbare Bereiche der Seitenleiste, Reihenfolge wie in nav.ts */
export const NAV_GROUPS = {
  verkauf: { label: "Verkauf", icon: "bestellungen" },
  katalog: { label: "Katalog", icon: "produkte" },
  kunden: { label: "Kunden", icon: "kunden" },
  marketing: { label: "Marketing", icon: "newsletter" },
  system: { label: "System", icon: "einstellungen" },
} as const satisfies Record<string, { label: string; icon: IconName }>;

export type NavGroupId = keyof typeof NAV_GROUPS;

export type NavSection =
  | { kind: "item"; item: NavLink }
  | { kind: "group"; id: NavGroupId; label: string; icon: IconName; items: NavLink[] };

/** Flache Liste in Abschnitte falten: Einzelpunkte bleiben, Gruppen sammeln ihre Punkte in Reihenfolge. */
export function sectionsOf(items: NavLink[]): NavSection[] {
  const sections: NavSection[] = [];
  for (const item of items) {
    if (!item.group) {
      sections.push({ kind: "item", item });
      continue;
    }
    const last = sections.findLast((s) => s.kind === "group" && s.id === item.group);
    if (last && last.kind === "group") last.items.push(item);
    else {
      const def = NAV_GROUPS[item.group];
      sections.push({
        kind: "group",
        id: item.group,
        label: def.label,
        icon: def.icon,
        items: [item],
      });
    }
  }
  return sections;
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
