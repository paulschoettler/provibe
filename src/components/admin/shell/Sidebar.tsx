"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/admin/staff/actions";
import { cx } from "@/components/admin/ui/cx";
import { Icon } from "@/components/admin/ui/Icon";
import { isActive, type NavLink } from "./nav-shared";

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
}

/**
 * Inhalt der Seitenleiste (Figma 26:3601): Logo, Navigation mit aktivem Punkt in Magenta,
 * unten Benutzer mit Rolle und Abmelden. Wird am Desktop fest und mobil im Drawer genutzt.
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
            src="/images/brand/logo-cream.png"
            alt="provibe"
            width={1000}
            height={297}
            className="h-[38px] w-auto"
            priority
          />
        </Link>
        <nav aria-label="Backoffice">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "rounded-admin-feld flex h-11 items-center gap-2.5 px-3 text-[14px] leading-[1.4] lg:h-10",
                      active
                        ? "bg-admin-akzent text-admin-auf-akzent font-semibold"
                        : "font-medium hover:bg-white/10",
                    )}
                  >
                    <Icon name={item.icon} size={18} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count ? (
                      <span
                        className={cx(
                          "rounded-admin-badge flex h-5 min-w-5 items-center justify-center px-[7px] text-[12px] font-semibold",
                          active
                            ? "bg-admin-karte text-admin-akzent"
                            : "bg-admin-akzent text-admin-auf-akzent",
                        )}
                      >
                        <span className="sr-only">offen: </span>
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="flex flex-col gap-2">
        <div className="bg-admin-seitenleiste-text h-px opacity-15" />
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="bg-admin-akzent text-admin-auf-akzent flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
            {user.initials}
          </span>
          <span className="min-w-0 flex-1 leading-[1.4]">
            <span className="block truncate text-[14px] font-medium" title={user.email}>
              {user.name}
            </span>
            <span className="block text-[12px] opacity-70">{user.roleLabel}</span>
          </span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-admin-feld flex h-11 w-full items-center gap-2.5 px-3 text-[14px] font-medium hover:bg-white/10 lg:h-10"
          >
            <Icon name="abmelden" size={18} />
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
