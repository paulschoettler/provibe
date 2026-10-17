import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listCollections } from "@/lib/admin/collections/data";
import {
  archiveProductAction,
  duplicateProductAction,
  moveProductAction,
  reorderProductsAction,
  setProductsStatusAction,
} from "@/lib/admin/products/actions";
import {
  countProductsByStatus,
  listProducts,
  type ProductListItem,
} from "@/lib/admin/products/data";
import { PRODUCT_LINE_LABELS, PRODUCT_LINES } from "@/lib/admin/products/lines";
import { ConfirmSubmit } from "@/components/admin/catalog/ConfirmSubmit";
import { ListSorter } from "@/components/admin/catalog/ListSorter";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, StatusBadge } from "@/components/admin/ui/Badge";
import { ButtonLink, buttonClasses } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatMoney } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Produkte" };

const PATH = "/admin/produkte";
const PAGE_SIZE = 50;
const SORTS = [
  { value: "position", label: "Sortierung: Position" },
  { value: "title", label: "Sortierung: Titel A bis Z" },
  { value: "updated", label: "Sortierung: zuletzt geändert" },
  { value: "created", label: "Sortierung: neueste zuerst" },
] as const;
const STATUSES = ["active", "draft", "archived"] as const;

function stock(p: ProductListItem): { text: string; className: string } {
  if (p.kind === "bundle") return { text: "aus Komponenten", className: "text-admin-text-2" };
  if (p.onHand == null) return { text: "nicht geführt", className: "text-admin-text-2" };
  if (p.onHand <= 0) return { text: "0 verfügbar", className: "text-admin-rot" };
  return { text: `${p.onHand} verfügbar`, className: "" };
}

function subline(p: ProductListItem): string {
  if (p.kind === "bundle")
    return `Bundle · ${p.variantCount > 1 ? `${p.variantCount} Größen` : `${p.componentCount} Komponenten`}`;
  return `${p.variantCount} ${p.variantCount === 1 ? "Variante" : "Varianten"}${
    p.activeVariantCount < p.variantCount ? ` · ${p.activeVariantCount} aktiv` : ""
  }`;
}

function Thumb({ p }: { p: ProductListItem }) {
  return (
    <span className="rounded-admin-feld bg-admin-flaeche flex size-11 shrink-0 items-center justify-center overflow-hidden">
      {p.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={p.imageUrl} alt="" className="size-full object-contain" loading="lazy" />
      ) : (
        <Icon name="bild" size={18} />
      )}
    </span>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editProducts(session);
  const sp = await searchParams;
  const status = firstParam(sp.status);
  const typ = firstParam(sp.typ);
  const kollektion = firstParam(sp.kollektion);
  const sortRaw = firstParam(sp.sort);
  const sort = SORTS.some((s) => s.value === sortRaw)
    ? (sortRaw as (typeof SORTS)[number]["value"])
    : "position";
  const q = firstParam(sp.q)?.trim();
  const page = parsePage(sp.seite);
  const statusFilter = STATUSES.includes(status as never)
    ? (status as (typeof STATUSES)[number])
    : "all";
  const lineFilter = PRODUCT_LINES.some((l) => l.value === typ) ? (typ as never) : "all";
  const collectionId = kollektion && /^[0-9a-f-]{36}$/i.test(kollektion) ? kollektion : undefined;

  let failed = false;
  let result: Awaited<ReturnType<typeof listProducts>> = {
    items: [],
    total: 0,
    page,
    pageSize: PAGE_SIZE,
    tags: [],
  };
  let counts = { all: 0, active: 0, draft: 0, archived: 0 };
  let collections: Awaited<ReturnType<typeof listCollections>> = [];
  try {
    [result, counts, collections] = await Promise.all([
      listProducts({
        q,
        status: statusFilter,
        line: lineFilter,
        collectionId,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
      countProductsByStatus(),
      listCollections(),
    ]);
  } catch (error) {
    console.error("[admin] Produkte", error);
    failed = true;
  }

  const filtered = Boolean(q || statusFilter !== "all" || lineFilter !== "all" || collectionId);
  const canSort = canEdit && sort === "position" && !filtered && result.total <= PAGE_SIZE;
  const chip = (value: string | null, label: string, count: number) => ({
    label,
    count,
    href: withParams(PATH, sp, { status: value, seite: null }),
    active: (status ?? null) === value || (!status && value === null),
  });

  return (
    <>
      <PageHeader
        title="Produkte"
        description={`${counts.all} Produkte, ${collections.length} Kollektionen`}
        actions={
          canEdit ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Produkt hinzufügen
            </ButtonLink>
          ) : null
        }
      />
      {failed ? (
        <FormMessage tone="error">Die Produkte konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <div id="produktliste">
        <Table
          caption="Produkte"
          rows={result.items}
          rowKey={(p) => p.id}
          rowHref={(p) => `${PATH}/${p.id}`}
          density="media"
          selection={
            canEdit
              ? {
                  formId: "produkte-sammel",
                  value: (p) => p.id,
                  label: (p) => `${p.title} auswählen`,
                }
              : undefined
          }
          toolbar={
            <>
              <FilterBar
                action={PATH}
                search={{
                  value: q,
                  placeholder: "Titel, Handle oder SKU suchen",
                  label: "Produkte suchen",
                }}
                chips={[
                  chip(null, "Alle", counts.all),
                  chip("active", "Aktiv", counts.active),
                  chip("draft", "Entwurf", counts.draft),
                  chip("archived", "Archiviert", counts.archived),
                ]}
                hidden={{ status: status ?? undefined }}
                resetHref={filtered || sort !== "position" ? PATH : undefined}
              >
                <Select
                  name="typ"
                  label="Typ"
                  hideLabel
                  placeholder="Alle Typen"
                  defaultValue={lineFilter === "all" ? "" : lineFilter}
                  options={PRODUCT_LINES.map((l) => ({ value: l.value, label: l.label }))}
                />
                <Select
                  name="kollektion"
                  label="Kollektion"
                  hideLabel
                  placeholder="Alle Kollektionen"
                  defaultValue={collectionId ?? ""}
                  options={collections.map((c) => ({ value: c.id, label: c.title }))}
                />
                <Select
                  name="sort"
                  label="Sortierung"
                  hideLabel
                  defaultValue={sort}
                  options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                />
              </FilterBar>
              {canEdit ? (
                <ActionForm
                  id="produkte-sammel"
                  action={setProductsStatusAction}
                  className="flex flex-wrap items-center gap-2 px-3 pb-3"
                  aria-label="Sammelaktion für ausgewählte Produkte"
                >
                  <span className="text-admin-text-2 text-[13px]">Ausgewählte:</span>
                  <SubmitButton variant="secondary" size="sm" name="status" value="active">
                    Aktiv setzen
                  </SubmitButton>
                  <SubmitButton variant="secondary" size="sm" name="status" value="draft">
                    Als Entwurf
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {canSort ? (
                <ListSorter containerId="produktliste" action={reorderProductsAction} />
              ) : null}
            </>
          }
          columns={[
            {
              key: "produkt",
              header: "Produkt",
              cell: (p) => (
                <span className="flex items-center gap-3">
                  <Thumb p={p} />
                  <span className="min-w-0">
                    <span className="block truncate">{p.title}</span>
                    <span className="text-admin-text-2 block text-[13px] font-normal">
                      {subline(p)}
                    </span>
                  </span>
                </span>
              ),
            },
            {
              key: "typ",
              header: "Typ",
              width: "96px",
              cell: (p) => <span className="text-admin-text-2">{PRODUCT_LINE_LABELS[p.line]}</span>,
            },
            {
              key: "status",
              header: "Status",
              width: "120px",
              cell: (p) => <StatusBadge kind="record" value={p.status} />,
            },
            {
              key: "bestand",
              header: "Bestand",
              width: "140px",
              cell: (p) => {
                const s = stock(p);
                return <span className={s.className}>{s.text}</span>;
              },
            },
            {
              key: "preis",
              header: "Preis ab",
              width: "100px",
              align: "right",
              cell: (p) => (
                <span className="font-bold tabular-nums">
                  {p.priceMinCents != null ? formatMoney(p.priceMinCents) : "–"}
                </span>
              ),
            },
            {
              key: "kollektionen",
              header: "Kollektionen",
              hideBelowLg: true,
              cell: (p) => (
                <span className="text-admin-text-2 line-clamp-2">
                  {p.collections.join(", ") || "–"}
                </span>
              ),
            },
            ...(canEdit && sort === "position"
              ? [
                  {
                    key: "position",
                    header: "Position",
                    width: "112px",
                    cell: (p: ProductListItem) => <MoveButtons p={p} draggable={canSort} />,
                  },
                ]
              : []),
          ]}
          rowActions={
            canEdit
              ? (p) => (
                  <span className="flex items-center justify-end gap-1">
                    <form action={duplicateProductAction}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button
                        type="submit"
                        aria-label={`${p.title} duplizieren`}
                        title="Duplizieren"
                        className={buttonClasses("text", "sm", "text-admin-text px-1.5")}
                      >
                        <Icon name="kopieren" size={18} />
                      </button>
                    </form>
                    {p.status !== "archived" ? (
                      <form action={archiveProductAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <ConfirmSubmit
                          variant="text"
                          size="sm"
                          className="text-admin-text px-1.5"
                          aria-label={`${p.title} archivieren`}
                          confirm={`„${p.title}“ archivieren? Das Produkt verschwindet aus dem Shop.`}
                        >
                          <Icon name="archivieren" size={18} />
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </span>
                )
              : undefined
          }
          renderCard={(p) => {
            const s = stock(p);
            return (
              <span className="flex items-start gap-3">
                <Thumb p={p} />
                <span className="min-w-0 flex-1">
                  <CardRow
                    primary={p.title}
                    secondary={`${p.priceMinCents != null ? `ab ${formatMoney(p.priceMinCents)} · ` : ""}${subline(p)}`}
                    badges={
                      <>
                        <StatusBadge kind="record" value={p.status} />
                        <Badge tone="gray" noDot>
                          {PRODUCT_LINE_LABELS[p.line]}
                        </Badge>
                        <span className={`text-[13px] ${s.className}`}>{s.text}</span>
                      </>
                    }
                  />
                </span>
              </span>
            );
          }}
          empty={
            <EmptyState
              icon="produkte"
              title={filtered ? "Keine Produkte für diese Filter" : "Noch keine Produkte"}
              action={
                filtered ? (
                  <ButtonLink href={PATH}>Filter zurücksetzen</ButtonLink>
                ) : canEdit ? (
                  <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
                    Produkt hinzufügen
                  </ButtonLink>
                ) : undefined
              }
            >
              {filtered ? "Ändere die Suche oder die Filter." : "Lege das erste Produkt an."}
            </EmptyState>
          }
          footer={
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={result.total}
              hrefFor={(n) => withParams(PATH, sp, { seite: n > 1 ? n : null })}
            />
          }
        />
      </div>
    </>
  );
}

function MoveButtons({ p, draggable }: { p: ProductListItem; draggable: boolean }) {
  return (
    <span className="relative z-10 flex items-center gap-0.5">
      {draggable ? (
        <span
          data-drag-id={p.id}
          className="text-admin-text-2 flex size-8 cursor-grab items-center justify-center"
          title="Ziehen zum Sortieren"
        >
          <Icon name="griff" size={16} label={`${p.title} ziehen`} />
        </span>
      ) : null}
      <form action={moveProductAction}>
        <input type="hidden" name="productId" value={p.id} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          aria-label={`${p.title} nach oben`}
          className={buttonClasses("text", "sm", "text-admin-text px-1.5")}
        >
          <Icon name="chevron-unten" size={16} className="rotate-180" />
        </button>
      </form>
      <form action={moveProductAction}>
        <input type="hidden" name="productId" value={p.id} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          aria-label={`${p.title} nach unten`}
          className={buttonClasses("text", "sm", "text-admin-text px-1.5")}
        >
          <Icon name="chevron-unten" size={16} />
        </button>
      </form>
    </span>
  );
}
