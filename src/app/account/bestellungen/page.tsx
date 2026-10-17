import type { Metadata, Route } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { OrderRow } from "@/components/account/OrderParts";
import { BTN_OUTLINE, CARD } from "@/components/account/ui";
import { listOrders } from "@/lib/auth/account-data";
import { requireCustomer } from "@/lib/auth/session";

/** /account/bestellungen: alle Bestellungen, neueste zuerst. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deine Bestellungen",
  description: "Alle Bestellungen in deinem provibe Konto mit Status, Tracking und Rechnung.",
  alternates: { canonical: "/account/bestellungen" },
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  await requireCustomer("/account/bestellungen");
  const orders = await listOrders();

  return (
    <AccountShell active="bestellungen">
      <h1 className="headline text-wine text-[40px] lg:text-[56px]">Deine Bestellungen</h1>
      <p className="mt-2 text-[15px] leading-[1.5]">
        {orders.length === 0
          ? "Du hast noch nichts bestellt."
          : `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"}. Tipp auf eine Bestellung für Status, Tracking und Rechnung.`}
      </p>

      {orders.length === 0 ? (
        <div className={`${CARD} mt-6 flex flex-col items-start gap-4 p-6`}>
          <p className="text-[16px] leading-[1.5]">
            Bestellungen, die du als Gast mit dieser E-Mail-Adresse aufgegeben hast, erscheinen hier
            automatisch.
          </p>
          <Link href={"/collections/all" as Route} className={BTN_OUTLINE}>
            Sorten entdecken
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
