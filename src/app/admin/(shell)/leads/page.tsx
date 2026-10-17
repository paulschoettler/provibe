import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listLeads, type LeadListItem } from "@/lib/admin/leads/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/admin/leads/status";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUS_LABELS,
  getContactMessage,
  getWithdrawal,
  listContactMessages,
  listWithdrawals,
  type ContactMessageItem,
  type ContactStatus,
  type WithdrawalItem,
  type WithdrawalStatus,
} from "@/lib/admin/leads/inbox";
import {
  bulkLeadStatusAction,
  contactMessageStatusAction,
  withdrawalStatusAction,
} from "@/lib/admin/leads/ui-actions";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDate, formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";
import { LeadStatusBadge } from "@/components/admin/crm/badges";
import { InfoList } from "@/components/admin/crm/parts";

export const metadata: Metadata = { title: "Leads" };

const PATH = "/admin/leads";
const PAGE_SIZE = 50;
const UUID = /^[0-9a-f-]{36}$/i;

const CONTACT_TONE: Record<ContactStatus, BadgeTone> = {
  new: "accent",
  answered: "green",
  spam: "gray",
  archived: "gray",
};
const WITHDRAWAL_TONE: Record<WithdrawalStatus, BadgeTone> = {
  received: "accent",
  confirmed: "blue",
  processed: "green",
  rejected: "gray",
};

/**
 * /admin/leads (Figma 35:9444, mobil 35:3204): Partner- und B2B-Anfragen mit Status (H18),
 * dazu die Tabs Kontaktanfragen (contact_messages) und Widerrufe (withdrawal_requests).
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const sp = await searchParams;
  const tabRaw = firstParam(sp.tab);
  const tab = tabRaw === "kontakt" || tabRaw === "widerrufe" ? tabRaw : "leads";
  const [contactsOpen, withdrawalsOpen] = await Promise.all([
    listContactMessages({ pageSize: 1 })
      .then((r) => r.open)
      .catch(() => undefined),
    listWithdrawals({ pageSize: 1 })
      .then((r) => r.open)
      .catch(() => undefined),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Partner- und B2B-Anfragen, Kontaktanfragen und Widerrufe"
      />
      <div className="flex flex-col gap-4">
        <Tabs
          label="Posteingang"
          items={[
            { label: "Partneranfragen", href: PATH, active: tab === "leads" },
            {
              label: "Kontaktanfragen",
              href: `${PATH}?tab=kontakt`,
              active: tab === "kontakt",
              count: contactsOpen || undefined,
            },
            {
              label: "Widerrufe",
              href: `${PATH}?tab=widerrufe`,
              active: tab === "widerrufe",
              count: withdrawalsOpen || undefined,
            },
          ]}
        />
        {tab === "leads" ? <LeadsTab sp={sp} /> : null}
        {tab === "kontakt" ? <ContactTab sp={sp} /> : null}
        {tab === "widerrufe" ? <WithdrawalTab sp={sp} /> : null}
      </div>
    </>
  );
}

async function LeadsTab({ sp }: { sp: SearchParamsInput }) {
  const statusRaw = firstParam(sp.status);
  const status = (LEAD_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as LeadStatus)
    : undefined;
  const q = firstParam(sp.q)?.trim() || undefined;
  const page = parsePage(sp.seite);
  let result: { items: LeadListItem[]; total: number; counts: Record<LeadStatus, number> } = {
    items: [],
    total: 0,
    counts: { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 },
  };
  let failed = false;
  try {
    result = await listLeads({ status, q, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("[admin] Leads", error);
    failed = true;
  }
  const all = Object.values(result.counts).reduce((a, b) => a + b, 0);
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Leads konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Partner- und B2B-Anfragen"
        rows={result.items}
        rowKey={(l) => l.id}
        rowHref={(l) => `${PATH}/${l.id}`}
        selection={{
          formId: "leads-sammel",
          value: (l) => l.id,
          label: (l) => `${l.company ?? l.contactName} auswählen`,
        }}
        toolbar={
          <>
            <FilterBar
              action={PATH}
              chipsLabel="Status"
              chips={[
                {
                  label: "Alle",
                  href: withParams(PATH, sp, { status: null, seite: null }),
                  active: !status,
                  count: all,
                },
                ...LEAD_STATUSES.map((s) => ({
                  label: LEAD_STATUS_LABELS[s],
                  href: withParams(PATH, sp, { status: s, seite: null }),
                  active: status === s,
                  count: result.counts[s],
                })),
              ]}
              hidden={{ status }}
              search={{
                value: q,
                placeholder: "Firma, Ansprechpartner oder E-Mail suchen",
                label: "Leads suchen",
              }}
              resetHref={q ? withParams(PATH, sp, { q: null, seite: null }) : undefined}
            />
            <ActionForm
              id="leads-sammel"
              action={bulkLeadStatusAction}
              className="flex flex-wrap items-end gap-2 px-3 pb-3"
            >
              <Select
                name="status"
                label="Status für Auswahl"
                hideLabel
                defaultValue="contacted"
                options={LEAD_STATUSES.map((s) => ({
                  value: s,
                  label: `Auf „${LEAD_STATUS_LABELS[s]}“ setzen`,
                }))}
                className="w-56"
              />
              <SubmitButton variant="secondary" pendingLabel="…">
                Auswahl ändern
              </SubmitButton>
            </ActionForm>
          </>
        }
        empty={
          <EmptyState
            icon="leads"
            title={status || q ? "Keine Leads für diese Filter" : "Noch keine Leads"}
          >
            Anfragen aus dem Partnerformular erscheinen hier mit Status Neu.
          </EmptyState>
        }
        columns={[
          { key: "firma", header: "Firma", cell: (l) => l.company ?? "ohne Firma" },
          { key: "kontakt", header: "Ansprechpartner", cell: (l) => l.contactName },
          {
            key: "art",
            header: "Art des Geschäfts",
            hideBelowLg: true,
            cell: (l) => l.locationType ?? "–",
          },
          {
            key: "quelle",
            header: "Quelle",
            width: "130px",
            hideBelowLg: true,
            cell: (l) => (l.kind === "partner" ? "Partnerformular" : l.kind),
          },
          { key: "datum", header: "Datum", width: "110px", cell: (l) => formatDate(l.createdAt) },
          {
            key: "status",
            header: "Status",
            width: "130px",
            cell: (l) => <LeadStatusBadge status={l.status} />,
          },
        ]}
        renderCard={(l) => (
          <CardRow
            primary={l.company ?? l.contactName}
            secondary={`${l.contactName}${l.locationType ? ` · ${l.locationType}` : ""}`}
            secondaryAside={formatDate(l.createdAt)}
            badges={<LeadStatusBadge status={l.status} />}
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

async function ContactTab({ sp }: { sp: SearchParamsInput }) {
  const statusRaw = firstParam(sp.status);
  const status =
    statusRaw === "alle"
      ? undefined
      : (CONTACT_STATUSES as readonly string[]).includes(statusRaw ?? "")
        ? (statusRaw as ContactStatus)
        : "new";
  const q = firstParam(sp.q)?.trim() || undefined;
  const page = parsePage(sp.seite);
  const entryId = firstParam(sp.eintrag);
  let result: { items: ContactMessageItem[]; total: number; open: number } = {
    items: [],
    total: 0,
    open: 0,
  };
  let entry: ContactMessageItem | null = null;
  let failed = false;
  try {
    [result, entry] = await Promise.all([
      listContactMessages({ status, q, page, pageSize: PAGE_SIZE }),
      entryId && UUID.test(entryId) ? getContactMessage(entryId) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("[admin] Kontaktanfragen", error);
    failed = true;
  }
  const base = `${PATH}?tab=kontakt`;
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Kontaktanfragen konnten nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Kontaktanfragen"
        rows={result.items}
        rowKey={(m) => m.id}
        rowHref={(m) => withParams(PATH, sp, { eintrag: m.id })}
        selection={{
          formId: "kontakt-sammel",
          value: (m) => m.id,
          label: (m) => `Nachricht von ${m.name} auswählen`,
        }}
        toolbar={
          <>
            <FilterBar
              action={PATH}
              hidden={{ tab: "kontakt", status: statusRaw }}
              chipsLabel="Status"
              chips={[
                ...CONTACT_STATUSES.map((s) => ({
                  label: CONTACT_STATUS_LABELS[s],
                  href: withParams(PATH, sp, {
                    status: s === "new" ? null : s,
                    seite: null,
                    eintrag: null,
                  }),
                  active: status === s,
                  count: s === "new" ? result.open : undefined,
                })),
                {
                  label: "Alle",
                  href: withParams(PATH, sp, { status: "alle", seite: null, eintrag: null }),
                  active: !status,
                },
              ]}
              search={{
                value: q,
                placeholder: "Name, E-Mail oder Text suchen",
                label: "Kontaktanfragen suchen",
              }}
              resetHref={q ? base : undefined}
            />
            <ActionForm
              id="kontakt-sammel"
              action={contactMessageStatusAction}
              className="flex flex-wrap gap-2 px-3 pb-3"
            >
              <input
                type="hidden"
                name="status"
                value={status === "answered" ? "new" : "answered"}
              />
              <SubmitButton variant="secondary" icon="haken" pendingLabel="…">
                {status === "answered" ? "Wieder öffnen" : "Als erledigt markieren"}
              </SubmitButton>
            </ActionForm>
          </>
        }
        empty={
          <EmptyState icon="emails" title="Keine Kontaktanfragen">
            Nachrichten aus dem Kontaktformular erscheinen hier.
          </EmptyState>
        }
        columns={[
          { key: "name", header: "Name", cell: (m) => m.name },
          {
            key: "email",
            header: "E-Mail",
            cell: (m) => <span className="text-admin-text-2 break-all">{m.email}</span>,
          },
          {
            key: "betreff",
            header: "Betreff",
            hideBelowLg: true,
            cell: (m) =>
              m.subject ?? <span className="text-admin-text-2">{m.message.slice(0, 50)}</span>,
          },
          {
            key: "datum",
            header: "Eingang",
            width: "150px",
            cell: (m) => formatDateTime(m.createdAt),
          },
          {
            key: "status",
            header: "Status",
            width: "110px",
            cell: (m) => (
              <Badge tone={CONTACT_TONE[m.status]}>{CONTACT_STATUS_LABELS[m.status]}</Badge>
            ),
          },
        ]}
        renderCard={(m) => (
          <CardRow
            primary={m.name}
            secondary={m.subject ?? m.message.slice(0, 60)}
            secondaryAside={formatDate(m.createdAt)}
            badges={<Badge tone={CONTACT_TONE[m.status]}>{CONTACT_STATUS_LABELS[m.status]}</Badge>}
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
      <Drawer
        open={Boolean(entry)}
        closeHref={withParams(PATH, sp, { eintrag: null })}
        title={entry ? `Nachricht von ${entry.name}` : "Nachricht"}
        description={
          entry ? `Eingang ${formatDateTime(entry.createdAt)} · Kontaktformular` : undefined
        }
      >
        {entry ? (
          <div className="flex flex-col gap-5 p-5">
            <InfoList
              rows={[
                { label: "Name", value: entry.name },
                {
                  label: "E-Mail",
                  value: (
                    <a
                      className="text-admin-akzent break-all hover:underline"
                      href={`mailto:${entry.email}`}
                    >
                      {entry.email}
                    </a>
                  ),
                },
                {
                  label: "Telefon",
                  value: entry.phone ? (
                    <a
                      className="text-admin-akzent hover:underline"
                      href={`tel:${entry.phone.replace(/[^+0-9]/g, "")}`}
                    >
                      {entry.phone}
                    </a>
                  ) : (
                    "nicht angegeben"
                  ),
                },
                { label: "Betreff", value: entry.subject ?? "–" },
                {
                  label: "Status",
                  value: (
                    <Badge tone={CONTACT_TONE[entry.status]}>
                      {CONTACT_STATUS_LABELS[entry.status]}
                    </Badge>
                  ),
                },
              ]}
            />
            <div>
              <h3 className="mb-2 text-[15px] font-bold">Nachricht</h3>
              <p className="rounded-admin-feld bg-admin-flaeche p-3 text-[14px] leading-[1.55] break-words whitespace-pre-line">
                {entry.message}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${entry.email}?subject=${encodeURIComponent(`Re: ${entry.subject ?? "Deine Nachricht an provibe"}`)}`}
                className={buttonClasses("secondary", "md")}
              >
                <Icon name="emails" size={16} />
                Per E-Mail antworten
              </a>
              {(["answered", "new", "spam", "archived"] as const)
                .filter((s) => s !== entry.status)
                .map((s) => (
                  <ActionForm key={s} action={contactMessageStatusAction}>
                    <input type="hidden" name="ids" value={entry.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton
                      variant={s === "answered" ? "primary" : "secondary"}
                      pendingLabel="…"
                    >
                      {s === "answered"
                        ? "Erledigt"
                        : s === "new"
                          ? "Wieder öffnen"
                          : s === "spam"
                            ? "Spam"
                            : "Archivieren"}
                    </SubmitButton>
                  </ActionForm>
                ))}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

async function WithdrawalTab({ sp }: { sp: SearchParamsInput }) {
  const statusRaw = firstParam(sp.status);
  const status = (WITHDRAWAL_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as WithdrawalStatus)
    : undefined;
  const q = firstParam(sp.q)?.trim() || undefined;
  const page = parsePage(sp.seite);
  const entryId = firstParam(sp.eintrag);
  let result: { items: WithdrawalItem[]; total: number; open: number } = {
    items: [],
    total: 0,
    open: 0,
  };
  let entry: WithdrawalItem | null = null;
  let failed = false;
  try {
    [result, entry] = await Promise.all([
      listWithdrawals({ status, q, page, pageSize: PAGE_SIZE }),
      entryId && UUID.test(entryId) ? getWithdrawal(entryId) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("[admin] Widerrufe", error);
    failed = true;
  }
  const orderLink = (w: WithdrawalItem) =>
    w.orderId ? (
      <Link
        href={`/admin/bestellungen/${w.orderId}`}
        className="text-admin-akzent relative z-10 hover:underline"
      >
        {w.orderNumber ?? "Bestellung"}
      </Link>
    ) : (
      <span>{w.orderNumber ?? "–"}</span>
    );
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Widerrufe konnten nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Widerrufe"
        rows={result.items}
        rowKey={(w) => w.id}
        rowHref={(w) => withParams(PATH, sp, { eintrag: w.id })}
        toolbar={
          <FilterBar
            action={PATH}
            hidden={{ tab: "widerrufe", status }}
            chipsLabel="Status"
            chips={[
              {
                label: "Alle",
                href: withParams(PATH, sp, { status: null, seite: null, eintrag: null }),
                active: !status,
              },
              ...WITHDRAWAL_STATUSES.map((s) => ({
                label: WITHDRAWAL_STATUS_LABELS[s],
                href: withParams(PATH, sp, { status: s, seite: null, eintrag: null }),
                active: status === s,
              })),
            ]}
            search={{
              value: q,
              placeholder: "Name, E-Mail oder Bestellnummer suchen",
              label: "Widerrufe suchen",
            }}
            resetHref={q ? `${PATH}?tab=widerrufe` : undefined}
          />
        }
        empty={
          <EmptyState icon="stornieren" title="Keine Widerrufe">
            Widerrufe aus dem Formular /pages/widerruf-formular erscheinen hier.
          </EmptyState>
        }
        columns={[
          { key: "name", header: "Name", cell: (w) => w.customerName },
          { key: "bestellung", header: "Bestellung", width: "130px", cell: orderLink },
          {
            key: "artikel",
            header: "Artikel",
            hideBelowLg: true,
            cell: (w) => (
              <span className="text-admin-text-2 line-clamp-1">{w.itemsDescription}</span>
            ),
          },
          {
            key: "eingang",
            header: "Eingang",
            width: "150px",
            cell: (w) => formatDateTime(w.createdAt),
          },
          {
            key: "bestaetigung",
            header: "Eingangsbestätigung",
            width: "160px",
            hideBelowLg: true,
            cell: (w) => formatDateTime(w.confirmationEmailSentAt, "nicht gesendet"),
          },
          {
            key: "status",
            header: "Status",
            width: "120px",
            cell: (w) => (
              <Badge tone={WITHDRAWAL_TONE[w.status]}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Badge>
            ),
          },
        ]}
        renderCard={(w) => (
          <CardRow
            primary={w.customerName}
            aside={w.orderNumber ?? ""}
            secondary={w.itemsDescription}
            secondaryAside={formatDate(w.createdAt)}
            badges={
              <Badge tone={WITHDRAWAL_TONE[w.status]}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Badge>
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
      <Drawer
        open={Boolean(entry)}
        closeHref={withParams(PATH, sp, { eintrag: null })}
        title={entry ? `Widerruf von ${entry.customerName}` : "Widerruf"}
        description={entry ? `Eingang ${formatDateTime(entry.createdAt)}` : undefined}
      >
        {entry ? (
          <div className="flex flex-col gap-5 p-5">
            <InfoList
              rows={[
                { label: "Bestellung", value: orderLink(entry) },
                {
                  label: "E-Mail",
                  value: (
                    <a
                      className="text-admin-akzent break-all hover:underline"
                      href={`mailto:${entry.email}`}
                    >
                      {entry.email}
                    </a>
                  ),
                },
                { label: "Anschrift", value: entry.address ?? "–" },
                { label: "Bestellt am", value: formatDate(entry.orderedOn) },
                { label: "Erhalten am", value: formatDate(entry.receivedOn) },
                {
                  label: "Eingangsbestätigung",
                  value: formatDateTime(entry.confirmationEmailSentAt, "nicht gesendet"),
                },
              ]}
            />
            <div>
              <h3 className="mb-2 text-[15px] font-bold">Widerrufene Waren</h3>
              <p className="rounded-admin-feld bg-admin-flaeche p-3 text-[14px] whitespace-pre-line">
                {entry.itemsDescription}
              </p>
            </div>
            {entry.message ? (
              <div>
                <h3 className="mb-2 text-[15px] font-bold">Nachricht</h3>
                <p className="rounded-admin-feld bg-admin-flaeche p-3 text-[14px] whitespace-pre-line">
                  {entry.message}
                </p>
              </div>
            ) : null}
            <ActionForm action={withdrawalStatusAction} className="flex items-end gap-2">
              <input type="hidden" name="id" value={entry.id} />
              <Select
                name="status"
                label="Status"
                defaultValue={entry.status}
                options={WITHDRAWAL_STATUSES.map((s) => ({
                  value: s,
                  label: WITHDRAWAL_STATUS_LABELS[s],
                }))}
                className="flex-1"
              />
              <SubmitButton pendingLabel="…">Speichern</SubmitButton>
            </ActionForm>
            <p className="text-admin-text-2 text-[12px]">
              Erstattung und Rücksendung laufen in der Bestellung. Der Status hier dokumentiert nur
              den Bearbeitungsstand.
            </p>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
