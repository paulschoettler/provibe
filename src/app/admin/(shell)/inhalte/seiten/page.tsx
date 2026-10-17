import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listPages, PAGE_TEMPLATE_LABELS, type PageListItem } from "@/lib/admin/content/pages";
import { PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Seiten" };

const PATH = "/admin/inhalte/seiten";

/** /admin/inhalte/seiten: Inhaltsseiten (pages, page_translations). Rechtstexte liegen getrennt. */
export default async function PagesListPage() {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  let pages: PageListItem[] = [];
  let failed = false;
  try {
    pages = await listPages();
  } catch {
    failed = true;
  }
  const label = (t: string) => PAGE_TEMPLATE_LABELS[t as keyof typeof PAGE_TEMPLATE_LABELS] ?? t;

  return (
    <>
      <PageHeader
        title="Seiten"
        description="Inhaltsseiten unter /pages. Rechtstexte bearbeitest du unter Rechtstexte."
        actions={
          canEdit ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Seite anlegen
            </ButtonLink>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      {failed ? (
        <FormMessage tone="error">Die Seiten konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Inhaltsseiten"
        rows={pages}
        rowKey={(p) => p.id}
        rowHref={(p) => `${PATH}/${p.id}`}
        columns={[
          {
            key: "titel",
            header: "Titel",
            cell: (p) => (
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="text-admin-text-2 block truncate text-[12px]">{p.path}</span>
              </span>
            ),
          },
          { key: "vorlage", header: "Vorlage", width: "150px", cell: (p) => label(p.template) },
          {
            key: "status",
            header: "Status",
            width: "170px",
            cell: (p) => (
              <span className="flex flex-wrap gap-1">
                <PublishBadge status={p.status} />
                {p.noindex ? (
                  <Badge tone="gray" hollow>
                    noindex
                  </Badge>
                ) : null}
              </span>
            ),
          },
          {
            key: "geaendert",
            header: "Geändert",
            width: "120px",
            hideBelowLg: true,
            cell: (p) => formatDate(p.updatedAt),
          },
        ]}
        renderCard={(p) => (
          <CardRow
            primary={p.title}
            secondary={p.path}
            badges={
              <>
                <PublishBadge status={p.status} />
                <Badge tone="gray" noDot>
                  {label(p.template)}
                </Badge>
              </>
            }
            secondaryAside={formatDate(p.updatedAt)}
          />
        )}
        empty={
          <EmptyState icon="inhalte" title="Noch keine Seiten">
            Lege die erste Inhaltsseite an.
          </EmptyState>
        }
      />
    </>
  );
}
