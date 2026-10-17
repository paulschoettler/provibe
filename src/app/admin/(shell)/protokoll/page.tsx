import type { Metadata } from "next";
import { hasRole, requireStaff } from "@/lib/admin/auth";
import {
  auditFacets,
  diffAudit,
  getAuditEntry,
  listAuditLog,
  type AuditEntry,
} from "@/lib/admin/audit-query";
import { addDays, berlinMidnight } from "@/lib/admin/dashboard/period";
import { listStaffRows } from "@/lib/admin/staff/db";
import { NoAccess } from "@/components/admin/NoAccess";
import { Badge } from "@/components/admin/ui/Badge";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { FormMessage } from "@/components/admin/ui/ActionForm";

export const metadata: Metadata = { title: "Protokoll" };

const PATH = "/admin/protokoll";
const PAGE_SIZE = 50;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lesbare Namen bekannter Aktionen; unbekannte erscheinen als Schlüssel (entity.verb). */
const ACTION_LABELS: Record<string, string> = {
  "staff.sign_in": "Anmeldung",
  "staff.sign_in_failed": "Anmeldung fehlgeschlagen",
  "staff.sign_out": "Abmeldung",
  "staff.mfa_enroll": "Zwei-Faktor eingerichtet",
  "staff.mfa_verify": "Zwei-Faktor bestätigt",
  "staff.mfa_failed": "Zwei-Faktor-Code falsch",
  "staff.mfa_reset": "Zwei-Faktor zurückgesetzt",
  "staff.mfa_recovery_used": "Wiederherstellungscode verwendet",
  "staff.mfa_recovery_failed": "Wiederherstellungscode falsch",
  "staff.invite": "Benutzer eingeladen",
  "staff.invite_revoke": "Einladung zurückgezogen",
  "staff.role_change": "Rolle geändert",
  "staff.activate": "Benutzer aktiviert",
  "staff.deactivate": "Benutzer deaktiviert",
};

function actionTone(action: string): "red" | "green" | "gray" | "accent" | "blue" {
  if (/(failed|deactivate|delete|cancel|refund|reset|revoke)/.test(action)) return "red";
  if (/(create|enroll|activate|invite)/.test(action)) return "green";
  if (action.startsWith("staff.")) return "accent";
  return "blue";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;

  const sp = await searchParams;
  const action = firstParam(sp.aktion);
  const entityType = firstParam(sp.entitaet);
  const actor = firstParam(sp.benutzer);
  const von = firstParam(sp.von);
  const bis = firstParam(sp.bis);
  const q = firstParam(sp.q)?.trim();
  const page = parsePage(sp.seite);
  const entryId = Number(firstParam(sp.eintrag));

  let result: { rows: AuditEntry[]; total: number } = { rows: [], total: 0 };
  let facets = { actions: [] as string[], entityTypes: [] as string[] };
  let failed = false;
  const [staff, entry] = await Promise.all([
    listStaffRows().catch(() => []),
    Number.isInteger(entryId) && entryId > 0
      ? getAuditEntry(entryId).catch(() => null)
      : Promise.resolve(null),
  ]);
  try {
    [result, facets] = await Promise.all([
      listAuditLog(
        {
          action,
          entityType,
          actorUserId: actor && /^[0-9a-f-]{36}$/i.test(actor) ? actor : undefined,
          from: von && DAY_RE.test(von) ? berlinMidnight(von) : undefined,
          to: bis && DAY_RE.test(bis) ? berlinMidnight(addDays(bis, 1)) : undefined,
          entityId: q,
        },
        page,
        PAGE_SIZE,
      ),
      auditFacets(),
    ]);
  } catch (error) {
    console.error("[admin] Protokoll", error);
    failed = true;
  }

  const actorName = new Map(staff.map((s) => [s.user_id, s.display_name ?? s.email]));
  const filtered = Boolean(action || entityType || actor || von || bis || q);
  const label = (a: string) => ACTION_LABELS[a] ?? a;

  return (
    <>
      <PageHeader
        title="Protokoll"
        description="Alle schreibenden Aktionen im Backoffice mit Zeitpunkt, Benutzer und Änderung."
      />
      {failed ? (
        <FormMessage tone="error">Das Protokoll konnte gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Protokolleinträge"
        rows={result.rows}
        rowKey={(r) => String(r.id)}
        rowHref={(r) => withParams(PATH, sp, { eintrag: r.id })}
        toolbar={
          <FilterBar
            action={PATH}
            search={{
              value: q,
              placeholder: "Objekt suchen (ID, Nummer, E-Mail)",
              label: "Objekt suchen",
            }}
            resetHref={filtered ? PATH : undefined}
          >
            <Select
              name="aktion"
              label="Aktion"
              hideLabel
              placeholder="Alle Aktionen"
              defaultValue={action ?? ""}
              options={facets.actions.map((a) => ({ value: a, label: label(a) }))}
            />
            <Select
              name="entitaet"
              label="Entität"
              hideLabel
              placeholder="Alle Entitäten"
              defaultValue={entityType ?? ""}
              options={facets.entityTypes.map((e) => ({ value: e, label: e }))}
            />
            <Select
              name="benutzer"
              label="Benutzer"
              hideLabel
              placeholder="Alle Benutzer"
              defaultValue={actor ?? ""}
              options={staff.map((s) => ({ value: s.user_id, label: s.display_name ?? s.email }))}
            />
            <label className="text-admin-text-2 flex flex-col gap-1 text-[12px]">
              <span className="sr-only">Von</span>
              <input
                type="date"
                name="von"
                defaultValue={von}
                aria-label="Von"
                className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-3 text-[14px] md:h-10"
              />
            </label>
            <label className="text-admin-text-2 flex flex-col gap-1 text-[12px]">
              <span className="sr-only">Bis</span>
              <input
                type="date"
                name="bis"
                defaultValue={bis}
                aria-label="Bis"
                className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-3 text-[14px] md:h-10"
              />
            </label>
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="protokoll"
            title={filtered ? "Keine Einträge für diese Filter" : "Noch keine Einträge"}
          >
            {filtered
              ? "Ändere die Filter oder setze sie zurück."
              : "Sobald jemand im Backoffice etwas ändert, erscheint es hier."}
          </EmptyState>
        }
        columns={[
          {
            key: "zeit",
            header: "Zeitpunkt",
            width: "170px",
            cell: (r) => formatDateTime(r.createdAt),
          },
          {
            key: "aktion",
            header: "Aktion",
            cell: (r) => (
              <Badge tone={actionTone(r.action)} noDot>
                {label(r.action)}
              </Badge>
            ),
          },
          {
            key: "objekt",
            header: "Objekt",
            cell: (r) => (
              <span className="text-admin-text-2">
                {r.entityType}
                {r.entityId ? (
                  <span className="text-admin-text">
                    {" "}
                    · {r.entityId.length > 24 ? `${r.entityId.slice(0, 8)}…` : r.entityId}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "benutzer",
            header: "Benutzer",
            cell: (r) =>
              r.actorUserId
                ? (actorName.get(r.actorUserId) ?? r.actorEmail ?? "–")
                : (r.actorEmail ?? "System"),
          },
          {
            key: "rolle",
            header: "Rolle",
            width: "110px",
            hideBelowLg: true,
            cell: (r) => <span className="text-admin-text-2">{r.actorRole ?? "–"}</span>,
          },
        ]}
        renderCard={(r) => (
          <CardRow
            primary={label(r.action)}
            secondary={`${r.entityType}${r.entityId ? ` · ${r.entityId}` : ""}`}
            secondaryAside={formatDateTime(r.createdAt)}
            badges={
              <span className="text-admin-text-2 text-[13px]">{r.actorEmail ?? "System"}</span>
            }
          />
        )}
        footer={
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.total}
            hrefFor={(p) => withParams(PATH, sp, { seite: p > 1 ? p : null, eintrag: null })}
          />
        }
      />

      <Drawer
        open={Boolean(entry)}
        closeHref={withParams(PATH, sp, { eintrag: null })}
        title={entry ? label(entry.action) : "Eintrag"}
        description={entry ? formatDateTime(entry.createdAt) : undefined}
      >
        {entry ? (
          <EntryDetail
            entry={entry}
            actor={entry.actorUserId ? actorName.get(entry.actorUserId) : undefined}
          />
        ) : null}
      </Drawer>
    </>
  );
}

function fmt(value: unknown): string {
  if (value === undefined) return "–";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function EntryDetail({ entry, actor }: { entry: AuditEntry; actor?: string }) {
  const changes = diffAudit(entry.before, entry.after);
  return (
    <div className="flex flex-col gap-5 p-5">
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[14px]">
        <dt className="text-admin-text-2">Aktion</dt>
        <dd className="font-mono text-[13px] break-all">{entry.action}</dd>
        <dt className="text-admin-text-2">Objekt</dt>
        <dd className="break-all">
          {entry.entityType}
          {entry.entityId ? ` · ${entry.entityId}` : ""}
        </dd>
        <dt className="text-admin-text-2">Benutzer</dt>
        <dd className="break-all">
          {actor ?? entry.actorEmail ?? "System"}
          {entry.actorRole ? <span className="text-admin-text-2"> ({entry.actorRole})</span> : null}
        </dd>
        <dt className="text-admin-text-2">IP</dt>
        <dd>{entry.ip ?? "–"}</dd>
        <dt className="text-admin-text-2">Browser</dt>
        <dd className="text-admin-text-2 text-[13px] break-words">{entry.userAgent ?? "–"}</dd>
      </dl>
      <div>
        <h3 className="mb-2 text-[15px] font-bold">Änderung</h3>
        {changes.length === 0 ? (
          <p className="text-admin-text-2 text-[14px]">
            Keine Vorher- oder Nachher-Daten gespeichert.
          </p>
        ) : (
          <div className="rounded-admin-feld border-admin-rahmen overflow-x-auto border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-admin-flaeche text-admin-text-2 text-left">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Feld
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Vorher
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Nachher
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr
                    key={c.key}
                    className={`border-admin-rahmen border-t align-top ${c.changed ? "" : "text-admin-text-2"}`}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {c.key}
                    </th>
                    <td className={`px-3 py-2 ${c.changed ? "bg-admin-rot-hell" : ""}`}>
                      <pre className="font-mono break-all whitespace-pre-wrap">{fmt(c.before)}</pre>
                    </td>
                    <td className={`px-3 py-2 ${c.changed ? "bg-admin-gruen-hell" : ""}`}>
                      <pre className="font-mono break-all whitespace-pre-wrap">{fmt(c.after)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
