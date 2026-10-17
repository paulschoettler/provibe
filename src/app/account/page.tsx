import type { Metadata, Route } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { BoxIcon, ChevronRightIcon, MailIcon, PinIcon, UserIcon } from "@/components/account/icons";
import { LastOrderCard } from "@/components/account/OrderParts";
import { BTN_OUTLINE, CARD } from "@/components/account/ui";
import { getAccountOverview, getNewsletterState, getOrderByNumber } from "@/lib/auth/account-data";
import { requireCustomer } from "@/lib/auth/session";

/** /account: Konto-Übersicht (Figma 35:9796 mobil, 35:10049 Desktop). Nur mit Session. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dein Konto",
  description: "Deine Bestellungen, Adressen und Daten bei provibe.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

const NEWSLETTER_TEXT = {
  subscribed: "Angemeldet",
  pending: "Bestätigung ausstehend",
  none: "Nicht angemeldet",
} as const;

export default async function AccountPage() {
  const customer = await requireCustomer("/account");
  const [overview, newsletter] = await Promise.all([
    getAccountOverview(),
    getNewsletterState(customer),
  ]);
  const lastOrder = overview.lastOrder ? await getOrderByNumber(overview.lastOrder.number) : null;
  const name = customer.firstName?.trim();

  const tiles: { href: Route; title: string; text: string; Icon: typeof BoxIcon }[] = [
    {
      href: "/account/bestellungen",
      title: "Bestellungen",
      text:
        overview.orderCount === 0
          ? "Noch keine Bestellung"
          : `${overview.orderCount} ${overview.orderCount === 1 ? "Bestellung" : "Bestellungen"}`,
      Icon: BoxIcon,
    },
    {
      href: "/account/adressen",
      title: "Adressen",
      text:
        overview.addressCount === 0
          ? "Noch keine Adresse"
          : `${overview.addressCount} ${overview.addressCount === 1 ? "Adresse" : "Adressen"} gespeichert`,
      Icon: PinIcon,
    },
    { href: "/account/daten", title: "Daten", text: "Name, E-Mail, Passwort", Icon: UserIcon },
    {
      href: "/account/daten#newsletter" as Route,
      title: "Newsletter",
      text: NEWSLETTER_TEXT[newsletter],
      Icon: MailIcon,
    },
  ];

  return (
    <AccountShell active="uebersicht">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="headline text-pv-wildberry text-[40px] lg:text-[64px]">
          {name ? `Hi ${name}` : "Hi!"}
        </h1>
        <p className="pv-acc-hello-sticker">Schön, dass du da bist.</p>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 lg:mt-8 lg:grid-cols-4 lg:gap-3">
        {tiles.map(({ href, title, text, Icon }) => (
          <li key={title}>
            <Link href={href} className="pv-acc-tile">
              <span className="flex items-center justify-between">
                <span className="bg-pv-cream text-pv-wildberry flex size-9 items-center justify-center rounded-full">
                  <Icon className="size-[18px]" />
                </span>
                <ChevronRightIcon className="text-pv-wildberry size-[18px]" />
              </span>
              <span className="mt-auto text-[16px] leading-[1.3] font-bold">{title}</span>
              <span className="text-[12px] leading-[1.4]">{text}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10 lg:mt-12" aria-labelledby="letzte-bestellung">
        <h2 id="letzte-bestellung" className="text-[22px] leading-[1.2] font-medium lg:text-[24px]">
          Deine letzte Bestellung
        </h2>
        <div className="mt-4">
          {lastOrder ? (
            <LastOrderCard order={lastOrder} />
          ) : (
            <div className={`${CARD} flex flex-col items-start gap-4 p-6`}>
              <p className="text-[16px] leading-[1.5]">
                Hier erscheint deine Bestellung, sobald du bestellt hast. Bestellungen, die du
                vorher als Gast mit dieser E-Mail-Adresse aufgegeben hast, ordnen wir automatisch
                zu.
              </p>
              <Link href={"/collections/all" as Route} className={BTN_OUTLINE}>
                Sorten entdecken
              </Link>
            </div>
          )}
        </div>
      </section>
    </AccountShell>
  );
}
