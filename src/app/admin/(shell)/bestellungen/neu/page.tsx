import type { Metadata } from "next";
import { hasRole, requireStaff } from "@/lib/admin/auth";
import {
  listOrderableVariants,
  listShippingRateOptions,
  type OrderableVariant,
  type ShippingRateOption,
} from "@/lib/admin/orders/lookup";
import { serverEnv } from "@/lib/env/server";
import { NoAccess } from "@/components/admin/NoAccess";
import { ManualOrderForm } from "@/components/admin/orders/ManualOrderForm";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Manuelle Bestellung" };

const PATH = "/admin/bestellungen/neu";

/**
 * /admin/bestellungen/neu: manuelle Bestellung (Telefon, B2B, Messe) über createManualOrder
 * (src/lib/admin/orders/manual.ts). Nur Owner und Admin. Vor dem Go-live (APP_STAGE nicht
 * production) ist jede manuelle Bestellung eine Testbestellung.
 */
export default async function NewOrderPage() {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) {
    return <NoAccess text="Manuelle Bestellungen legen Owner und Admin an." />;
  }
  let variants: OrderableVariant[] = [];
  let rates: ShippingRateOption[] = [];
  let failed = false;
  try {
    [variants, rates] = await Promise.all([listOrderableVariants(), listShippingRateOptions()]);
  } catch (error) {
    console.error("[admin] Manuelle Bestellung", error);
    failed = true;
  }
  const testForced = serverEnv().APP_STAGE !== "production";

  return (
    <>
      <PageHeader
        title="Manuelle Bestellung"
        description="Positionen, Kunde, Versand und Zahlungsweise. Preise kommen aus dem Katalog, berechnet auf dem Server."
        backHref="/admin/bestellungen"
        backLabel="Zurück zu den Bestellungen"
      />
      {failed ? (
        <FormMessage tone="error">
          Katalog oder Versandtarife konnten nicht geladen werden.
        </FormMessage>
      ) : null}
      {testForced ? (
        <FormMessage tone="warning">
          Testmodus: Vor dem Go-live wird jede manuelle Bestellung als Testbestellung markiert.
        </FormMessage>
      ) : null}
      <ManualOrderForm variants={variants} rates={rates} testForced={testForced} />
    </>
  );
}
