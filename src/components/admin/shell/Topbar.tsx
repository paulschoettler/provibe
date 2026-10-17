"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { buttonClasses, iconButtonClasses } from "@/components/admin/ui/Button";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { MobileNav } from "./MobileNav";
import { titleFor, type NavLink } from "./nav-shared";
import type { ShellUser } from "./Sidebar";

/**
 * Kopfzeile (Figma 26:3815, mobil 26:3839): Titel links, Suche mit ⌘K in der Mitte, rechts
 * Benachrichtigungen (offene Bestellungen) und Schnellaktion "Neu". Mobil: Burger, Titel, Suche, Glocke.
 * Der Titel ergibt sich aus dem Pfad und der Navigation; die Seite selbst trägt die h1 im PageHeader.
 */
export interface QuickAction {
  href: string;
  label: string;
}

export function Topbar({
  items,
  user,
  openOrders,
  aboAlerts = 0,
  quickActions,
}: {
  items: NavLink[];
  user: ShellUser;
  openOrders: number;
  /** überfällige Abos plus ungeklärte Kündigungen (countSubscriptionAlerts().total) */
  aboAlerts?: number;
  quickActions: QuickAction[];
}) {
  const pathname = usePathname() ?? "/admin";
  const title = titleFor(pathname, items);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const input = searchRef.current;
        if (input && input.offsetParent !== null) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bellCount = openOrders + aboAlerts;
  const bellLabel =
    bellCount === 0
      ? "Keine offenen Bestellungen oder Abo-Hinweise"
      : [
          openOrders > 0 ? `${openOrders} offene Bestellungen` : null,
          aboAlerts > 0 ? `${aboAlerts} Abo-Hinweise` : null,
        ]
          .filter(Boolean)
          .join(", ");
  // Ohne offene Bestellungen führt die Glocke zu den überfälligen Abos
  const bellHref =
    openOrders === 0 && aboAlerts > 0
      ? "/admin/abos?status=offen"
      : "/admin/bestellungen?status=offen";

  return (
    <header className="border-admin-rahmen bg-admin-karte sticky top-0 z-40 flex h-14 items-center gap-1 border-b px-1 lg:gap-4 lg:px-6">
      <MobileNav items={items} user={user} />
      <p className="min-w-0 flex-1 truncate text-[18px] leading-[1.4] font-semibold lg:flex-none lg:grow lg:basis-0 lg:text-[24px]">
        {title}
      </p>
      <form
        action="/admin/suche"
        method="get"
        role="search"
        className="hidden w-[400px] shrink lg:block"
      >
        <label className="rounded-admin-feld bg-admin-flaeche focus-within:outline-admin-akzent flex h-9 items-center gap-2 px-3 focus-within:outline-2">
          <span className="text-admin-text-2">
            <Icon name="suche" size={16} />
          </span>
          <span className="sr-only">Bestellungen, Produkte, Kunden suchen</span>
          <input
            ref={searchRef}
            type="search"
            name="q"
            placeholder="Bestellungen, Produkte, Kunden suchen"
            className="placeholder:text-admin-text-2 min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            autoComplete="off"
          />
          <kbd className="border-admin-rahmen bg-admin-karte text-admin-text-2 rounded-[4px] border px-1.5 py-px font-sans text-[12px] font-medium">
            ⌘K
          </kbd>
        </label>
      </form>
      <div className="flex items-center justify-end gap-1 lg:grow lg:basis-0 lg:gap-2">
        <Link
          href="/admin/suche"
          aria-label="Suchen"
          className={iconButtonClasses("ghost", "lg", "lg:hidden")}
        >
          <Icon name="suche" size={22} />
        </Link>
        <Link
          href={bellHref}
          aria-label={bellLabel}
          title={bellLabel}
          className={cx(iconButtonClasses("ghost", "lg"), "relative lg:size-9")}
        >
          <Icon name="glocke" size={20} />
          {bellCount > 0 ? (
            <span className="bg-admin-akzent text-admin-auf-akzent absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold lg:top-0.5 lg:right-0.5">
              {bellCount > 99 ? "99+" : bellCount}
            </span>
          ) : null}
        </Link>
        {quickActions.length ? (
          <details className="relative hidden lg:block">
            <summary
              className={cx(
                buttonClasses("secondary"),
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
            >
              <Icon name="plus" size={16} />
              Neu
            </summary>
            <ul className="rounded-admin-karte border-admin-rahmen bg-admin-karte shadow-admin-karte absolute right-0 z-50 mt-1 w-56 overflow-hidden border py-1">
              {quickActions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="hover:bg-admin-flaeche block px-4 py-2 text-[14px]"
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </header>
  );
}
