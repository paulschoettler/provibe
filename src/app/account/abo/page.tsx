import type { Metadata, Route } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { BTN_OUTLINE, CARD, LINK_PLUM } from "@/components/account/ui";
import { SubscriptionListCard } from "@/components/subscriptions/PortalParts";
import { requireCustomer } from "@/lib/auth/session";
import { listMySubscriptions } from "@/lib/subscriptions/data";

/**
 * /account/abo: Übersicht der Abos (Figma 62:451 mobil, 62:666 Desktop). Nur mit Session,
 * dynamisch (Nutzerdaten). Daten über RLS (eigene Abos), Preise aus dem Katalog.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dein Abo",
  description: "Lieferungen steuern: überspringen, pausieren, ändern oder kündigen.",
  alternates: { canonical: "/account/abo" },
  robots: { index: false, follow: false },
};

/** Navigationseintrag "Abo" fehlt noch in AccountShell (Vorschlag im Bericht). */

export default async function AboOverviewPage() {
  const customer = await requireCustomer("/account/abo");
  const subscriptions = await listMySubscriptions(customer);
  const open = subscriptions.filter((s) => s.status !== "cancelled");
  const cancelled = subscriptions.filter((s) => s.status === "cancelled");

  return (
    <AccountShell active="abo">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="headline text-pv-wildberry text-[40px] lg:text-[64px]">Dein Abo</h1>
        <p className="pv-acc-hello-sticker">Jederzeit flexibel.</p>
      </div>
      <p className="mt-4 max-w-[640px] text-[16px] leading-[1.5] lg:text-[17px]">
        Hier steuerst du deine Lieferungen. Änderungen gelten ab der nächsten Lieferung.
      </p>

      {open.length === 0 ? (
        <div className={`${CARD} mt-8 flex flex-col items-start gap-4 p-6`}>
          <p className="text-[16px] leading-[1.5]">
            {cancelled.length > 0
              ? "Du hast gerade kein laufendes Abo."
              : 'Du hast noch kein Abo. Wähl auf einer Sortenseite "Im Abo sparen", dann kommt dein Eistee automatisch im Rhythmus deiner Wahl.'}
          </p>
          <Link href={"/collections/all" as Route} className={BTN_OUTLINE}>
            Sorten entdecken
          </Link>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4" aria-label="Deine Abos">
          {open.map((card) => (
            <li key={card.id}>
              <SubscriptionListCard card={card} />
            </li>
          ))}
        </ul>
      )}

      {cancelled.length > 0 ? (
        <section className="mt-10" aria-labelledby="beendete-abos">
          <h2 id="beendete-abos" className="text-[20px] font-medium">
            Beendete Abos
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {cancelled.map((card) => (
              <li key={card.id}>
                <SubscriptionListCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 text-[14px] lg:flex-row lg:items-center lg:justify-between">
        <Link href={"/collections/all" as Route} className={LINK_PLUM}>
          Weiteres Abo starten: zum Shop
        </Link>
        <p>
          Kündigen geht auch ohne Login unter{" "}
          <Link href={"/abo-kuendigen" as Route} className={LINK_PLUM}>
            provibe-drinks.de/abo-kuendigen
          </Link>
          .
        </p>
      </div>
    </AccountShell>
  );
}
