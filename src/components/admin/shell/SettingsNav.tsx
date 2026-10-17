"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/admin/ui/cx";
import { Icon, type IconName } from "@/components/admin/ui/Icon";

/**
 * Unternavigation der Einstellungen (Figma 49:3529): am Desktop als Karte links,
 * mobil als waagerechte Tabs (Figma 45:3278).
 */
export const SETTINGS_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/einstellungen/shopdaten", label: "Shopdaten", icon: "inhalte" },
  { href: "/admin/einstellungen/versand", label: "Versand", icon: "lkw" },
  { href: "/admin/einstellungen/steuern", label: "Steuern", icon: "rabatte" },
  { href: "/admin/einstellungen/tracking", label: "Tracking", icon: "auge" },
  { href: "/admin/einstellungen/rechnungen", label: "Rechnungen", icon: "pdf" },
  { href: "/admin/einstellungen/benutzer", label: "Benutzer", icon: "benutzer" },
];

export function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Einstellungen" className="min-w-0">
      <ul className="border-admin-rahmen lg:rounded-admin-karte lg:bg-admin-karte -mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:border lg:p-2">
        {SETTINGS_ITEMS.map((item) => {
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
                    ? "border-admin-akzent text-admin-text lg:bg-admin-akzent-hell lg:text-admin-akzent font-bold"
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
