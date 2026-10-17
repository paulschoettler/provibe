import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { signOut } from "@/lib/auth/actions";
import { BoxIcon, GridIcon, LogoutIcon, PinIcon, UserIcon } from "./icons";
import { Eyebrow } from "./ui";

export type AccountSection = "uebersicht" | "bestellungen" | "abo" | "adressen" | "daten";

const NAV: { key: AccountSection; label: string; href: Route; Icon: typeof GridIcon }[] = [
  { key: "uebersicht", label: "Übersicht", href: "/account", Icon: GridIcon },
  { key: "bestellungen", label: "Bestellungen", href: "/account/bestellungen", Icon: BoxIcon },
  { key: "abo", label: "Abo", href: "/account/abo" as Route, Icon: BoxIcon },
  { key: "adressen", label: "Adressen", href: "/account/adressen", Icon: PinIcon },
  { key: "daten", label: "Daten", href: "/account/daten", Icon: UserIcon },
];

/**
 * Rahmen der eingeloggten Kontoseiten (Figma 35:9796 / 35:10049): mobil Pill-Tabs unter dem
 * Header, ab 1024 px Seitennavigation links. Rosa Blob oben rechts als Dekor.
 */
export function AccountShell({
  active,
  children,
}: {
  active: AccountSection;
  children: ReactNode;
}) {
  return (
    <SiteShell mainClassName="pv-acc">
      <div className="pv-acc-blob" aria-hidden="true" />

      {/* Mobil: horizontale Tabs */}
      <nav aria-label="Kontobereiche" className="pv-acc-tabs lg:hidden">
        <ul>
          {NAV.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
                className="pv-acc-tab"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <form action={signOut}>
              <button type="submit" className="pv-acc-tab">
                Abmelden
              </button>
            </form>
          </li>
        </ul>
      </nav>

      <div className="relative mx-auto grid w-full max-w-[1320px] gap-10 px-4 pt-6 pb-16 lg:grid-cols-[216px_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:pt-12 lg:pb-24">
        <aside className="hidden lg:block">
          <Eyebrow className="mb-4">Dein Konto</Eyebrow>
          <nav aria-label="Kontobereiche">
            <ul className="flex flex-col gap-1.5">
              {NAV.map(({ key, label, href, Icon }) => (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={key === active ? "page" : undefined}
                    className="pv-acc-side"
                  >
                    <Icon className="size-[18px]" />
                    <span className="flex-1">{label}</span>
                    {key === active ? (
                      <span className="bg-pv-wildberry size-1.5 rounded-full" aria-hidden="true" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-pv-ui-hairline mt-3 border-t pt-3">
            <form action={signOut}>
              <button type="submit" className="pv-acc-side w-full">
                <LogoutIcon className="size-[18px]" />
                <span className="flex-1 text-left">Abmelden</span>
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </SiteShell>
  );
}

export default AccountShell;
