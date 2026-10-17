import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listLegalDocuments, type LegalDocumentOverview } from "@/lib/admin/content/legal";
import { Hint, PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { formatDate, formatDateTime } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Rechtstexte" };

const PATH = "/admin/inhalte/rechtstexte";

/**
 * /admin/inhalte/rechtstexte: die fünf Rechtstexte mit gültiger Fassung, Entwurf und geplanter
 * Version. Nur die veröffentlichte Version ist live; Entwürfe sieht niemand außer dem Backoffice.
 */
export default async function LegalListPage() {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  let docs: LegalDocumentOverview[] = [];
  let failed = false;
  try {
    docs = await listLegalDocuments();
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHeader
        title="Rechtstexte"
        description="Versioniert: Jede Änderung entsteht als Entwurf und wird erst mit dem Veröffentlichen live."
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      {failed ? (
        <FormMessage tone="error">Die Rechtstexte konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Hint className="mb-4">
        Nur die veröffentlichte Version ist live. Die Entwürfe Version 2 stammen aus der
        Gegenüberstellung in docs/rechtstexte-aenderungen.md (Stand: Entwurf, Freigabe durch dich
        und deinen Anwalt ausstehend). Veröffentlichte Versionen bleiben unverändert erhalten, damit
        nachweisbar ist, welche Fassung bei einer Bestellung galt.
      </Hint>
      <Table
        caption="Rechtstexte mit Versionen"
        rows={docs}
        rowKey={(d) => d.kind}
        rowHref={(d) => `${PATH}/${d.kind}`}
        columns={[
          {
            key: "text",
            header: "Rechtstext",
            cell: (d) => (
              <span className="min-w-0">
                <span className="block font-medium">{d.label}</span>
                <span className="text-admin-text-2 block truncate text-[12px]">{d.path}</span>
              </span>
            ),
          },
          {
            key: "live",
            header: "Live",
            width: "190px",
            cell: (d) =>
              d.current ? (
                <span className="flex flex-col">
                  <span>Version {d.current.version}</span>
                  <span className="text-admin-text-2 text-[12px]">
                    seit {formatDate(d.current.effectiveFrom ?? d.current.publishedAt)}
                  </span>
                </span>
              ) : (
                <Badge tone="red">keine gültige Fassung</Badge>
              ),
          },
          {
            key: "entwurf",
            header: "In Arbeit",
            width: "210px",
            cell: (d) => (
              <span className="flex flex-wrap gap-1">
                {d.draft ? <Badge tone="yellow">Entwurf V{d.draft.version}</Badge> : null}
                {d.upcoming ? (
                  <Badge tone="blue" hollow>
                    V{d.upcoming.version} ab {formatDate(d.upcoming.effectiveFrom)}
                  </Badge>
                ) : null}
                {!d.draft && !d.upcoming ? <span className="text-admin-text-2">–</span> : null}
              </span>
            ),
          },
          {
            key: "versionen",
            header: "Versionen",
            width: "100px",
            align: "right",
            hideBelowLg: true,
            cell: (d) => d.versionsCount,
          },
        ]}
        renderCard={(d) => (
          <CardRow
            primary={d.label}
            secondary={d.path}
            aside={d.current ? `V${d.current.version}` : undefined}
            secondaryAside={
              d.current?.publishedAt ? formatDateTime(d.current.publishedAt) : undefined
            }
            badges={
              <>
                {d.current ? <PublishBadge status="published" /> : null}
                {d.draft ? <Badge tone="yellow">Entwurf V{d.draft.version}</Badge> : null}
              </>
            }
          />
        )}
      />
    </>
  );
}
