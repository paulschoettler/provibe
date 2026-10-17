import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listCollections, type CollectionListItem } from "@/lib/admin/collections/data";
import { SORT_KEYS } from "@/lib/admin/collections/rules";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, StatusBadge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Kollektionen" };

const PATH = "/admin/kollektionen";
const SORT_LABEL = new Map<string, string>(SORT_KEYS.map((s) => [s.value, s.label]));

function Thumb({ c }: { c: CollectionListItem }) {
  return (
    <span className="rounded-admin-feld bg-admin-flaeche flex size-11 shrink-0 items-center justify-center overflow-hidden">
      {c.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Icon name="kollektionen" size={18} />
      )}
    </span>
  );
}

function kindText(c: CollectionListItem) {
  return c.kind === "automatic"
    ? `Automatisch · ${c.rulesCount} ${c.rulesCount === 1 ? "Bedingung" : "Bedingungen"}`
    : "Manuell";
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editProducts(session);
  const sp = await searchParams;
  const status = firstParam(sp.status);
  const art = firstParam(sp.art);
  const q = firstParam(sp.q)?.trim().toLowerCase();

  let all: CollectionListItem[] = [];
  let failed = false;
  try {
    all = await listCollections();
  } catch (error) {
    console.error("[admin] Kollektionen", error);
    failed = true;
  }
  const rows = all.filter(
    (c) =>
      (!status || c.status === status) &&
      (!art || c.kind === art) &&
      (!q || c.title.toLowerCase().includes(q) || c.handle.includes(q)),
  );
  const count = (s?: string) => all.filter((c) => !s || c.status === s).length;
  const chip = (value: string | null, label: string) => ({
    label,
    count: count(value ?? undefined),
    href: withParams(PATH, sp, { status: value }),
    active: (status ?? null) === value,
  });
  const filtered = Boolean(status || art || q);

  return (
    <>
      <PageHeader
        title="Kollektionen"
        description="Manuelle und regelbasierte Produktgruppen für Shop, Navigation und Rabatte."
        actions={
          canEdit ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Kollektion anlegen
            </ButtonLink>
          ) : null
        }
      />
      {failed ? (
        <FormMessage tone="error">
          Die Kollektionen konnten gerade nicht geladen werden.
        </FormMessage>
      ) : null}
      <Table
        caption="Kollektionen"
        rows={rows}
        rowKey={(c) => c.id}
        rowHref={(c) => `${PATH}/${c.id}`}
        density="media"
        toolbar={
          <FilterBar
            action={PATH}
            search={{
              value: firstParam(sp.q),
              placeholder: "Titel oder Handle suchen",
              label: "Kollektionen suchen",
            }}
            chips={[
              chip(null, "Alle"),
              chip("published", "Veröffentlicht"),
              chip("draft", "Entwurf"),
              chip("archived", "Archiviert"),
            ]}
            hidden={{ status: status ?? undefined, art: art ?? undefined }}
            resetHref={filtered ? PATH : undefined}
          />
        }
        columns={[
          {
            key: "titel",
            header: "Kollektion",
            cell: (c) => (
              <span className="flex items-center gap-3">
                <Thumb c={c} />
                <span className="min-w-0">
                  <span className="block truncate">{c.title}</span>
                  <span className="text-admin-text-2 block text-[13px] font-normal">
                    /collections/{c.handle}
                  </span>
                </span>
              </span>
            ),
          },
          {
            key: "art",
            header: "Art",
            width: "200px",
            cell: (c) => <span className="text-admin-text-2">{kindText(c)}</span>,
          },
          {
            key: "produkte",
            header: "Produkte",
            width: "100px",
            align: "right",
            cell: (c) => <span className="tabular-nums">{c.productCount}</span>,
          },
          {
            key: "sortierung",
            header: "Sortierung",
            width: "170px",
            hideBelowLg: true,
            cell: (c) => (
              <span className="text-admin-text-2">{SORT_LABEL.get(c.sortKey) ?? c.sortKey}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "140px",
            cell: (c) => <StatusBadge kind="record" value={c.status} />,
          },
          {
            key: "geaendert",
            header: "Geändert",
            width: "110px",
            hideBelowLg: true,
            cell: (c) => <span className="text-admin-text-2">{formatDate(c.updatedAt)}</span>,
          },
        ]}
        renderCard={(c) => (
          <span className="flex items-start gap-3">
            <Thumb c={c} />
            <span className="min-w-0 flex-1">
              <CardRow
                primary={c.title}
                secondary={`${c.productCount} Produkte · ${kindText(c)}`}
                badges={
                  <>
                    <StatusBadge kind="record" value={c.status} />
                    {c.kind === "automatic" ? (
                      <Badge tone="blue" noDot>
                        Regeln
                      </Badge>
                    ) : null}
                  </>
                }
              />
            </span>
          </span>
        )}
        empty={
          <EmptyState
            icon="kollektionen"
            title={filtered ? "Keine Kollektionen für diese Filter" : "Noch keine Kollektionen"}
            action={
              canEdit && !filtered ? (
                <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
                  Kollektion anlegen
                </ButtonLink>
              ) : undefined
            }
          >
            {filtered
              ? "Ändere die Suche oder die Filter."
              : "Kollektionen gruppieren Produkte für Shop und Navigation."}
          </EmptyState>
        }
        footer={
          <p className="text-admin-text-2 py-3 text-[13px]">
            {rows.length} von {all.length} Kollektionen
          </p>
        }
      />
    </>
  );
}
