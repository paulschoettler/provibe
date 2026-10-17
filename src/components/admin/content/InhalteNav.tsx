"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/admin/ui/cx";
import { Icon, type IconName } from "@/components/admin/ui/Icon";

/**
 * Unternavigation der Inhalte (Figma 41:13808): am Desktop als Karte links, mobil als
 * waagerechte Tabs. Gleiche Optik wie die Einstellungen (SettingsNav).
 */
export const CONTENT_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/inhalte/seiten", label: "Seiten", icon: "inhalte" },
  { href: "/admin/inhalte/rechtstexte", label: "Rechtstexte", icon: "schild" },
  { href: "/admin/inhalte/startseite", label: "Startseite", icon: "dashboard" },
  { href: "/admin/inhalte/navigation", label: "Navigation", icon: "menue" },
  { href: "/admin/inhalte/blog", label: "Blog", icon: "notiz" },
  { href: "/admin/inhalte/weiterleitungen", label: "Weiterleitungen", icon: "extern" },
];

export function InhalteNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Inhalte" className="min-w-0">
      <ul className="border-admin-rahmen lg:rounded-admin-karte lg:bg-admin-karte -mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:border lg:p-2">
        {CONTENT_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "lg:rounded-admin-feld flex h-11 items-center gap-2.5 text-[15px] whitespace-nowrap lg:h-10 lg:px-3 lg:text-[14px]",
                  "-mb-px border-b-2 px-3 lg:mb-0 lg:border-b-0",
                  active
                    ? "border-admin-akzent text-admin-text lg:bg-admin-akzent-hell lg:text-admin-akzent font-semibold"
                    : "text-admin-text-2 hover:text-admin-text lg:text-admin-text lg:hover:bg-admin-flaeche border-transparent lg:font-medium",
                )}
              >
                <span className="max-lg:hidden">
                  <Icon name={item.icon} size={18} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
