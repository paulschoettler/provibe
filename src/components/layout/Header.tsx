import Image from "next/image";
import Link from "next/link";
import { SiteLink } from "./SiteLink";
import type { MenuItem } from "@/lib/catalog/home";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartIconButton } from "./CartIconButton";
import { HeaderScrollEffect } from "./HeaderScrollEffect";
import { MobileMenu } from "./MobileMenu";
import { AccountIcon, SearchIcon } from "./icons";
import { MAIN_MENU_FALLBACK } from "./social";

export interface HeaderProps {
  menus?: MenuItem[];
  announcements?: string[];
  /**
   * "home": Der Header steht auf der Startseite hinter der Hero-Sequenz.
   * "default": normaler Seitenkopf ganz oben, gleiche Optik.
   */
  variant?: "home" | "default";
}

const DEFAULT_ANNOUNCEMENTS = [
  "Versandkostenfrei ab 50 €",
  "10% Rabatt auf deine Bestellung mit dem Code PRESALE10",
];

/**
 * Seitenkopf: Announcement-Bar, Logo, Navigation, Suche, Konto, Warenkorb, mobiler Drawer.
 * Alles Inhaltliche steht im Server-HTML. Client sind nur die Meldungsrotation,
 * der Warenkorb-Zähler, der mobile Drawer und der Schatten beim Scrollen.
 */
export function Header({ menus, announcements, variant = "default" }: HeaderProps) {
  const items = menus && menus.length > 0 ? menus : MAIN_MENU_FALLBACK;
  const messages =
    announcements && announcements.length > 0 ? announcements : DEFAULT_ANNOUNCEMENTS;

  return (
    <header className="pv-header" data-variant={variant}>
      <HeaderScrollEffect />
      <AnnouncementBar messages={messages} />

      <div className="pv-headerbar">
        <div className="pv-headerbar-inner">
          <Link href="/" className="pv-logo-link" aria-label="provibe, zur Startseite">
            <Image
              src="/images/brand/logo-wine.png"
              alt="provibe"
              width={1000}
              height={297}
              priority={variant === "default"}
              sizes="(min-width: 1024px) 150px, 120px"
              className="pv-logo-img"
            />
          </Link>

          <nav className="pv-nav" aria-label="Hauptnavigation">
            <ul>
              {items.map((item) => (
                <li key={`${item.label}-${item.url}`}>
                  {item.external ? (
                    <a href={item.url} className="pv-nav-link" rel="noreferrer noopener">
                      {item.label}
                    </a>
                  ) : (
                    <SiteLink href={item.url} className="pv-nav-link">
                      {item.label}
                    </SiteLink>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="pv-header-actions">
            <SiteLink href="/search" className="pv-header-icon" aria-label="Suche">
              <SearchIcon className="h-6 w-6" />
            </SiteLink>
            <SiteLink href="/account" className="pv-header-icon" aria-label="Konto">
              <AccountIcon className="h-6 w-6" />
            </SiteLink>
            <CartIconButton />
            <MobileMenu menus={items} />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
