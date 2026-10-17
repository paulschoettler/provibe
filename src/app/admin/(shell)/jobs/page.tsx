import type { Metadata } from "next";
import { hasRole, requireStaff } from "@/lib/admin/auth";
import { discardJobAction, retryJobAction } from "@/lib/admin/jobs/actions";
import {
  getJob,
  jobCounts,
  jobKindLabel,
  jobKinds,
  JOB_VIEWS,
  listJobs,
  type JobRow,
  type JobView,
} from "@/lib/admin/jobs/admin";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { Stat } from "@/components/admin/ui/Stat";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Hintergrundjobs" };

const PATH = "/admin/jobs";
const PAGE_SIZE = 50;

const STATUS: Record<JobRow["status"], { label: string; tone: BadgeTone; hollow?: boolean }> = {
  queued: { label: "Wartet", tone: "yellow", hollow: true },
  running: { label: "Läuft", tone: "blue" },
  succeeded: { label: "Erledigt", tone: "green" },
  failed: { label: "Fehlgeschlagen", tone: "red" },
  dead: { label: "Tot", tone: "red" },
  cancelled: { label: "Verworfen", tone: "gray" },
};

function JobStatus({ job }: { job: JobRow }) {
  const s = STATUS[job.status];
  const due = job.due;
  return (
    <Badge tone={due ? "yellow" : s.tone} hollow={s.hollow}>
      {job.status === "queued" ? (due ? "Fällig" : "Geplant") : s.label}
    </Badge>
  );
}

function JobActions({ job }: { job: JobRow }) {
  const retry = ["dead", "failed", "queued", "cancelled"].includes(job.status);
  const discard = ["dead", "failed", "queued"].includes(job.status);
  if (!retry && !discard) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {retry ? (
        <ActionForm action={retryJobAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <SubmitButton variant="secondary" size="sm" pendingLabel="…">
            {job.status === "queued" ? "Jetzt ausführen" : "Wiederholen"}
          </SubmitButton>
        </ActionForm>
      ) : null}
      {discard ? (
        <ActionForm action={discardJobAction}>
          <input type="hidden" name="jobId" value={job.id} />
          <SubmitButton variant="text" size="sm" pendingLabel="…">
            Verwerfen
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}

/**
 * /admin/jobs (nur Owner und Admin): Hintergrundjobs der Queue (Mails, Rechnungen, Reservierungen,
 * Tracking). Fällig, geplant, laufend, tot, erledigt, verworfen; Fehlermeldung, Wiederholen und
 * Verwerfen mit Audit. Ohne Figma-Vorlage, nach dem Listenmuster des UI-Kits (Protokoll).
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const sp = await searchParams;
  const viewParam = firstParam(sp.ansicht);
  const view = (viewParam && viewParam in JOB_VIEWS ? viewParam : "faellig") as JobView;
  const kind = firstParam(sp.art);
  const page = parsePage(sp.seite);
  const jobId = firstParam(sp.job);

  let counts: Record<JobView, number> | null = null;
  let result: { rows: JobRow[]; total: number } = { rows: [], total: 0 };
  let kinds: string[] = [];
  let failed = false;
  try {
    [counts, result, kinds] = await Promise.all([
      jobCounts(),
      listJobs({ view, kind, page, pageSize: PAGE_SIZE }),
      jobKinds(),
    ]);
  } catch (error) {
    console.error("[admin] Jobs", error);
    failed = true;
  }
  const job = jobId ? await getJob(jobId).catch(() => null) : null;

  return (
    <>
      <PageHeader
        title="Hintergrundjobs"
        description="Mails, Rechnungen, Reservierungen und Tracking laufen über diese Queue. Der Runner arbeitet fällige Jobs alle 5 Minuten ab."
        meta={
          counts && counts.tot > 0 ? (
            <Badge tone="red">{counts.tot} tot</Badge>
          ) : counts ? (
            <Badge tone="green">keine toten Jobs</Badge>
          ) : null
        }
      />
      {failed ? (
        <FormMessage tone="error">Die Jobs konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      {counts && counts.tot > 0 ? (
        <FormMessage tone="warning">
          {counts.tot} {counts.tot === 1 ? "Job ist" : "Jobs sind"} nach allen Versuchen
          gescheitert. Prüfe die Fehlermeldung, behebe die Ursache und wiederhole oder verwirf den
          Job.
        </FormMessage>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Fällig" value={counts?.faellig ?? 0} />
        <Stat label="Geplant" value={counts?.geplant ?? 0} hint="mit Wartezeit nach Fehlern" />
        <Stat label="Laufend" value={counts?.laufend ?? 0} />
        <Stat label="Tot" value={counts?.tot ?? 0} />
      </div>

      <Table
        caption="Hintergrundjobs"
        rows={result.rows}
        rowKey={(j) => j.id}
        rowHref={(j) => withParams(PATH, sp, { job: j.id })}
        toolbar={
          <FilterBar
            action={PATH}
            chips={(Object.keys(JOB_VIEWS) as JobView[]).map((v) => ({
              label: JOB_VIEWS[v],
              href: withParams(PATH, sp, {
                ansicht: v === "faellig" ? null : v,
                seite: null,
                job: null,
              }),
              active: view === v,
              count: counts?.[v],
            }))}
            hidden={{ ansicht: view === "faellig" ? undefined : view }}
            resetHref={kind ? withParams(PATH, sp, { art: null, seite: null }) : undefined}
          >
            <Select
              name="art"
              label="Art"
              hideLabel
              placeholder="Alle Arten"
              defaultValue={kind ?? ""}
              options={kinds.map((k) => ({ value: k, label: jobKindLabel(k) }))}
            />
          </FilterBar>
        }
        empty={
          <EmptyState icon="liste" title={`Keine Jobs: ${JOB_VIEWS[view]}`}>
            {view === "tot" ? "Alles läuft, kein Job ist gescheitert." : "Hier ist gerade nichts."}
          </EmptyState>
        }
        columns={[
          {
            key: "art",
            header: "Art",
            cell: (j) => (
              <span className="flex flex-col">
                <span>{j.kindLabel}</span>
                <span className="text-admin-text-2 font-mono text-[12px] font-normal">
                  {j.kind}
                </span>
              </span>
            ),
          },
          { key: "status", header: "Status", width: "120px", cell: (j) => <JobStatus job={j} /> },
          {
            key: "versuche",
            header: "Versuche",
            width: "90px",
            align: "right",
            cell: (j) => (
              <span className="tabular-nums">
                {j.attempts}/{j.maxAttempts}
              </span>
            ),
          },
          {
            key: "zeit",
            header: view === "faellig" || view === "geplant" ? "Fällig ab" : "Zuletzt",
            width: "160px",
            cell: (j) =>
              formatDateTime(view === "faellig" || view === "geplant" ? j.runAt : j.updatedAt),
          },
          {
            key: "bestellung",
            header: "Bestellung",
            width: "120px",
            hideBelowLg: true,
            cell: (j) => j.orderNumber ?? "–",
          },
          {
            key: "fehler",
            header: "Fehler",
            hideBelowLg: true,
            cell: (j) =>
              j.lastError ? (
                <span className="text-admin-rot line-clamp-2 text-[13px] break-all">
                  {j.lastError}
                </span>
              ) : (
                <span className="text-admin-text-2">–</span>
              ),
          },
        ]}
        rowActions={(j) => <JobActions job={j} />}
        renderCard={(j) => (
          <CardRow
            primary={j.kindLabel}
            aside={`${j.attempts}/${j.maxAttempts}`}
            secondary={j.lastError ?? j.kind}
            secondaryAside={formatDateTime(j.updatedAt)}
            badges={<JobStatus job={j} />}
          />
        )}
        footer={
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.total}
            hrefFor={(p) => withParams(PATH, sp, { seite: p > 1 ? p : null, job: null })}
          />
        }
      />

      <Drawer
        open={Boolean(job)}
        closeHref={withParams(PATH, sp, { job: null })}
        title={job ? job.kindLabel : "Job"}
        description={job ? job.kind : undefined}
        width="lg"
      >
        {job ? (
          <div className="flex flex-col gap-5 p-5">
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[14px]">
              <dt className="text-admin-text-2">Status</dt>
              <dd>
                <JobStatus job={job} />
              </dd>
              <dt className="text-admin-text-2">Versuche</dt>
              <dd>
                {job.attempts} von {job.maxAttempts}
              </dd>
              <dt className="text-admin-text-2">Priorität</dt>
              <dd>{job.priority}</dd>
              <dt className="text-admin-text-2">Fällig ab</dt>
              <dd>{formatDateTime(job.runAt)}</dd>
              <dt className="text-admin-text-2">Angelegt</dt>
              <dd>{formatDateTime(job.createdAt)}</dd>
              <dt className="text-admin-text-2">Beendet</dt>
              <dd>{formatDateTime(job.finishedAt)}</dd>
              <dt className="text-admin-text-2">Worker</dt>
              <dd className="font-mono text-[13px]">{job.lockedBy ?? "–"}</dd>
              <dt className="text-admin-text-2">Bestellung</dt>
              <dd>
                {job.orderId ? (
                  <a
                    href={`/admin/bestellungen/${job.orderId}`}
                    className="text-admin-akzent hover:underline"
                  >
                    {job.orderNumber ?? job.orderId}
                  </a>
                ) : (
                  "–"
                )}
              </dd>
              <dt className="text-admin-text-2">Schlüssel</dt>
              <dd className="font-mono text-[12px] break-all">{job.idempotencyKey ?? "–"}</dd>
              {!job.known ? (
                <>
                  <dt className="text-admin-text-2">Handler</dt>
                  <dd className="text-admin-rot">
                    Für diese Art gibt es keinen Handler, der Runner holt den Job nicht.
                  </dd>
                </>
              ) : null}
            </dl>
            {job.lastError ? (
              <div>
                <h3 className="mb-2 text-[15px] font-bold">Letzte Fehlermeldung</h3>
                <pre className="rounded-admin-feld bg-admin-rot-hell p-3 font-mono text-[12px] break-all whitespace-pre-wrap">
                  {job.lastError}
                </pre>
              </div>
            ) : null}
            <div>
              <h3 className="mb-2 text-[15px] font-bold">Payload</h3>
              <pre className="rounded-admin-feld bg-admin-flaeche p-3 font-mono text-[12px] break-all whitespace-pre-wrap">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
            {["dead", "failed", "queued", "cancelled"].includes(job.status) ? (
              <div className="border-admin-rahmen flex flex-col gap-3 border-t pt-4">
                <ActionForm action={retryJobAction}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <SubmitButton pendingLabel="Wird ausgeführt …">
                    {job.status === "queued"
                      ? "Jetzt ausführen"
                      : "Wiederholen (alle Versuche neu)"}
                  </SubmitButton>
                </ActionForm>
                {job.status !== "cancelled" ? (
                  <ActionForm action={discardJobAction} className="flex flex-col gap-2">
                    <input type="hidden" name="jobId" value={job.id} />
                    <Field name="reason" label="Grund fürs Verwerfen (optional)" maxLength={300} />
                    <div>
                      <SubmitButton variant="danger" pendingLabel="…">
                        Verwerfen
                      </SubmitButton>
                    </div>
                  </ActionForm>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
