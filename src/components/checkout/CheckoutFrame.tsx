import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/checkout/links";
import { ChevronLeftIcon, LockIcon } from "./icons";

/**
 * Reduzierter Rahmen der Kasse (Figma 26:2850/26:2864 Header, 26:2879/26:2890 Footer):
 * Logo, "Sicher bezahlen", "Zurück zum Warenkorb", unten nur die Rechtslinks. Keine Navigation,
 * kein Warenkorb-Drawer, damit nichts vom Bezahlen ablenkt.
 */
export function CheckoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="co-frame flex min-h-dvh flex-col">
      <a
        href="#kasse"
        className="sr-only-focusable bg-pv-wildberry text-pv-white absolute top-2 left-2 z-50 rounded-full px-4 py-2"
      >
        Zum Inhalt springen
      </a>
      <header className="border-pv-ui-hairline bg-pv-cream relative z-10 border-b">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 lg:h-[64px] lg:px-[120px]">
          <Link href="/" className="flex h-11 items-center" aria-label="provibe, zur Startseite">
            <Image
              src="/brand/logo/provibe-logo-wildberry.svg"
              alt="provibe"
              width={202}
              height={79}
              priority
              className="h-7 w-auto lg:h-8"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={"/cart" as Route}
              className="text-pv-wildberry hidden h-11 items-center gap-1 text-[14px] font-bold underline underline-offset-4 lg:flex"
            >
              <ChevronLeftIcon className="h-[18px] w-[18px]" />
              Zurück zum Warenkorb
            </Link>
            <span className="bg-pv-ui-hairline hidden h-6 w-px lg:block" aria-hidden="true" />
            <p className="lg:bg-pv-cream flex items-center gap-1.5 text-[14px] font-bold lg:rounded-full lg:px-3.5 lg:py-1.5">
              <LockIcon className="h-[18px] w-[18px]" />
              Sicher bezahlen
            </p>
          </div>
        </div>
        <div className="bg-pv-cream lg:hidden">
          <Link
            href={"/cart" as Route}
            className="text-pv-wildberry flex h-11 items-center gap-1 px-3 text-[14px] font-bold underline underline-offset-4"
          >
            <ChevronLeftIcon className="h-[18px] w-[18px]" />
            Zurück zum Warenkorb
          </Link>
        </div>
      </header>

      <div id="kasse" className="relative flex-1">
        {children}
      </div>

      <footer className="bg-pv-cream">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-0.5 px-4 pt-2 pb-5 lg:flex-row lg:justify-between lg:px-[120px] lg:py-4">
          <nav aria-label="Rechtliches" className="flex flex-wrap justify-center gap-x-[18px]">
            {(
              [
                ["Impressum", LEGAL_LINKS.impressum],
                ["Datenschutz", LEGAL_LINKS.datenschutz],
                ["AGB", LEGAL_LINKS.agb],
                ["Widerruf", LEGAL_LINKS.widerruf],
              ] as const
            ).map(([label, href]) => (
              <Link
                key={href}
                href={href as Route}
                className="text-pv-wildberry flex h-11 items-center text-[14px] underline underline-offset-4"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-[12px] lg:text-[14px]">© 2026 provibe</p>
        </div>
      </footer>
    </div>
  );
}
