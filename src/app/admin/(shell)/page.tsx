import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/admin/auth";
import { parsePeriod } from "@/lib/admin/dashboard/period";
import { loadDashboard, type DashboardData } from "@/lib/admin/dashboard/queries";
import { PeriodPicker } from "@/components/admin/dashboard/PeriodPicker";
import { RevenueChart } from "@/components/admin/dashboard/RevenueChart";
import { Badge } from "@/components/admin/ui/Badge";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate, formatMoney, formatNumber } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Stat, type StatDelta } from "@/components/admin/ui/Stat";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { FormMessage } from "@/components/admin/ui/ActionForm";

export const metadata: Metadata = { title: "Dashboard" };

/** /admin Dashboard (Figma 28:5911). Testbestellungen sind ausgeschlossen, Tage nach Europe/Berlin. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string; von?: string; bis?: string }>;
}) {
  await requireStaff("support", { next: "/admin" });
  const period = parsePeriod(await searchParams);
  let data: DashboardData | null = null;
  try {
    data = await loadDashboard(period);
  } catch (error) {
    console.error("[admin] Dashboard", error);
  }

  return (
    <>
      <PageHeader title="Dashboard" className="sr-only" />
      <div className="flex flex-col gap-4">
        <PeriodPicker period={period} />
        {!data ? (
          <FormMessage tone="error">
            Die Kennzahlen konnten gerade nicht geladen werden. Lade die Seite neu.
          </FormMessage>
        ) : (
          <DashboardBody data={data} periodLabel={period.label} />
        )}
      </div>
    </>
  );
}

function toDelta(d: { text: string; direction: "up" | "down" | "flat" } | null): StatDelta | null {
  return d ? { text: d.text, direction: d.direction } : null;
}

function DashboardBody({ data, periodLabel }: { data: DashboardData; periodLabel: string }) {
  const { summary, deltas, customers, top, lowStock, recent } = data;
  const newShare = customers.total
    ? Math.round((customers.newCustomers.orders / customers.total) * 100)
    : 0;
  const noComparison = "Keine Vergleichsdaten";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="Umsatz"
          value={formatMoney(summary.revenueCents)}
          delta={toDelta(deltas.revenue)}
          hint={noComparison}
        />
        <Stat
          label="Bestellungen"
          value={formatNumber(summary.orders)}
          delta={toDelta(deltas.orders)}
          hint={noComparison}
        />
        <Stat
          label="Ø Warenkorb"
          value={formatMoney(summary.aovCents)}
          delta={toDelta(deltas.aov)}
          hint={noComparison}
        />
        <Stat
          label="Conversion"
          value={<span className="text-admin-text-2">–</span>}
          hint="Folgt mit dem Tracking: es gibt noch keine Sitzungsdaten."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Umsatz" className="lg:col-span-2">
          <p className="mb-3 text-[22px] font-semibold tabular-nums md:text-[26px]">
            {formatMoney(summary.revenueCents)}
          </p>
          <RevenueChart
            points={data.series}
            currentLabel={periodLabel}
            previousLabel="Vorzeitraum"
          />
        </Card>

        <Card
          title="Neu- und Bestandskunden"
          description={`${formatNumber(customers.total)} Bestellungen im Zeitraum`}
        >
          {customers.total === 0 ? (
            <EmptyState compact icon="kunden" title="Noch keine Bestellungen im Zeitraum" />
          ) : (
            <div className="flex flex-col gap-4">
              <div
                className="bg-admin-flaeche flex h-2.5 overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <span className="bg-admin-akzent h-full" style={{ width: `${newShare}%` }} />
                <span className="bg-admin-seitenleiste ml-0.5 h-full flex-1" />
              </div>
              <SplitRow
                color="bg-admin-akzent"
                label="Neukunden"
                orders={customers.newCustomers.orders}
                revenue={customers.newCustomers.revenueCents}
                share={newShare}
              />
              <SplitRow
                color="bg-admin-seitenleiste"
                label="Bestandskunden"
                orders={customers.returning.orders}
                revenue={customers.returning.revenueCents}
                share={100 - newShare}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Top-Produkte"
          flush
          action={
            <Link href="/admin/produkte" className={cardActionClass}>
              Alle Produkte
            </Link>
          }
        >
          {top.length === 0 ? (
            <EmptyState compact icon="produkte" title="Noch keine Verkäufe im Zeitraum" />
          ) : (
            <table className="w-full text-[14px]">
              <caption className="sr-only">Top-Produkte nach Umsatz</caption>
              <thead>
                <tr className="border-admin-rahmen text-admin-text-2 h-9 border-y text-[12px]">
                  <th scope="col" className="px-4 text-left font-medium">
                    Produkt
                  </th>
                  <th scope="col" className="px-2 text-right font-medium max-md:hidden">
                    Verkauft
                  </th>
                  <th scope="col" className="px-4 text-right font-medium">
                    Umsatz
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((p) => (
                  <tr
                    key={p.productId ?? p.title}
                    className="border-admin-rahmen h-[52px] border-b last:border-b-0"
                  >
                    <td className="px-4">
                      <span className="flex items-center gap-3">
                        <span className="rounded-admin-feld bg-admin-flaeche flex size-9 shrink-0 items-center justify-center overflow-hidden">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="size-9 object-contain"
                            />
                          ) : (
                            <Icon name="bild" size={16} className="text-admin-text-2" />
                          )}
                        </span>
                        {p.productId ? (
                          <Link href={`/admin/produkte/${p.productId}`} className="hover:underline">
                            {p.title}
                          </Link>
                        ) : (
                          p.title
                        )}
                      </span>
                    </td>
                    <td className="text-admin-text-2 px-2 text-right tabular-nums max-md:hidden">
                      {formatNumber(p.quantity)}
                    </td>
                    <td className="px-4 text-right font-medium tabular-nums">
                      {formatMoney(p.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Niedrige Bestände"
          action={
            <>
              {lowStock.total > 0 ? (
                <Badge tone="yellow" noDot>
                  {lowStock.total} {lowStock.total === 1 ? "Warnung" : "Warnungen"}
                </Badge>
              ) : null}
              <Link href="/admin/bestand" className={cardActionClass}>
                Zum Bestand
              </Link>
            </>
          }
        >
          {!lowStock.tracking ? (
            <EmptyState compact icon="bestand" title="Bestandsführung noch aus">
              Sie startet mit dem Import der echten Bestände (Entscheidung H3). Bis dahin gilt jede
              Variante als verfügbar.
            </EmptyState>
          ) : lowStock.items.length === 0 ? (
            <EmptyState compact icon="haken" title="Alle Bestände über der Warnschwelle" />
          ) : (
            <ul className="flex flex-col gap-2">
              {lowStock.items.map((l) => (
                <li
                  key={l.variantId}
                  className={`rounded-admin-feld flex items-center gap-3 px-3 py-2.5 ${l.soldOut ? "bg-admin-rot-hell" : "bg-admin-gelb-hell"}`}
                >
                  <span className={l.soldOut ? "text-admin-rot" : "text-admin-gelb"}>
                    <Icon name="warnung" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {l.productTitle} · {l.title}
                    </span>
                    <span
                      className={`block text-[12px] ${l.soldOut ? "text-admin-rot" : "text-admin-gelb-text"}`}
                    >
                      {l.soldOut
                        ? `Ausverkauft · ${Math.max(0, l.available)} verfügbar`
                        : `Noch ${l.available} verfügbar · Warnschwelle ${l.threshold}`}
                    </span>
                  </span>
                  <Link
                    href={`/admin/bestand?variante=${l.variantId}`}
                    className="text-admin-akzent text-[13px] font-medium hover:underline"
                  >
                    Nachbestellen
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="letzte-bestellungen" className="flex flex-col gap-0">
        <Table
          caption="Letzte Bestellungen"
          rows={recent}
          rowKey={(o) => o.id}
          rowHref={(o) => `/admin/bestellungen/${o.id}`}
          toolbar={
            <div className="flex items-center justify-between px-4 py-3">
              <h2 id="letzte-bestellungen" className="text-[16px] font-semibold">
                Letzte Bestellungen
              </h2>
              <Link href="/admin/bestellungen" className={cardActionClass}>
                Alle Bestellungen
              </Link>
            </div>
          }
          empty={<EmptyState compact icon="bestellungen" title="Noch keine Bestellungen" />}
          columns={[
            { key: "nummer", header: "Nummer", width: "120px", cell: (o) => o.orderNumber },
            {
              key: "datum",
              header: "Datum",
              width: "120px",
              cell: (o) => <span className="text-admin-text-2">{formatDate(o.placedAt)}</span>,
            },
            { key: "kunde", header: "Kunde", cell: (o) => o.customerName },
            {
              key: "positionen",
              header: "Positionen",
              align: "right",
              width: "100px",
              hideBelowLg: true,
              cell: (o) => <span className="text-admin-text-2">{o.itemCount}</span>,
            },
            {
              key: "gesamt",
              header: "Gesamt",
              align: "right",
              width: "110px",
              cell: (o) => (
                <span className="font-medium tabular-nums">{formatMoney(o.totalCents)}</span>
              ),
            },
            {
              key: "zahlung",
              header: "Zahlstatus",
              width: "150px",
              cell: (o) => (
                <Badge tone={o.badges.payment.tone} hollow={o.badges.payment.hollow}>
                  {o.badges.payment.label}
                </Badge>
              ),
            },
            {
              key: "versand",
              header: "Versandstatus",
              width: "150px",
              cell: (o) => (
                <Badge tone={o.badges.fulfilment.tone} hollow={o.badges.fulfilment.hollow}>
                  {o.badges.fulfilment.label}
                </Badge>
              ),
            },
          ]}
          renderCard={(o) => (
            <CardRow
              primary={o.orderNumber}
              aside={formatMoney(o.totalCents)}
              secondary={`${o.customerName} · ${o.itemCount} ${o.itemCount === 1 ? "Position" : "Positionen"}`}
              secondaryAside={formatDate(o.placedAt)}
              badges={
                <>
                  <Badge tone={o.badges.payment.tone} hollow={o.badges.payment.hollow}>
                    {o.badges.payment.label}
                  </Badge>
                  <Badge tone={o.badges.fulfilment.tone} hollow={o.badges.fulfilment.hollow}>
                    {o.badges.fulfilment.label}
                  </Badge>
                </>
              }
            />
          )}
        />
      </section>
    </>
  );
}

function SplitRow({
  color,
  label,
  orders,
  revenue,
  share,
}: {
  color: string;
  label: string;
  orders: number;
  revenue: number;
  share: number;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${color}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="text-admin-text-2 block text-[12px]">
          {formatNumber(orders)} {orders === 1 ? "Bestellung" : "Bestellungen"} ·{" "}
          {formatMoney(revenue)}
        </span>
      </span>
      <span className="text-[15px] font-semibold tabular-nums">{share} %</span>
    </div>
  );
}
