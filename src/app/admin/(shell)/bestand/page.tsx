import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  getInventoryOverview,
  getMovements,
  type InventoryOverview,
  type InventoryRow,
  type MovementView,
} from "@/lib/admin/inventory/data";
import { listActiveReservations, type ReservationView } from "@/lib/admin/inventory/reservations";
import { STOCK_STATUS_LABELS, type StockStatus } from "@/lib/admin/inventory/rules";
import {
  AdjustStockDialog,
  AdjustStockForm,
  ThresholdForm,
  TrackingForm,
} from "@/components/admin/inventory/StockForms";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDateTime, formatNumber } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Stat } from "@/components/admin/ui/Stat";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Bestand" };

const PATH = "/admin/bestand";

const STATUS_TONE: Record<StockStatus, { tone: BadgeTone; hollow?: boolean }> = {
  ok: { tone: "green" },
  low: { tone: "yellow" },
  out: { tone: "red" },
  untracked: { tone: "gray", hollow: true },
  backorder: { tone: "blue" },
  bundle: { tone: "gray", hollow: true },
  pack: { tone: "gray", hollow: true },
};

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "low", label: "Unter Schwelle" },
  { key: "out", label: "Ausverkauft" },
  { key: "tracked", label: "Geführt" },
  { key: "untracked", label: "Nicht geführt" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function StatusBadgeFor({ status }: { status: StockStatus }) {
  const t = STATUS_TONE[status];
  return (
    <Badge tone={t.tone} hollow={t.hollow}>
      {STOCK_STATUS_LABELS[status]}
    </Badge>
  );
}

function available(row: InventoryRow) {
  return row.available === null ? "unbegrenzt" : formatNumber(row.available);
}

/** Lagereinheit Dose: Einzeldose, die in Packs oder Bundles steckt (H24, ADR-018). */
function isCan(row: InventoryRow) {
  return row.stockRole === "unit" && row.usedInDerived;
}

function unitTitle(row: InventoryRow) {
  return isCan(row) ? "Dose" : row.variantTitle;
}

function unitHint(row: InventoryRow) {
  return isCan(row) ? "Einzelne Dosen, zum Beispiel +240 für zehn 24er-Kartons" : undefined;
}

function delta(n: number) {
  return `${n > 0 ? "+" : ""}${formatNumber(n)}`;
}

/**
 * /admin/bestand: Lagereinheiten (Einzeldose je Sorte, Merch) mit Bestand, verfügbar, reserviert
 * und Warnschwelle; darunter Packs und Bundles als abgeleitete Zeilen mit berechneter
 * Verfügbarkeit (Lagereinheit Dose, H24, ADR-018). Buchung mit Grund, Historie und Einstellungen
 * im Drawer (?variante=), Filter "Unter Schwelle", aktive Reservierungen mit Ablauf. Buchen:
 * Owner, Admin, Fulfillment. Warnschwelle und Bestandsführung: Owner und Admin.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canAdjust = PERMISSIONS.fulfil(session);
  const canEdit = PERMISSIONS.editProducts(session);
  const sp = await searchParams;
  const status = (FILTERS.find((f) => f.key === firstParam(sp.status))?.key ?? "all") as FilterKey;
  const q = firstParam(sp.q)?.trim();
  const derivedOn = firstParam(sp.abgeleitet) !== "nein";
  const variantId = firstParam(sp.variante);

  let overview: InventoryOverview = {
    rows: [],
    derived: [],
    counts: { total: 0, low: 0, out: 0, untracked: 0, derived: 0 },
  };
  let reservations: ReservationView[] = [];
  let failed = false;
  try {
    [overview, reservations] = await Promise.all([
      getInventoryOverview({ q, status, includeDerived: derivedOn }),
      listActiveReservations({ limit: 100 }),
    ]);
  } catch (error) {
    console.error("[admin] Bestand", error);
    failed = true;
  }

  const selected = variantId
    ? [...overview.rows, ...overview.derived].find((r) => r.variantId === variantId)
    : undefined;
  const unitById = new Map(overview.rows.map((r) => [r.variantId, r]));
  let movements: MovementView[] = [];
  if (selected) {
    movements = await getMovements(selected.variantId, { limit: 50 }).catch(() => []);
  }
  const selectedReservations = selected
    ? reservations.filter((r) => r.variantId === selected.variantId)
    : [];
  const reservedTotal = reservations.reduce((s, r) => s + r.quantity, 0);
  const filtered = Boolean(q || status !== "all" || !derivedOn);

  return (
    <>
      <PageHeader
        title="Bestand"
        description="Bestand in Dosen je Sorte und Merch, Buchungen mit Grund, Historie und Warnschwellen. Packs und Bundles rechnen sich aus den Dosen."
      />
      {failed ? (
        <FormMessage tone="error">Der Bestand konnte gerade nicht geladen werden.</FormMessage>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lagereinheiten" value={formatNumber(overview.counts.total)} />
        <Stat label="Unter Schwelle" value={formatNumber(overview.counts.low)} />
        <Stat label="Ausverkauft" value={formatNumber(overview.counts.out)} />
        <Stat
          label="Reserviert"
          value={formatNumber(reservedTotal)}
          hint={`${reservations.length} aktive Reservierungen, in Dosen und Stück`}
        />
      </div>

      <h2 className="mb-2 text-[16px] font-semibold">Lagereinheiten</h2>
      <Table
        caption="Bestand je Lagereinheit"
        rows={overview.rows}
        rowKey={(r) => r.variantId}
        rowHref={(r) => withParams(PATH, sp, { variante: r.variantId })}
        toolbar={
          <FilterBar
            action={PATH}
            chips={FILTERS.map((f) => ({
              label: f.label,
              href: withParams(PATH, sp, {
                status: f.key === "all" ? null : f.key,
                variante: null,
              }),
              active: status === f.key,
              count:
                f.key === "low"
                  ? overview.counts.low
                  : f.key === "out"
                    ? overview.counts.out
                    : f.key === "untracked"
                      ? overview.counts.untracked
                      : undefined,
            }))}
            search={{
              value: q,
              placeholder: "Sorte, Pack oder SKU suchen",
              label: "Bestand suchen",
            }}
            hidden={{ status: status === "all" ? undefined : status }}
            resetHref={filtered ? PATH : undefined}
          >
            <Select
              name="abgeleitet"
              label="Packs und Bundles"
              hideLabel
              defaultValue={derivedOn ? "" : "nein"}
              options={[
                { value: "", label: "Mit Packs und Bundles" },
                { value: "nein", label: "Nur Lagereinheiten" },
              ]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="bestand"
            title={filtered ? "Keine Lagereinheiten für diese Filter" : "Keine Lagereinheiten"}
          >
            {filtered ? "Ändere die Filter oder setze sie zurück." : "Lege zuerst Produkte an."}
          </EmptyState>
        }
        columns={[
          {
            key: "sorte",
            header: "Sorte",
            cell: (r) => (
              <span className="flex flex-col">
                <span>{r.productTitle}</span>
                {isCan(r) || !r.variantActive ? (
                  <span className="text-admin-text-2 text-[12px] font-normal">
                    {isCan(r) ? "Lagereinheit für Packs und Bundles" : "inaktive Variante"}
                  </span>
                ) : null}
              </span>
            ),
          },
          { key: "einheit", header: "Einheit", width: "120px", cell: (r) => unitTitle(r) },
          {
            key: "sku",
            header: "SKU",
            width: "130px",
            hideBelowLg: true,
            cell: (r) => <span className="font-mono text-[13px]">{r.sku ?? "–"}</span>,
          },
          {
            key: "verfuegbar",
            header: "Verfügbar",
            width: "100px",
            align: "right",
            cell: (r) => <span className="font-semibold tabular-nums">{available(r)}</span>,
          },
          {
            key: "bestand",
            header: "Bestand",
            width: "90px",
            align: "right",
            hideBelowLg: true,
            cell: (r) => <span className="tabular-nums">{formatNumber(r.onHand)}</span>,
          },
          {
            key: "reserviert",
            header: "Reserviert",
            width: "100px",
            align: "right",
            cell: (r) => <span className="tabular-nums">{formatNumber(r.reserved)}</span>,
          },
          {
            key: "schwelle",
            header: "Warnschwelle",
            width: "120px",
            align: "right",
            cell: (r) => <span className="tabular-nums">{formatNumber(r.lowStockThreshold)}</span>,
          },
          {
            key: "status",
            header: "Status",
            width: "140px",
            cell: (r) => <StatusBadgeFor status={r.status} />,
          },
        ]}
        rowActions={
          canAdjust
            ? (r) => (
                <AdjustStockDialog
                  variantId={r.variantId}
                  label={`${r.productTitle} · ${unitTitle(r)}`}
                  unitHint={unitHint(r)}
                />
              )
            : undefined
        }
        renderCard={(r) => (
          <CardRow
            primary={r.productTitle}
            aside={available(r)}
            secondary={`${unitTitle(r)}${r.sku ? ` · ${r.sku}` : ""}`}
            secondaryAside={`reserviert ${formatNumber(r.reserved)} · Schwelle ${formatNumber(r.lowStockThreshold)}`}
            badges={<StatusBadgeFor status={r.status} />}
          />
        )}
      />

      {derivedOn ? (
        <>
          <h2 className="mt-6 mb-1 text-[16px] font-semibold">Packs und Bundles</h2>
          <p className="text-admin-text-2 mb-2 text-[13px]">
            Kein eigener Bestand. Verfügbar ist, was die enthaltenen Dosen und Merch-Artikel
            hergeben (kleinster Wert über alle Bestandteile). Gebucht wird oben bei den
            Lagereinheiten.
          </p>
          <Table
            caption="Packs und Bundles, Verfügbarkeit aus den Lagereinheiten"
            rows={overview.derived}
            rowKey={(r) => r.variantId}
            rowHref={(r) => withParams(PATH, sp, { variante: r.variantId })}
            empty={
              <EmptyState
                compact
                icon="bestand"
                title="Keine Packs oder Bundles für diese Filter"
              />
            }
            columns={[
              {
                key: "produkt",
                header: "Produkt",
                cell: (r) => (
                  <span className="flex flex-col">
                    <span>{r.productTitle}</span>
                    <span className="text-admin-text-2 text-[12px] font-normal">
                      {r.stockRole === "bundle" ? "Bundle" : "Pack"}
                      {r.variantActive ? "" : ", inaktive Variante"}
                    </span>
                  </span>
                ),
              },
              { key: "pack", header: "Variante", width: "120px", cell: (r) => r.variantTitle },
              {
                key: "aus",
                header: "Besteht aus",
                hideBelowLg: true,
                cell: (r) => (
                  <span className="text-admin-text-2 text-[13px]">{r.componentsText || "–"}</span>
                ),
              },
              {
                key: "verfuegbar",
                header: "Verfügbar",
                width: "100px",
                align: "right",
                cell: (r) => <span className="font-semibold tabular-nums">{available(r)}</span>,
              },
              {
                key: "status",
                header: "Status",
                width: "140px",
                cell: (r) => <StatusBadgeFor status={r.status} />,
              },
            ]}
            renderCard={(r) => (
              <CardRow
                primary={r.productTitle}
                aside={available(r)}
                secondary={`${r.variantTitle}${r.sku ? ` · ${r.sku}` : ""}`}
                secondaryAside={r.componentsText}
                badges={<StatusBadgeFor status={r.status} />}
              />
            )}
          />
        </>
      ) : null}

      <Card
        className="mt-4"
        title="Reservierungen"
        description="Checkout und manuelle Bestellungen halten Bestand bis zur Buchung oder zum Ablauf fest."
        flush
      >
        {reservations.length === 0 ? (
          <EmptyState compact icon="bestand" title="Keine aktiven Reservierungen" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[14px]">
              <caption className="sr-only">Aktive Reservierungen</caption>
              <thead>
                <tr className="bg-admin-flaeche text-admin-text-2 h-10 text-left text-[13px]">
                  <th scope="col" className="px-4 font-medium">
                    Variante
                  </th>
                  <th scope="col" className="px-4 text-right font-medium">
                    Menge
                  </th>
                  <th scope="col" className="px-4 font-medium">
                    Über Pack oder Bundle
                  </th>
                  <th scope="col" className="px-4 font-medium">
                    Läuft ab
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-admin-rahmen h-11 border-t">
                    <td className="px-4">
                      {r.productTitle} · {r.variantTitle}
                      {r.sku ? (
                        <span className="text-admin-text-2 font-mono text-[12px]"> {r.sku}</span>
                      ) : null}
                    </td>
                    <td className="px-4 text-right tabular-nums">{formatNumber(r.quantity)}</td>
                    <td className="text-admin-text-2 px-4">{r.bundleTitle ?? "–"}</td>
                    <td className="px-4">
                      {formatDateTime(r.expiresAt)}{" "}
                      {r.expired ? (
                        <Badge tone="yellow" hollow>
                          abgelaufen, wird freigegeben
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={Boolean(selected)}
        closeHref={withParams(PATH, sp, { variante: null })}
        title={selected ? `${selected.productTitle} · ${unitTitle(selected)}` : "Variante"}
        description={selected?.sku ? `SKU ${selected.sku}` : undefined}
        width="lg"
      >
        {selected ? (
          <div className="flex flex-col gap-5 p-5">
            <dl className="grid grid-cols-2 gap-3 text-[14px] md:grid-cols-4">
              <div>
                <dt className="text-admin-text-2 text-[13px]">Verfügbar</dt>
                <dd className="text-[20px] font-semibold tabular-nums">{available(selected)}</dd>
              </div>
              {selected.stockRole === "unit" ? (
                <>
                  <div>
                    <dt className="text-admin-text-2 text-[13px]">Bestand</dt>
                    <dd className="text-[20px] font-semibold tabular-nums">
                      {formatNumber(selected.onHand)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-admin-text-2 text-[13px]">Reserviert</dt>
                    <dd className="text-[20px] font-semibold tabular-nums">
                      {formatNumber(selected.reserved)}
                    </dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt className="text-admin-text-2 text-[13px]">Status</dt>
                <dd className="mt-1">
                  <StatusBadgeFor status={selected.status} />
                </dd>
              </div>
            </dl>

            {selected.stockRole !== "unit" ? (
              <section className="flex flex-col gap-2">
                <FormMessage tone="info" className="mb-0">
                  {selected.stockRole === "bundle" ? "Bundles" : "Packs"} haben keinen eigenen
                  Bestand. Die Verfügbarkeit ergibt sich aus den Lagereinheiten; buche dort.
                </FormMessage>
                {selected.components.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-[14px]">
                    {selected.components.map((c) => {
                      const unit = unitById.get(c.variantId);
                      return (
                        <li key={c.variantId} className="flex items-baseline justify-between gap-3">
                          <a
                            href={withParams(PATH, sp, { variante: c.variantId })}
                            className="text-admin-akzent hover:underline"
                          >
                            {formatNumber(c.quantity)} × {c.productTitle}
                            {unit && isCan(unit) ? ", Dose" : ` · ${c.variantTitle}`}
                          </a>
                          <span className="text-admin-text-2 text-[13px] tabular-nums">
                            {unit ? `verfügbar ${available(unit)}` : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            ) : (
              <>
                {canAdjust ? (
                  <section>
                    <h3 className="mb-2 text-[15px] font-semibold">
                      {isCan(selected) ? "Dosen buchen" : "Bestand buchen"}
                    </h3>
                    <AdjustStockForm variantId={selected.variantId} unitHint={unitHint(selected)} />
                  </section>
                ) : null}
                {canEdit ? (
                  <section className="border-admin-rahmen flex flex-col gap-4 border-t pt-4">
                    <h3 className="text-[15px] font-semibold">Einstellungen</h3>
                    <ThresholdForm
                      variantId={selected.variantId}
                      value={selected.lowStockThreshold}
                      unitHint={isCan(selected) ? "in Dosen" : undefined}
                    />
                    <TrackingForm
                      variantId={selected.variantId}
                      trackInventory={selected.trackInventory}
                      allowBackorder={selected.allowBackorder}
                    />
                  </section>
                ) : (
                  <p className="text-admin-text-2 text-[13px]">
                    Warnschwelle {formatNumber(selected.lowStockThreshold)}. Ändern dürfen Owner und
                    Admin.
                  </p>
                )}
              </>
            )}

            {selectedReservations.length > 0 ? (
              <section className="border-admin-rahmen border-t pt-4">
                <h3 className="mb-2 text-[15px] font-semibold">Reservierungen</h3>
                <ul className="flex flex-col gap-1 text-[14px]">
                  {selectedReservations.map((r) => (
                    <li key={r.id}>
                      {formatNumber(r.quantity)} reserviert bis {formatDateTime(r.expiresAt)}
                      {r.bundleTitle ? (
                        <span className="text-admin-text-2"> (über {r.bundleTitle})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="border-admin-rahmen border-t pt-4">
              <h3 className="mb-2 text-[15px] font-semibold">Historie</h3>
              {movements.length === 0 ? (
                <p className="text-admin-text-2 text-[14px]">Noch keine Buchungen.</p>
              ) : (
                <ol className="flex flex-col">
                  {movements.map((m) => (
                    <li
                      key={m.id}
                      className="border-admin-rahmen flex items-start gap-3 border-b py-2.5 last:border-b-0"
                    >
                      <span
                        className={`w-14 shrink-0 text-right font-semibold tabular-nums ${m.delta < 0 ? "text-admin-rot" : "text-admin-gruen"}`}
                      >
                        {delta(m.delta)}
                      </span>
                      <div className="min-w-0 flex-1 text-[14px]">
                        <p className="font-medium">
                          {m.reasonLabel}
                          {m.orderNumber && m.referenceId ? (
                            <>
                              {" "}
                              <a
                                href={`/admin/bestellungen/${m.referenceId}`}
                                className="text-admin-akzent hover:underline"
                              >
                                {m.orderNumber}
                              </a>
                            </>
                          ) : null}
                        </p>
                        {m.note ? <p className="text-admin-text-2 text-[13px]">{m.note}</p> : null}
                        <p className="text-admin-text-2 text-[12px]">
                          {formatDateTime(m.createdAt)} · {m.actorName ?? m.actorEmail ?? "System"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
