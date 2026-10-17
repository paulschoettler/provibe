import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  getSettings,
  getSubscriptionMetrics,
  listSubscriptions,
  type AdminSubscriptionListItem,
  type SubscriptionMetrics,
} from "@/lib/subscriptions/admin";
import {
  countSubscriptionsByStatus,
  subscribableProductOptions,
  type SubscriptionStatusCounts,
} from "@/lib/subscriptions/admin-queries";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate, formatMoney, formatNumber } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { Stat } from "@/components/admin/ui/Stat";
import { CardRow, Table, type Column } from "@/components/admin/ui/Table";
import { CanThumb } from "@/components/admin/subscriptions/CanThumb";
import {
  PAYMENT_STATUS_LABEL,
  STATUS_BADGE,
  STATUS_SLUGS,
  intervalText,
  percentFromBp,
} from "@/components/admin/subscriptions/labels";

export const metadata: Metadata = { title: "Abos" };

const PATH = "/admin/abos";
const PAGE_SIZE = 50;

/** Text der Spalte "Nächste Lieferung" je nach Zustand (Figma 79:2120). */
function nextDeliveryText(s: AdminSubscriptionListItem): { text: string; muted: boolean } {
  if (s.status === "cancelled") {
    return { text: `gekündigt am ${formatDate(s.cancelledAt ?? null)}`, muted: true };
  }
  if (s.status === "past_due") {
    return { text: `offen seit ${formatDate(s.pastDueSince ?? null)}`, muted: true };
  }
  if (s.status === "paused") {
    return s.pausedUntil
      ? { text: `pausiert bis ${formatDate(s.pausedUntil)}`, muted: true }
      : { text: "pausiert (Zahlung)", muted: true };
  }
  if (!s.nextDelivery && s.cancelEffectiveAt) {
    return { text: `endet am ${formatDate(s.cancelEffectiveAt)}`, muted: true };
  }
  return {
    text: `${formatDate(s.nextDelivery)}${s.skipNext ? " (übersprungen)" : ""}`,
    muted: false,
  };
}

/**
 * /admin/abos (Figma 79:2120, mobil 79:3131): Kennzahlen, Tabs nach Status, Suche nach Abo-Nummer,
 * Name oder E-Mail, Filter Sorte und Intervall, Tabelle mit Kartenliste mobil.
 * Fulfillment sieht die Liefertermine, aber keine Beträge, keine E-Mail-Adressen und keine Umsätze.
 */
export default async function AbosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const showMoney = PERMISSIONS.viewCustomers(session);
  const canSettings = PERMISSIONS.viewCustomers(session);

  const sp = await searchParams;
  const slug = firstParam(sp.status) ?? "alle";
  const tab = STATUS_SLUGS.find((s) => s.slug === slug) ?? STATUS_SLUGS[0];
  const q = firstParam(sp.q)?.trim() ?? "";
  const sorte = firstParam(sp.sorte) ?? "";
  const intervallRaw = Number(firstParam(sp.intervall));
  const intervall = Number.isInteger(intervallRaw) && intervallRaw > 0 ? intervallRaw : undefined;
  const page = parsePage(sp.seite);

  let result: { items: AdminSubscriptionListItem[]; total: number } = { items: [], total: 0 };
  let counts: SubscriptionStatusCounts | null = null;
  let metrics: SubscriptionMetrics | null = null;
  let failed = false;
  const [products, settings] = await Promise.all([
    subscribableProductOptions(),
    getSettings().catch(() => null),
  ]);
  try {
    [result, counts, metrics] = await Promise.all([
      listSubscriptions({
        status: tab.status,
        search: q || undefined,
        productId: sorte || undefined,
        intervalWeeks: intervall,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      countSubscriptionsByStatus(),
      getSubscriptionMetrics(),
    ]);
  } catch (error) {
    console.error("[admin] Abo-Liste", error);
    failed = true;
  }

  const intervalOptions = [...new Set([...(settings?.intervals ?? [2, 4, 6, 8]), intervall ?? 0])]
    .filter((w) => w > 0)
    .sort((a, b) => a - b)
    .map((w) => ({ value: String(w), label: intervalText(w) }));
  const filtered = Boolean(q || sorte || intervall);
  const countFor = (status: string) =>
    counts ? counts[status as keyof SubscriptionStatusCounts] : undefined;

  const columns: Column<AdminSubscriptionListItem>[] = [
    {
      key: "kunde",
      header: "Abo und Kunde",
      cell: (s) => (
        <span className="flex flex-col">
          <span className="font-semibold">{s.customerName || s.customerEmail || "Kunde"}</span>
          <span className="text-admin-text-2 text-[12px]">{s.number}</span>
        </span>
      ),
    },
    {
      key: "produkt",
      header: "Sorte und Pack",
      cell: (s) => (
        <span className="flex items-center gap-2.5">
          <CanThumb src={s.imageUrl ?? null} />
          <span className="flex flex-col">
            <span className="text-admin-akzent font-medium">{s.productTitle || "Produkt"}</span>
            <span className="text-admin-text-2 text-[12px]">
              {s.variantTitle}
              {s.quantity > 1 ? ` × ${s.quantity}` : ""}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "intervall",
      header: "Intervall",
      width: "130px",
      cell: (s) => intervalText(s.intervalWeeks),
    },
    {
      key: "naechste",
      header: "Nächste Lieferung",
      width: "180px",
      cell: (s) => {
        const n = nextDeliveryText(s);
        return <span className={n.muted ? "text-admin-text-2" : undefined}>{n.text}</span>;
      },
    },
    ...(showMoney
      ? ([
          {
            key: "rabatt",
            header: "Rabatt",
            width: "80px",
            hideBelowLg: true,
            cell: (s) => percentFromBp(s.discountBp),
          },
          {
            key: "zahlung",
            header: "Letzte Zahlung",
            width: "150px",
            hideBelowLg: true,
            cell: (s) =>
              s.lastPayment ? (
                <span className="flex flex-col">
                  <span>{formatDate(s.lastPayment.at)}</span>
                  <span className="text-admin-text-2 text-[12px]">
                    {PAYMENT_STATUS_LABEL[s.lastPayment.status]?.label ?? s.lastPayment.status}
                  </span>
                </span>
              ) : (
                <span className="text-admin-text-2">–</span>
              ),
          },
          {
            key: "preis",
            header: "Je Lieferung",
            width: "110px",
            align: "right",
            cell: (s) => (
              <span className="font-semibold tabular-nums">
                {formatMoney(s.totalPerDeliveryCents)}
              </span>
            ),
          },
        ] satisfies Column<AdminSubscriptionListItem>[])
      : []),
    {
      key: "status",
      header: "Status",
      width: "140px",
      cell: (s) => <StatusCell s={s} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Abos"
        description="Laufende, pausierte und gekündigte Abos mit Lieferplan und Zahlungsstand."
        actions={
          canSettings ? (
            <>
              <ButtonLink href={`${PATH}/kuendigungen`} icon="stornieren">
                Kündigungen
              </ButtonLink>
              <ButtonLink href={`${PATH}/einstellungen`} icon="einstellungen">
                Einstellungen
              </ButtonLink>
            </>
          ) : undefined
        }
      />

      {failed ? (
        <FormMessage tone="error">Die Abos konnten gerade nicht geladen werden.</FormMessage>
      ) : null}

      {metrics ? (
        <section
          aria-label="Kennzahlen"
          className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        >
          <Stat
            label="Aktive Abos"
            value={formatNumber(metrics.active)}
            hint={`${formatNumber(metrics.paused)} pausiert, ${formatNumber(metrics.newLast30Days)} neu in 30 Tagen`}
          />
          <Stat
            label="Zahlung offen"
            value={
              metrics.pastDue > 0 ? (
                <Link
                  href={withParams(PATH, {}, { status: "offen" })}
                  className="text-admin-gelb-text underline-offset-2 hover:underline"
                >
                  {formatNumber(metrics.pastDue)}
                </Link>
              ) : (
                "0"
              )
            }
            hint={
              metrics.pastDue > 0 ? "Wiederholung läuft automatisch" : "Keine überfälligen Abos"
            }
          />
          {showMoney ? (
            <>
              <Stat
                label="Warenwert je Monat"
                value={formatMoney(metrics.mrrGoodsCents)}
                hint="Nach Abo-Rabatt, ohne Pfand und Versand"
              />
              <Stat
                label="Kündigungsquote"
                value={`${(metrics.churnRateBp / 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`}
                hint={`${formatNumber(metrics.cancelledLast30Days)} gekündigt in 30 Tagen`}
              />
            </>
          ) : null}
        </section>
      ) : null}

      <Table
        caption="Abos"
        rows={result.items}
        rowKey={(s) => s.id}
        rowHref={(s) => `${PATH}/${s.id}`}
        density="media"
        toolbar={
          <FilterBar
            action={PATH}
            chips={STATUS_SLUGS.map((s) => ({
              label: s.label,
              href: withParams(PATH, sp, {
                status: s.slug === "alle" ? null : s.slug,
                seite: null,
              }),
              active: s.slug === tab.slug,
              count: countFor(s.status),
            }))}
            hidden={{ status: tab.slug === "alle" ? undefined : tab.slug }}
            search={{
              value: q,
              placeholder: "Kunde, E-Mail oder Abo-Nummer suchen",
              label: "Abos suchen",
            }}
            resetHref={
              filtered
                ? withParams(PATH, {}, { status: tab.slug === "alle" ? null : tab.slug })
                : undefined
            }
          >
            <Select
              name="sorte"
              label="Sorte"
              hideLabel
              placeholder="Sorte: Alle"
              defaultValue={sorte}
              options={products}
            />
            <Select
              name="intervall"
              label="Intervall"
              hideLabel
              placeholder="Intervall: Alle"
              defaultValue={intervall ? String(intervall) : ""}
              options={intervalOptions}
            />
          </FilterBar>
        }
        columns={columns}
        renderCard={(s) => {
          const n = nextDeliveryText(s);
          return (
            <CardRow
              primary={
                <span className="flex items-center gap-2.5">
                  <CanThumb src={s.imageUrl ?? null} />
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {s.customerName || s.customerEmail || "Kunde"}
                    </span>
                    <span className="text-admin-text-2 text-[13px] font-normal">
                      {s.number} · {s.productTitle} · {s.variantTitle}
                    </span>
                  </span>
                </span>
              }
              aside={showMoney ? formatMoney(s.totalPerDeliveryCents) : undefined}
              badges={
                <span className="flex flex-wrap items-center gap-2">
                  <StatusCell s={s} />
                  <span className="text-admin-text-2 text-[13px]">
                    {intervalText(s.intervalWeeks)} · {n.text}
                  </span>
                </span>
              }
            />
          );
        }}
        empty={
          <EmptyState
            icon="kalender"
            title={filtered ? "Keine Abos für diese Filter" : "Noch keine Abos"}
          >
            {filtered
              ? "Ändere die Suche oder setze die Filter zurück."
              : "Sobald jemand im Shop ein Abo abschließt, erscheint es hier."}
          </EmptyState>
        }
        footer={
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.total}
            hrefFor={(p) => withParams(PATH, sp, { seite: p > 1 ? p : null })}
          />
        }
      />
    </>
  );
}

function StatusCell({ s }: { s: AdminSubscriptionListItem }) {
  const badge = STATUS_BADGE[s.status];
  const scheduled = s.status !== "cancelled" && s.cancelEffectiveAt;
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={badge.tone}>{badge.label}</Badge>
      {scheduled ? (
        <Badge tone="red" hollow>
          Kündigung vorgemerkt
        </Badge>
      ) : null}
    </span>
  );
}
