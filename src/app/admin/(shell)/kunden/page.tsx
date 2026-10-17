import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  listCustomerTags,
  listCustomers,
  type CustomerListItem,
} from "@/lib/admin/customers/queries";
import { NEWSLETTER_STATUS_LABEL } from "@/lib/admin/customers/profile";
import { listSegments, type SegmentSummary } from "@/lib/admin/segments/segments";
import { NEWSLETTER_SEGMENT_STATUSES } from "@/lib/admin/segments/rules";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate, formatMoney, formatNumber } from "@/components/admin/ui/format";
import { withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { NewsletterBadge, TagChip } from "@/components/admin/crm/badges";
import { customerFilterFromParams } from "./filters";

export const metadata: Metadata = { title: "Kunden" };

const PATH = "/admin/kunden";
const PAGE_SIZE = 50;

/** /admin/kunden (Figma 28:1379, mobil 27:4954): Liste mit Suche, Filtern und CSV-Export. */
export default async function KundenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const sp = await searchParams;
  const page = parsePage(sp.seite);
  const { filter, sortKey, active } = customerFilterFromParams(sp);

  let result: { items: CustomerListItem[]; total: number } = { items: [], total: 0 };
  let segments: SegmentSummary[] = [];
  let tags: string[] = [];
  let failed = false;
  try {
    [result, segments, tags] = await Promise.all([
      listCustomers({ ...filter, page, pageSize: PAGE_SIZE }),
      listSegments(),
      listCustomerTags(),
    ]);
  } catch (error) {
    console.error("[admin] Kundenliste", error);
    failed = true;
  }
  const segmentName = segments.find((s) => s.id === filter.segmentId)?.name;
  const exportHref = withParams(`${PATH}/export`, sp, { seite: null });
  const sortDir = sortKey === "name" ? "asc" : "desc";

  return (
    <>
      <PageHeader
        title="Kunden"
        description={`${formatNumber(result.total)} ${result.total === 1 ? "Kunde" : "Kunden"} im Segment „${segmentName ?? "Alle Kunden"}“${active && !segmentName ? " mit Filter" : ""}`}
        actions={
          <ButtonLink href={exportHref} icon="download" prefetch={false}>
            Exportieren
          </ButtonLink>
        }
      />
      {failed ? (
        <FormMessage tone="error">Die Kunden konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Kunden"
        rows={result.items}
        rowKey={(c) => c.id}
        rowHref={(c) => `${PATH}/${c.id}`}
        sort={{ key: sortKey, dir: sortDir }}
        sortHref={(key) =>
          withParams(PATH, sp, { sort: key === "letzte" ? null : key, seite: null })
        }
        toolbar={
          <FilterBar
            action={PATH}
            search={{
              value: filter.q,
              placeholder: "Name oder E-Mail suchen",
              label: "Kunden suchen",
            }}
            hidden={{ sort: sortKey === "letzte" ? undefined : sortKey }}
            resetHref={active ? PATH : undefined}
          >
            <Select
              name="segment"
              label="Segment"
              hideLabel
              placeholder="Segment: Alle Kunden"
              defaultValue={filter.segmentId ?? ""}
              options={segments.map((s) => ({ value: s.id, label: `Segment: ${s.name}` }))}
            />
            <Select
              name="newsletter"
              label="Newsletter-Status"
              hideLabel
              placeholder="Newsletter-Status"
              defaultValue={filter.newsletter ?? ""}
              options={NEWSLETTER_SEGMENT_STATUSES.map((s) => ({
                value: s,
                label: NEWSLETTER_STATUS_LABEL[s],
              }))}
            />
            <Select
              name="tag"
              label="Tag"
              hideLabel
              placeholder="Tags"
              defaultValue={filter.tag ?? ""}
              options={tags.map((t) => ({ value: t, label: t }))}
            />
            <Select
              name="gesperrt"
              label="Sperrstatus"
              hideLabel
              placeholder="Gesperrt und aktiv"
              defaultValue={filter.blocked === true ? "ja" : filter.blocked === false ? "nein" : ""}
              options={[
                { value: "nein", label: "Nur nicht gesperrte" },
                { value: "ja", label: "Nur gesperrte" },
              ]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="kunden"
            title={active ? "Keine Kunden für diese Filter" : "Noch keine Kunden"}
          >
            {active
              ? "Ändere die Filter oder setze sie zurück."
              : "Kunden entstehen mit der ersten Bestellung, einem Kundenkonto oder dem Import aus Shopify."}
          </EmptyState>
        }
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            cell: (c) => (
              <span className="flex items-center gap-2">
                <span className="truncate">{c.name}</span>
                {c.accountStatus === "blocked" ? <Badge tone="red">Gesperrt</Badge> : null}
              </span>
            ),
          },
          {
            key: "email",
            header: "E-Mail",
            cell: (c) => <span className="text-admin-text-2 break-all">{c.email}</span>,
          },
          {
            key: "bestellungen",
            header: "Bestellungen",
            align: "right",
            width: "120px",
            sortable: true,
            cell: (c) => <span className="tabular-nums">{c.ordersCount}</span>,
          },
          {
            key: "umsatz",
            header: "Umsatz",
            align: "right",
            width: "110px",
            sortable: true,
            cell: (c) => <span className="tabular-nums">{formatMoney(c.totalSpentCents)}</span>,
          },
          {
            key: "letzte",
            header: "Letzte Bestellung",
            width: "140px",
            sortable: true,
            cell: (c) => formatDate(c.lastOrderAt),
          },
          {
            key: "newsletter",
            header: "Newsletter",
            width: "130px",
            cell: (c) => <NewsletterBadge status={c.newsletterStatus} />,
          },
          {
            key: "tags",
            header: "Tags",
            hideBelowLg: true,
            cell: (c) => (
              <span className="flex flex-wrap gap-1">
                {c.tags.slice(0, 3).map((t) => (
                  <TagChip key={t}>{t}</TagChip>
                ))}
                {c.tags.length > 3 ? (
                  <span className="text-admin-text-2 text-[12px]">+{c.tags.length - 3}</span>
                ) : null}
              </span>
            ),
          },
        ]}
        renderCard={(c) => (
          <CardRow
            primary={c.name}
            aside={formatMoney(c.totalSpentCents)}
            secondary={c.email}
            secondaryAside={`${c.ordersCount} ${c.ordersCount === 1 ? "Bestellung" : "Bestellungen"}`}
            badges={
              <>
                <NewsletterBadge status={c.newsletterStatus} />
                {c.accountStatus === "blocked" ? <Badge tone="red">Gesperrt</Badge> : null}
                {c.tags.slice(0, 2).map((t) => (
                  <TagChip key={t}>{t}</TagChip>
                ))}
              </>
            }
          />
        )}
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
