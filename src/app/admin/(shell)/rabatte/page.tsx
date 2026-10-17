import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listDiscounts, type DiscountListItem } from "@/lib/admin/discounts/data";
import {
  DISCOUNT_KINDS,
  DISCOUNT_STATUS_LABELS,
  type DiscountStatus,
} from "@/lib/admin/discounts/rules";
import { DISCOUNT_STATUS_TONES } from "@/components/admin/catalog/DiscountEditor";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Rabatte" };

const PATH = "/admin/rabatte";
const PAGE_SIZE = 50;
const KIND_LABEL = new Map<string, string>(DISCOUNT_KINDS.map((k) => [k.value, k.label]));
const STATUSES: DiscountStatus[] = ["active", "scheduled", "expired", "exhausted", "inactive"];

function validity(d: DiscountListItem): string {
  if (!d.startsAt && !d.endsAt) return "unbegrenzt";
  if (d.startsAt && d.endsAt) return `${formatDate(d.startsAt)} bis ${formatDate(d.endsAt)}`;
  if (d.startsAt) return `ab ${formatDate(d.startsAt)}`;
  return `bis ${formatDate(d.endsAt)}`;
}

function usage(d: DiscountListItem): string {
  return d.usageLimit != null ? `${d.usageCount} von ${d.usageLimit}` : String(d.usageCount);
}

function StatusPill({ s }: { s: DiscountStatus }) {
  return (
    <Badge tone={DISCOUNT_STATUS_TONES[s]} hollow={s === "inactive" || s === "scheduled"}>
      {DISCOUNT_STATUS_LABELS[s]}
    </Badge>
  );
}

export default async function DiscountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editProducts(session);
  const sp = await searchParams;
  const statusRaw = firstParam(sp.status);
  const status = STATUSES.includes(statusRaw as DiscountStatus)
    ? (statusRaw as DiscountStatus)
    : undefined;
  const q = firstParam(sp.q)?.trim();
  const page = parsePage(sp.seite);

  let all: DiscountListItem[] = [];
  let failed = false;
  try {
    all = await listDiscounts({ q });
  } catch (error) {
    console.error("[admin] Rabatte", error);
    failed = true;
  }
  const rows = status ? all.filter((d) => d.status === status) : all;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chip = (value: DiscountStatus | null, label: string) => ({
    label,
    count: value ? all.filter((d) => d.status === value).length : all.length,
    href: withParams(PATH, sp, { status: value, seite: null }),
    active: (status ?? null) === value,
  });

  return (
    <>
      <PageHeader
        title="Rabatte"
        description="Rabattcodes mit Laufzeit, Limits und Geltungsbereich. Geprüft wird an der Kasse mit denselben Regeln."
        actions={
          canEdit ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Rabatt anlegen
            </ButtonLink>
          ) : null
        }
      />
      {failed ? (
        <FormMessage tone="error">Die Rabatte konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Rabattcodes"
        rows={pageRows}
        rowKey={(d) => d.id}
        rowHref={(d) => `${PATH}/${d.id}`}
        toolbar={
          <FilterBar
            action={PATH}
            search={{
              value: q,
              placeholder: "Code oder Bezeichnung suchen",
              label: "Rabatte suchen",
            }}
            chips={[
              chip(null, "Alle"),
              chip("active", "Aktiv"),
              chip("scheduled", "Geplant"),
              chip("expired", "Abgelaufen"),
              chip("exhausted", "Aufgebraucht"),
              chip("inactive", "Deaktiviert"),
            ]}
            hidden={{ status }}
            resetHref={status || q ? PATH : undefined}
          />
        }
        columns={[
          {
            key: "code",
            header: "Code",
            cell: (d) => (
              <span className="min-w-0">
                <span className="block font-mono text-[14px] tracking-wide">{d.code}</span>
                {d.title ? (
                  <span className="text-admin-text-2 block text-[13px] font-normal">{d.title}</span>
                ) : null}
              </span>
            ),
          },
          {
            key: "art",
            header: "Art",
            width: "150px",
            cell: (d) => (
              <span className="text-admin-text-2">{KIND_LABEL.get(d.kind) ?? d.kind}</span>
            ),
          },
          { key: "wert", header: "Wert", width: "170px", cell: (d) => d.summary },
          {
            key: "gueltig",
            header: "Gültigkeit",
            width: "190px",
            hideBelowLg: true,
            cell: (d) => <span className="text-admin-text-2">{validity(d)}</span>,
          },
          {
            key: "nutzung",
            header: "Nutzung",
            width: "100px",
            align: "right",
            cell: (d) => <span className="tabular-nums">{usage(d)}</span>,
          },
          {
            key: "status",
            header: "Status",
            width: "140px",
            cell: (d) => <StatusPill s={d.status} />,
          },
        ]}
        renderCard={(d) => (
          <CardRow
            primary={<span className="font-mono">{d.code}</span>}
            aside={<StatusPill s={d.status} />}
            secondary={d.summary}
            secondaryAside={`${usage(d)} genutzt`}
            badges={<span className="text-admin-text-2 text-[13px]">{validity(d)}</span>}
          />
        )}
        empty={
          <EmptyState
            icon="rabatte"
            title={status || q ? "Keine Rabatte für diese Filter" : "Noch keine Rabattcodes"}
            action={
              canEdit && !status && !q ? (
                <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
                  Rabatt anlegen
                </ButtonLink>
              ) : undefined
            }
          >
            {status || q
              ? "Ändere die Suche oder den Statusfilter."
              : "Lege einen Code an, zum Beispiel für eine Aktion."}
          </EmptyState>
        }
        footer={
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={rows.length}
            hrefFor={(n) => withParams(PATH, sp, { seite: n > 1 ? n : null })}
          />
        }
      />
    </>
  );
}
