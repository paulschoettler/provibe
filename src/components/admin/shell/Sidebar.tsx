"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { logoutAction } from "@/lib/admin/staff/actions";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { isActive, sectionsOf, type NavGroupId, type NavLink } from "./nav-shared";

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
}

type OpenState = Partial<Record<NavGroupId, boolean>>;

/**
 * Inhalt der Seitenleiste (Figma 26:3601): Logo, Navigation in Bereichen (Verkauf, Katalog, Kunden,
 * Marketing, System) mit aktivem Punkt in Cream auf Wildberry, unten Benutzer mit Rolle und
 * Abmelden. Wird am Desktop fest und mobil im Drawer genutzt.
 *
 * Die Bereiche sind native <details>: Sie lassen sich ohne JavaScript öffnen, der Bereich der
 * aktuellen Seite ist beim Laden offen, alles andere zu. Was die Person selbst auf- oder
 * zuklappt, bleibt erhalten, solange die Seitenleiste steht (Seitenwechsel innerhalb des
 * Backoffice); der Bereich der neuen Seite öffnet sich dabei immer. Zugeklappte Bereiche zeigen
 * die Summe ihrer offenen Zähler.
 */
export function SidebarContent({
  items,
  user,
  onNavigate,
}: {
  items: NavLink[];
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/admin";
  const sections = useMemo(() => sectionsOf(items), [items]);
  const activeGroup = useMemo(
    () => items.find((item) => item.group && isActive(pathname, item))?.group ?? null,
    [items, pathname],
  );

  // Eigene Wahl der Person je Bereich; ohne Wahl ist genau der aktive Bereich offen
  const [choices, setChoices] = useState<OpenState>({});
  // Beim Seitenwechsel den Bereich der neuen Seite öffnen (Zustand aus Props ableiten, ohne Effekt)
  const [seenActive, setSeenActive] = useState(activeGroup);
  if (seenActive !== activeGroup) {
    setSeenActive(activeGroup);
    if (activeGroup) setChoices((current) => ({ ...current, [activeGroup]: true }));
  }
  const isGroupOpen = (id: NavGroupId) => choices[id] ?? id === activeGroup;

  const toggle = (id: NavGroupId, next: boolean) => {
    setChoices((current) => (current[id] === next ? current : { ...current, [id]: next }));
  };

  return (
    <div className="bg-admin-seitenleiste text-admin-seitenleiste-text flex h-full flex-col justify-between gap-3 overflow-y-auto p-3">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="block px-3 py-2"
          aria-label="provibe Backoffice, Dashboard"
        >
          <Image
            src="/brand/logo/provibe-logo-cream.svg"
            alt="provibe"
            width={202}
            height={79}
            className="h-[38px] w-auto"
            priority
          />
        </Link>
        <nav aria-label="Backoffice">
          <ul className="flex flex-col gap-0.5">
            {sections.map((section) => {
              if (section.kind === "item") {
                return (
                  <li key={section.item.href}>
                    <NavRow
                      item={section.item}
                      active={isActive(pathname, section.item)}
                      onNavigate={onNavigate}
                    />
                  </li>
                );
              }
              const isOpen = isGroupOpen(section.id);
              const containsActive = section.id === activeGroup;
              const count = section.items.reduce((sum, item) => sum + (item.count ?? 0), 0);
              return (
                <li key={section.id}>
                  <details
                    open={isOpen}
                    onToggle={(event) => toggle(section.id, event.currentTarget.open)}
                    className="group"
                  >
                    <summary
                      className={cx(
                        "rounded-admin-feld hover:bg-admin-seitenleiste-hover flex h-11 cursor-pointer list-none items-center gap-2.5 px-3 text-[14px] leading-[1.4] font-bold select-none lg:h-10 [&::-webkit-details-marker]:hidden",
                        containsActive && !isOpen && "text-admin-seitenleiste-aktiv-text",
                      )}
                    >
                      <Icon name={section.icon} size={18} />
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      {!isOpen && count > 0 ? <CountBadge count={count} active={false} /> : null}
                      <Icon
                        name="chevron-unten"
                        size={16}
                        className="shrink-0 transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>
                    <ul className="mt-0.5 mb-1 flex flex-col gap-0.5">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <NavRow
                            item={item}
                            active={isActive(pathname, item)}
                            onNavigate={onNavigate}
                            nested
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="flex flex-col gap-2">
        <div className="bg-admin-seitenleiste-hover h-px" />
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="bg-admin-seitenleiste-aktiv text-admin-seitenleiste-aktiv-text flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
            {user.initials}
          </span>
          <span className="min-w-0 flex-1 leading-[1.4]">
            <span className="block truncate text-[14px] font-medium" title={user.email}>
              {user.name}
            </span>
            <span className="block text-[12px]">{user.roleLabel}</span>
          </span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-admin-feld hover:bg-admin-seitenleiste-hover flex h-11 w-full items-center gap-2.5 px-3 text-[14px] font-medium lg:h-10"
          >
            <Icon name="abmelden" size={18} />
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
  nested = false,
}: {
  item: NavLink;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-admin-feld flex h-11 items-center gap-2.5 text-[14px] leading-[1.4] lg:h-10",
        nested ? "pr-3 pl-[42px]" : "px-3",
        active
          ? "bg-admin-seitenleiste-aktiv text-admin-seitenleiste-aktiv-text font-bold"
          : "hover:bg-admin-seitenleiste-hover font-medium",
      )}
    >
      {nested ? null : <Icon name={item.icon} size={18} />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count ? <CountBadge count={item.count} active={active} /> : null}
    </Link>
  );
}

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cx(
        "rounded-admin-badge flex h-5 min-w-5 items-center justify-center px-[7px] text-[12px] font-bold",
        active
          ? "bg-admin-seitenleiste text-admin-seitenleiste-text"
          : "bg-admin-seitenleiste-aktiv text-admin-seitenleiste-aktiv-text",
      )}
    >
      <span className="sr-only">offen: </span>
      {count > 99 ? "99+" : count}
    </span>
  );
}
