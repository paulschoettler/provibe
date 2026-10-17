import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  countCancellationRequests,
  listCancellationRequestsPage,
  type CancellationRequestRow,
  type CancellationStatus,
} from "@/lib/subscriptions/admin-queries";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { requestTimingText } from "@/components/admin/subscriptions/CancellationRequestDetail";
import { REQUEST_STATUS } from "@/components/admin/subscriptions/labels";

export const metadata: Metadata = { title: "Kündigungen" };

const PATH = "/admin/abos/kuendigungen";
const PAGE_SIZE = 50;

const TABS: { slug: string; label: string; statuses: CancellationStatus[] | null }[] = [
  { slug: "ungeklaert", label: "Ungeklärt", statuses: ["unmatched"] },
  { slug: "eingegangen", label: "Eingegangen", statuses: ["received"] },
  { slug: "zugeordnet", label: "Zugeordnet", statuses: ["matched"] },
  { slug: "erledigt", label: "Erledigt", statuses: ["resolved"] },
  { slug: "alle", label: "Alle", statuses: null },
];

const COUNT_KEY: Record<string, CancellationStatus | "all"> = {
  ungeklaert: "unmatched",
  eingegangen: "received",
  zugeordnet: "matched",
  erledigt: "resolved",
  alle: "all",
};

/**
 * /admin/abos/kuendigungen: Protokoll der Kündigungserklärungen über /abo-kuendigen (§ 312k BGB,
 * H23, H28). Ungeklärte Fälle (E-Mail ohne passendes Abo) stehen vorne. Detail mit möglichen Abos
 * derselben E-Mail-Adresse und Klärung per Notiz unter /admin/abos/kuendigungen/[id].
 */
export default async function CancellationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const sp = await searchParams;
  const slug = firstParam(sp.status) ?? "ungeklaert";
  const tab = TABS.find((t) => t.slug === slug) ?? TABS[0];
  const q = firstParam(sp.q)?.trim() ?? "";
  const page = parsePage(sp.seite);

  let result: { rows: CancellationRequestRow[]; total: number } = { rows: [], total: 0 };
  let counts: Awaited<ReturnType<typeof countCancellationRequests>> | null = null;
  let failed = false;
  try {
    [result, counts] = await Promise.all([
      listCancellationRequestsPage({
        statuses: tab.statuses ?? undefined,
        search: q || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      countCancellationRequests(),
    ]);
  } catch (error) {
    console.error("[admin] Kündigungsanfragen", error);
    failed = true;
  }

  return (
    <>
      <PageHeader
        title="Kündigungen ohne Login"
        backHref="/admin/abos"
        backLabel="Abos"
        description="Jede Erklärung über /abo-kuendigen mit Zeitpunkt. Ungeklärte Fälle bitte zuordnen und mit Notiz erledigen."
      />
      {failed ? (
        <FormMessage tone="error">Die Kündigungen konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Kündigungserklärungen"
        rows={result.rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `${PATH}/${r.id}`}
        toolbar={
          <FilterBar
            action={PATH}
            chips={TABS.map((t) => ({
              label: t.label,
              href: withParams(PATH, sp, {
                status: t.slug === "ungeklaert" ? null : t.slug,
                seite: null,
              }),
              active: t.slug === tab.slug,
              count: counts ? counts[COUNT_KEY[t.slug]] : undefined,
            }))}
            hidden={{ status: tab.slug === "ungeklaert" ? undefined : tab.slug }}
            search={{
              value: q,
              placeholder: "Name, E-Mail oder Abo-Nummer",
              label: "Kündigungen suchen",
            }}
            resetHref={q ? withParams(PATH, sp, { q: null, seite: null }) : undefined}
          />
        }
        columns={[
          {
            key: "eingang",
            header: "Eingang",
            width: "170px",
            cell: (r) => formatDateTime(r.receivedAt),
          },
          {
            key: "kunde",
            header: "Name und E-Mail",
            cell: (r) => (
              <span className="flex flex-col">
                <span className="font-bold">{r.name}</span>
                <span className="text-admin-text-2 text-[12px] break-all">{r.email}</span>
              </span>
            ),
          },
          {
            key: "abo",
            header: "Abo-Nummer",
            width: "130px",
            cell: (r) => r.subscriptionNumber ?? <span className="text-admin-text-2">ohne</span>,
          },
          {
            key: "art",
            header: "Art",
            hideBelowLg: true,
            cell: (r) => <span className="text-admin-text-2">{requestTimingText(r)}</span>,
          },
          {
            key: "status",
            header: "Status",
            width: "130px",
            cell: (r) => {
              const s = REQUEST_STATUS[r.status];
              return (
                <Badge tone={s.tone} hollow={s.hollow}>
                  {s.label}
                </Badge>
              );
            },
          },
        ]}
        renderCard={(r) => {
          const s = REQUEST_STATUS[r.status];
          return (
            <CardRow
              primary={r.name}
              secondary={r.email}
              secondaryAside={formatDateTime(r.receivedAt)}
              badges={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.tone} hollow={s.hollow}>
                    {s.label}
                  </Badge>
                  <span className="text-admin-text-2 text-[13px]">
                    {r.subscriptionNumber ?? "ohne Abo-Nummer"} · {requestTimingText(r)}
                  </span>
                </span>
              }
            />
          );
        }}
        empty={
          <EmptyState
            icon="haken"
            title={tab.slug === "ungeklaert" ? "Nichts Ungeklärtes" : "Keine Einträge"}
          >
            {tab.slug === "ungeklaert"
              ? "Alle Kündigungen ohne Login sind einem Abo zugeordnet oder erledigt."
              : "Für diesen Filter gibt es keine Kündigungserklärungen."}
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
