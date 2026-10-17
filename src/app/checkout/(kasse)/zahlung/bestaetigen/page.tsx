import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { LockIcon } from "@/components/checkout/icons";
import { cancel3dsAction, confirm3dsAction } from "@/lib/checkout/actions";
import { loadCheckoutState, readSnapshot } from "@/lib/checkout/session";
import { serverEnv } from "@/lib/env/server";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zahlung bestätigen",
  robots: { index: false, follow: false },
};

/**
 * Simulation der 3-D-Secure-Abfrage für die Testkarte 4000 0025 0000 3155 (nur Mock).
 * Mit echtem Stripe übernimmt das Payment Element die Bankabfrage, diese Seite entfällt.
 */
export default async function ThreeDsPage({
  searchParams,
}: {
  searchParams: Promise<{ marke?: string; endung?: string }>;
}) {
  if (serverEnv().APP_INTEGRATIONS !== "mock") redirect("/checkout/zahlung" as Route);
  const [state, params] = await Promise.all([loadCheckoutState(), searchParams]);
  if (!state?.session || state.session.status !== "processing") {
    redirect("/checkout/zahlung" as Route);
  }
  const snapshot = readSnapshot(state.session.amounts);
  const brand = (params.marke ?? "Visa").slice(0, 30);
  const last4 = (params.endung ?? "").replace(/\D/g, "").slice(-4);

  return (
    <main className="mx-auto flex max-w-[520px] flex-col gap-6 px-4 py-12 lg:py-20">
      <div className="bg-pv-cream border-pv-wildberry flex flex-col gap-4 rounded-[26px] border-2 p-6">
        <p className="co-eyebrow">Testmodus · 3-D-Secure</p>
        <h1 className="text-pv-wildberry text-[32px] leading-[1.08] font-medium">
          Zahlung bei deiner Bank bestätigen
        </h1>
        <p className="text-[15px] leading-[1.5]">
          So sieht später die Abfrage deiner Bank aus. Bestätige die Zahlung über{" "}
          <strong>{snapshot ? formatEur(snapshot.totalCents) : "den Betrag"}</strong> an provibe mit
          deiner {brand}
          {last4 ? ` (endet auf ${last4})` : ""}.
        </p>
        <form action={confirm3dsAction}>
          <input type="hidden" name="marke" value={brand} />
          <input type="hidden" name="endung" value={last4} />
          <button type="submit" className="btn-primary w-full">
            <LockIcon className="h-4 w-4" />
            Zahlung bestätigen
          </button>
        </form>
        <form action={cancel3dsAction}>
          <button type="submit" className="btn-secondary w-full">
            Abbrechen
          </button>
        </form>
      </div>
    </main>
  );
}
