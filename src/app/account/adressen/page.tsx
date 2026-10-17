import type { Metadata, Route } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { AddressForm } from "@/components/account/AddressForm";
import { PlusIcon } from "@/components/account/icons";
import { AddressLines } from "@/components/account/OrderParts";
import { BTN_OUTLINE, Badge, CARD_FLAT, LINK_PLUM, Notice } from "@/components/account/ui";
import { deleteAddress, setDefaultAddress } from "@/lib/auth/account-actions";
import { listAddresses } from "@/lib/auth/account-data";
import { requireCustomer } from "@/lib/auth/session";

/**
 * /account/adressen: gespeicherte Adressen anlegen, bearbeiten, löschen, Standard setzen.
 * Abgeleitet aus den Konto-Vorlagen (kein eigener Figma-Screen laut Seitenplan).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deine Adressen",
  description: "Liefer- und Rechnungsadressen in deinem provibe Konto.",
  alternates: { canonical: "/account/adressen" },
  robots: { index: false, follow: false },
};

export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<{
    neu?: string;
    bearbeiten?: string;
    gespeichert?: string;
    geloescht?: string;
  }>;
}) {
  await requireCustomer("/account/adressen");
  const [params, addresses] = await Promise.all([searchParams, listAddresses()]);
  const editing = params.bearbeiten ? addresses.find((a) => a.id === params.bearbeiten) : undefined;
  const showForm = Boolean(params.neu) || Boolean(editing) || addresses.length === 0;

  return (
    <AccountShell active="adressen">
      <h1 className="headline text-wine text-[40px] lg:text-[56px]">Deine Adressen</h1>
      <p className="mt-2 text-[15px] leading-[1.5]">
        Gespeicherte Adressen kannst du im Checkout mit einem Tipp übernehmen.
      </p>

      {params.gespeichert ? (
        <Notice tone="success" role="status" title="Gespeichert" className="mt-5">
          Deine Adressen sind auf dem neuesten Stand.
        </Notice>
      ) : null}
      {params.geloescht ? (
        <Notice tone="success" role="status" title="Adresse gelöscht" className="mt-5" />
      ) : null}

      {addresses.length > 0 ? (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={`${CARD_FLAT} flex flex-col gap-3 p-5`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold">
                  {a.label ?? `${a.firstName} ${a.lastName}`}
                </h2>
                {a.isDefaultShipping ? <Badge tone="butter">Standard Lieferung</Badge> : null}
                {a.isDefaultBilling ? <Badge tone="neutral">Standard Rechnung</Badge> : null}
              </div>
              <AddressLines address={a} />
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href={`/account/adressen?bearbeiten=${a.id}` as Route}
                  className={`${LINK_PLUM} inline-flex min-h-11 items-center text-[14px]`}
                >
                  Bearbeiten<span className="sr-only">: {a.street}</span>
                </Link>
                {!a.isDefaultShipping ? (
                  <form action={setDefaultAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="kind" value="shipping" />
                    <button type="submit" className={`${LINK_PLUM} min-h-11 text-[14px]`}>
                      Als Standard<span className="sr-only"> für die Lieferung</span>
                    </button>
                  </form>
                ) : null}
                <form action={deleteAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="text-berry min-h-11 text-[14px] font-semibold underline decoration-[1.5px] underline-offset-4"
                  >
                    Löschen<span className="sr-only">: {a.street}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        {showForm ? (
          <AddressForm key={editing?.id ?? "neu"} address={editing} />
        ) : (
          <Link href={"/account/adressen?neu=1" as Route} className={BTN_OUTLINE}>
            <PlusIcon className="size-[18px]" />
            Neue Adresse
          </Link>
        )}
      </div>
    </AccountShell>
  );
}
