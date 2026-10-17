import type { Metadata } from "next";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { bulkMarkPaidAction } from "@/lib/admin/orders/actions";
import { PAYMENT_METHOD_FILTERS } from "@/lib/admin/orders/filters";
import { countOrders, listOrders, type OrderListResult } from "@/lib/admin/orders/read";
import {
  filterFromParams,
  ORDER_TABS,
  PERIODS,
  sortFrom,
  tabFrom,
  type ListParams,
} from "@/lib/admin/orders/url";
import { DerivedBadge } from "@/components/admin/orders/OrderBadges";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { buttonClasses, ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate, formatMoney } from "@/components/admin/ui/format";
import { firstParam, withParams } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";

export const metadata: Metadata = { title: "Bestellungen" };

const PATH = "/admin/bestellungen";
const PAGE_SIZE = 25;
const FORM_ID = "bestellungen-sammel";

const dateInput =
  "rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-3 text-[14px] md:h-10";

/**
 * /admin/bestellungen (Figma 35:4502: Desktop 35:4503, Mehrfachauswahl 35:4987, Leer 35:5554,
 * mobil 35:10543). Tabs nach Status plus "Test", Suche, Zeitraum, Zahlart, Sortierung, Badges aus
 * deriveOrderBadges (H16), Sammelaktionen. Testbestellungen sind außerhalb des Tabs "Test"
 * ausgeblendet. Fulfillment sieht keine Beträge und keinen Export (Kundendaten).
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  const session = await requireStaff("support", { next: PATH });
  const sp = await searchParams;
  const tab = tabFrom(sp);
  const showMoney = PERMISSIONS.viewCustomers(session);
  const canExport = PERMISSIONS.viewCustomers(session);
  const canMarkPaid = hasRole(session, "admin");
  const canCreate = hasRole(session, "admin");
  const filter = filterFromParams(sp, { pageSize: PAGE_SIZE, ignoreSelection: true });
  const sort = sortFrom(sp);
  const period = firstParam(sp.zeitraum);

  let result: OrderListResult | null = null;
  let counts: OrderListResult["counts"] | null = null;
  let testCount = 0;
  let failed = false;
  try {
    const base = filterFromParams({ ...sp, tab: undefined }, { ignoreSelection: true });
    [result, testCount] = await Promise.all([
      listOrders(filter),
      countOrders({ ...base, status: undefined, test: "only" }),
    ]);
    counts = tab === "test" ? (await listOrders({ ...base, pageSize: 1 })).counts : result.counts;
  } catch (error) {
    console.error("[admin] Bestellliste", error);
    failed = true;
  }

  const rows = result?.rows ?? [];
  const filtered = Boolean(firstParam(sp.q) || period || firstParam(sp.zahlart));
  const tabHref = (key: string) =>
    withParams(PATH, sp, { tab: key === "alle" ? null : key, seite: null });
  const tabCount = (key: (typeof ORDER_TABS)[number]) =>
    key.key === "test" ? testCount : key.status ? (counts?.[key.status] ?? 0) : (counts?.all ?? 0);
  const exportHref = withParams(`${PATH}/export`, sp, { seite: null });

  return (
    <>
      <PageHeader
        title="Bestellungen"
        actions={
          canCreate ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Manuelle Bestellung
            </ButtonLink>
          ) : null
        }
      />
      {failed ? (
        <FormMessage tone="error">
          Die Bestellungen konnten gerade nicht geladen werden.
        </FormMessage>
      ) : null}

      <form id={FORM_ID} method="get" action={`${PATH}/export`} className="hidden" />

      <Table
        caption="Bestellungen"
        rows={rows}
        rowKey={(o) => o.id}
        rowHref={(o) => `${PATH}/${o.id}`}
        selection={{
          formId: FORM_ID,
          value: (o) => o.id,
          label: (o) => `Bestellung ${o.orderNumber} auswählen`,
        }}
        sort={{ key: sort.key, dir: sort.dir }}
        sortHref={(key, dir) => withParams(PATH, sp, { sort: key, dir, seite: null })}
        toolbar={
          <>
            <div className="border-admin-rahmen border-b px-3 pt-3 pb-3">
              <Tabs
                label="Status"
                variant="chip"
                items={ORDER_TABS.map((t) => ({
                  label: t.label,
                  href: tabHref(t.key),
                  active: tab === t.key,
                  count: tabCount(t),
                }))}
              />
            </div>
            <FilterBar
              action={PATH}
              search={{
                value: firstParam(sp.q),
                placeholder: showMoney
                  ? "Nummer, Kunde oder E-Mail suchen"
                  : "Nummer oder Name suchen",
                label: "Bestellungen suchen",
              }}
              hidden={{
                tab: tab === "alle" ? undefined : tab,
                sort: firstParam(sp.sort),
                dir: firstParam(sp.dir),
              }}
              resetHref={
                filtered ? withParams(PATH, {}, { tab: tab === "alle" ? null : tab }) : undefined
              }
            >
              <Select
                name="zeitraum"
                label="Zeitraum"
                hideLabel
                placeholder="Zeitraum: Alle"
                defaultValue={period ?? ""}
                options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
              />
              {period === "eigener" ? (
                <>
                  <label className="flex flex-col">
                    <span className="sr-only">Von</span>
                    <input
                      type="date"
                      name="von"
                      aria-label="Von"
                      defaultValue={firstParam(sp.von)}
                      className={dateInput}
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="sr-only">Bis</span>
                    <input
                      type="date"
                      name="bis"
                      aria-label="Bis"
                      defaultValue={firstParam(sp.bis)}
                      className={dateInput}
                    />
                  </label>
                </>
              ) : null}
              <Select
                name="zahlart"
                label="Zahlart"
                hideLabel
                placeholder="Zahlart: Alle"
                defaultValue={firstParam(sp.zahlart) ?? ""}
                options={Object.entries(PAYMENT_METHOD_FILTERS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              {canExport ? (
                <a href={exportHref} className={buttonClasses("secondary", "md")} download>
                  <Icon name="download" size={16} />
                  Exportieren
                </a>
              ) : null}
            </FilterBar>
            {rows.length > 0 ? (
              <div className="border-admin-rahmen bg-admin-flaeche flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
                <span className="text-admin-text-2 mr-auto text-[13px]">
                  Auswahl: Haken setzen, dann Aktion wählen
                </span>
                {canExport ? (
                  <button
                    type="submit"
                    form={FORM_ID}
                    formAction={`${PATH}/export`}
                    formMethod="get"
                    className={buttonClasses("secondary", "sm")}
                  >
                    <Icon name="download" size={16} />
                    CSV der Auswahl
                  </button>
                ) : null}
                <button
                  type="submit"
                  form={FORM_ID}
                  formAction={`${PATH}/lieferscheine`}
                  formMethod="get"
                  formTarget="_blank"
                  className={buttonClasses("secondary", "sm")}
                >
                  <Icon name="pdf" size={16} />
                  Lieferscheine drucken
                </button>
                {canMarkPaid ? (
                  <button
                    type="submit"
                    form={FORM_ID}
                    formAction={bulkMarkPaidAction}
                    className={buttonClasses("secondary", "sm")}
                  >
                    <Icon name="haken" size={16} />
                    Als bezahlt markieren
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        }
        empty={
          <EmptyState
            icon="bestellungen"
            title={
              filtered || tab !== "alle"
                ? "Keine Bestellungen für diese Filter"
                : "Noch keine Bestellungen"
            }
            action={
              filtered ? (
                <ButtonLink href={tabHref(tab)}>Filter zurücksetzen</ButtonLink>
              ) : canCreate && tab === "alle" ? (
                <ButtonLink href={`${PATH}/neu`} icon="plus">
                  Manuelle Bestellung anlegen
                </ButtonLink>
              ) : undefined
            }
          >
            {filtered
              ? "Ändere die Suche oder den Zeitraum."
              : tab === "test"
                ? "Testbestellungen (is_test) erscheinen nur hier, nicht in den übrigen Tabs."
                : "Sobald im Shop bestellt wird oder du eine manuelle Bestellung anlegst, erscheint sie hier."}
          </EmptyState>
        }
        columns={[
          {
            key: "nummer",
            header: "Nummer",
            width: "150px",
            sortable: true,
            cell: (o) => (
              <span className="flex items-center gap-1.5 font-bold whitespace-nowrap">
                {o.orderNumber}
                {o.isTest ? (
                  <Badge tone="gray" noDot>
                    Test
                  </Badge>
                ) : null}
              </span>
            ),
          },
          {
            key: "datum",
            header: "Datum",
            width: "110px",
            sortable: true,
            cell: (o) => <span className="text-admin-text-2">{formatDate(o.placedAt)}</span>,
          },
          { key: "kunde", header: "Kunde", cell: (o) => o.customerName },
          {
            key: "positionen",
            header: "Positionen",
            width: "100px",
            align: "right",
            hideBelowLg: true,
            cell: (o) => o.lineCount,
          },
          ...(showMoney
            ? [
                {
                  key: "gesamt",
                  header: "Gesamt",
                  width: "110px",
                  align: "right" as const,
                  sortable: true,
                  cell: (o: (typeof rows)[number]) => (
                    <span className="font-bold tabular-nums">{formatMoney(o.totalCents)}</span>
                  ),
                },
              ]
            : []),
          {
            key: "zahlung",
            header: "Zahlstatus",
            width: "150px",
            cell: (o) => <DerivedBadge badge={o.badges.payment} />,
          },
          {
            key: "versand",
            header: "Versandstatus",
            width: "150px",
            cell: (o) => <DerivedBadge badge={o.badges.fulfilment} />,
          },
        ]}
        renderCard={(o) => (
          <CardRow
            primary={
              <span className="flex items-center gap-1.5">
                {o.orderNumber}
                {o.isTest ? (
                  <Badge tone="gray" noDot>
                    Test
                  </Badge>
                ) : null}
              </span>
            }
            aside={showMoney ? formatMoney(o.totalCents) : undefined}
            secondary={`${o.customerName} · ${o.lineCount} ${o.lineCount === 1 ? "Position" : "Positionen"}`}
            secondaryAside={formatDate(o.placedAt)}
            badges={
              <>
                <DerivedBadge badge={o.badges.payment} />
                <DerivedBadge badge={o.badges.fulfilment} />
              </>
            }
          />
        )}
        footer={
          <Pagination
            page={result?.page ?? 1}
            pageSize={PAGE_SIZE}
            total={result?.total ?? 0}
            hrefFor={(p) => withParams(PATH, sp, { seite: p > 1 ? p : null })}
          />
        }
      />
    </>
  );
}
