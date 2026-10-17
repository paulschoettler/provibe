import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  CAMPAIGN_STATUS_LABELS,
  listCampaigns,
  type CampaignListItem,
  type CampaignStatus,
} from "@/lib/admin/newsletter/campaigns";
import {
  getContactStats,
  listNewsletterContacts,
  type NewsletterContactItem,
} from "@/lib/admin/newsletter/contacts";
import { NEWSLETTER_SOURCE_LABEL, NEWSLETTER_STATUS_LABEL } from "@/lib/admin/customers/profile";
import { isAllowlistActive } from "@/lib/admin/emails/context";
import { integrations } from "@/lib/integrations";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";
import { CampaignStatusBadge, NewsletterBadge } from "@/components/admin/crm/badges";
import { CsvImport } from "@/components/admin/crm/CsvImport";
import { KpiCard, Notice } from "@/components/admin/crm/parts";
import { UnsubscribeDialog } from "@/components/admin/crm/UnsubscribeDialog";

export const metadata: Metadata = { title: "Newsletter" };

const PATH = "/admin/newsletter";
const PAGE_SIZE = 50;
const CONTACT_STATUSES = [
  "subscribed",
  "pending",
  "unsubscribed",
  "bounced",
  "complained",
] as const;
const CAMPAIGN_FILTER: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
  "failed",
];

/**
 * /admin/newsletter (Figma 38:1457, mobil 35:11970): Tabs Kampagnen und Kontakte.
 * Versand nur an Kontakte mit bestätigter Einwilligung, bis zum Go-live nur an die Allowlist.
 */
export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const canSend = PERMISSIONS.sendNewsletter(session);
  const sp = await searchParams;
  const tab = firstParam(sp.tab) === "kontakte" ? "kontakte" : "kampagnen";
  const [stats, allowlist] = await Promise.all([
    getContactStats().catch(() => null),
    isAllowlistActive().catch(() => true),
  ]);
  const mock = integrations().email.name === "mock";

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Kampagnen über Resend mit Kennzahlen aus den Webhooks"
        actions={
          canSend ? (
            <div className="flex flex-wrap gap-2">
              <CsvImport defaultOpen={firstParam(sp.import) === "1"} />
              <ButtonLink href={`${PATH}/kampagnen/neu`} variant="primary" icon="plus">
                Kampagne erstellen
              </ButtonLink>
            </div>
          ) : null
        }
      />
      <div className="flex flex-col gap-4">
        <Tabs
          label="Bereiche Newsletter"
          items={[
            { label: "Kampagnen", href: PATH, active: tab === "kampagnen" },
            {
              label: "Kontakte",
              href: `${PATH}?tab=kontakte`,
              active: tab === "kontakte",
              count: stats
                ? formatNumber(CONTACT_STATUSES.reduce((sum, s) => sum + stats[s], 0))
                : undefined,
            },
            { label: "Automationen", href: "/admin/automationen" },
          ]}
        />
        {stats ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Bestätigt"
              value={formatNumber(stats.sendable)}
              hint="versandfähig (Double Opt-in oder Shopify-Import)"
            />
            <KpiCard
              label="Ausstehend"
              value={formatNumber(stats.pending)}
              hint="Bestätigung offen, kein Versand"
            />
            <KpiCard
              label="Abgemeldet"
              value={formatNumber(stats.unsubscribed)}
              hint="werden nie angeschrieben"
            />
            <KpiCard
              label="Bounces und Beschwerden"
              value={formatNumber(stats.bounced + stats.complained)}
              hint={`automatisch gesperrt, Sperrliste: ${formatNumber(stats.suppressed)}`}
            />
          </div>
        ) : null}
        <Notice>
          Versand nur an bestätigte Kontakte. Ausstehende, abgemeldete und gebouncte Adressen werden
          bei jeder Kampagne automatisch ausgeschlossen.
          {allowlist ? " Bis zum Go-live gehen Mails nur an die Test-Allowlist." : ""}
          {mock ? " Testmodus: Resend antwortet als Mock, es geht keine echte Mail raus." : ""}
        </Notice>
        {tab === "kampagnen" ? <Campaigns sp={sp} /> : <Contacts sp={sp} canSend={canSend} />}
      </div>
    </>
  );
}

function rate(v: number | undefined, base: number | undefined): string {
  if (!base || v === undefined) return "–";
  return formatPercent((v / base) * 100);
}

async function Campaigns({ sp }: { sp: SearchParamsInput }) {
  const status = firstParam(sp.status) as CampaignStatus | undefined;
  const q = firstParam(sp.q)?.trim().toLowerCase();
  let rows: CampaignListItem[] = [];
  let failed = false;
  try {
    rows = await listCampaigns(status && CAMPAIGN_FILTER.includes(status) ? { status } : {});
  } catch (error) {
    console.error("[admin] Kampagnen", error);
    failed = true;
  }
  if (q) rows = rows.filter((c) => `${c.name} ${c.subject}`.toLowerCase().includes(q));
  const audience = (c: CampaignListItem) =>
    c.segmentName
      ? `Segment „${c.segmentName}“`
      : c.segmentId
        ? "Segment gelöscht"
        : "Alle bestätigten Kontakte";
  const dateOf = (c: CampaignListItem) =>
    c.sentAt
      ? formatDateTime(c.sentAt)
      : c.scheduledAt
        ? formatDateTime(c.scheduledAt)
        : `bearbeitet ${formatDate(c.updatedAt)}`;
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Kampagnen konnten nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Kampagnen"
        rows={rows}
        rowKey={(c) => c.id}
        rowHref={(c) => `${PATH}/kampagnen/${c.id}`}
        toolbar={
          <FilterBar
            action={PATH}
            search={{
              value: firstParam(sp.q),
              placeholder: "Kampagne suchen",
              label: "Kampagne suchen",
            }}
            resetHref={status || q ? PATH : undefined}
          >
            <Select
              name="status"
              label="Status"
              hideLabel
              placeholder="Status"
              defaultValue={status ?? ""}
              options={CAMPAIGN_FILTER.map((s) => ({ value: s, label: CAMPAIGN_STATUS_LABELS[s] }))}
            />
          </FilterBar>
        }
        empty={
          <EmptyState icon="newsletter" title="Noch keine Kampagnen">
            Lege eine Kampagne an, gestalte sie mit dem Block-Editor und teste sie an eine
            Allowlist-Adresse.
          </EmptyState>
        }
        columns={[
          {
            key: "kampagne",
            header: "Kampagne",
            cell: (c) => (
              <span className="flex flex-col">
                <span>{c.name}</span>
                <span className="text-admin-text-2 text-[12px] font-normal">{audience(c)}</span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "130px",
            cell: (c) => <CampaignStatusBadge status={c.status} label={c.statusLabel} />,
          },
          { key: "datum", header: "Datum", width: "170px", cell: dateOf },
          {
            key: "empfaenger",
            header: "Empfänger",
            align: "right",
            width: "100px",
            cell: (c) => (c.recipientsCount ? formatNumber(c.recipientsCount) : "–"),
          },
          {
            key: "zustellung",
            header: "Zustellung",
            align: "right",
            width: "100px",
            hideBelowLg: true,
            cell: (c) => rate(c.stats.delivered, c.stats.sent || c.recipientsCount),
          },
          {
            key: "oeffnungen",
            header: "Öffnungen",
            align: "right",
            width: "100px",
            cell: (c) => (c.stats.delivered ? formatPercent(c.stats.openRate ?? 0) : "–"),
          },
          {
            key: "klicks",
            header: "Klicks",
            align: "right",
            width: "80px",
            cell: (c) => (c.stats.delivered ? formatPercent(c.stats.clickRate ?? 0) : "–"),
          },
          {
            key: "abmeldungen",
            header: "Abmeldungen",
            align: "right",
            width: "110px",
            hideBelowLg: true,
            cell: (c) => rate(c.stats.unsubscribed, c.stats.delivered),
          },
          {
            key: "bounces",
            header: "Bounces",
            align: "right",
            width: "90px",
            hideBelowLg: true,
            cell: (c) => (c.stats.sent ? formatPercent(c.stats.bounceRate ?? 0) : "–"),
          },
        ]}
        renderCard={(c) => (
          <CardRow
            primary={c.name}
            secondary={audience(c)}
            secondaryAside={dateOf(c)}
            badges={
              <>
                <CampaignStatusBadge status={c.status} label={c.statusLabel} />
                {c.stats.delivered ? (
                  <span className="text-admin-text-2 text-[12px]">
                    {formatNumber(c.recipientsCount)} Empfänger · Öffnungen{" "}
                    {formatPercent(c.stats.openRate ?? 0)} · Klicks{" "}
                    {formatPercent(c.stats.clickRate ?? 0)}
                  </span>
                ) : null}
              </>
            }
          />
        )}
      />
      <p className="text-admin-text-2 text-[12px]">
        Kennzahlen kommen aus den Resend-Webhooks (delivered, opened, clicked, bounced, complained).
        Öffnungsraten sind wegen Apple Mail Privacy Protection nur Richtwerte; Öffnungs- und
        Klickmessung bleibt bis zur Freigabe des Einwilligungstextes aus (I12).
      </p>
    </>
  );
}

async function Contacts({ sp, canSend }: { sp: SearchParamsInput; canSend: boolean }) {
  const statusRaw = firstParam(sp.status);
  const status = (CONTACT_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as (typeof CONTACT_STATUSES)[number])
    : undefined;
  const source = firstParam(sp.quelle)?.slice(0, 30) || undefined;
  const sendable = firstParam(sp.versandfaehig) === "1";
  const q = firstParam(sp.q)?.trim() || undefined;
  const page = parsePage(sp.seite);
  let result: { items: NewsletterContactItem[]; total: number } = { items: [], total: 0 };
  let failed = false;
  try {
    result = await listNewsletterContacts({
      q,
      status,
      source,
      sendable: sendable || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("[admin] Newsletter-Kontakte", error);
    failed = true;
  }
  const base = `${PATH}?tab=kontakte`;
  const filtered = Boolean(status || source || sendable || q);
  const returnPath = "/admin/newsletter?tab=kontakte";
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Kontakte konnten nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Newsletter-Kontakte"
        rows={result.items}
        rowKey={(c) => c.id}
        toolbar={
          <FilterBar
            action={PATH}
            hidden={{ tab: "kontakte" }}
            search={{
              value: q,
              placeholder: "E-Mail oder Vorname suchen",
              label: "Kontakte suchen",
            }}
            resetHref={filtered ? base : undefined}
          >
            <Select
              name="status"
              label="Status"
              hideLabel
              placeholder="Alle Status"
              defaultValue={status ?? ""}
              options={CONTACT_STATUSES.map((s) => ({
                value: s,
                label: NEWSLETTER_STATUS_LABEL[s],
              }))}
            />
            <Select
              name="quelle"
              label="Quelle"
              hideLabel
              placeholder="Alle Quellen"
              defaultValue={source ?? ""}
              options={Object.entries(NEWSLETTER_SOURCE_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              name="versandfaehig"
              label="Versandfähig"
              hideLabel
              placeholder="Versandfähig und andere"
              defaultValue={sendable ? "1" : ""}
              options={[{ value: "1", label: "Nur versandfähige" }]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="newsletter"
            title={filtered ? "Keine Kontakte für diese Filter" : "Noch keine Kontakte"}
          >
            {filtered
              ? "Ändere die Filter oder setze sie zurück."
              : canSend
                ? "Kontakte entstehen über das Anmeldeformular (Double Opt-in) oder per CSV-Import."
                : "Kontakte entstehen über das Anmeldeformular (Double Opt-in)."}
          </EmptyState>
        }
        columns={[
          {
            key: "email",
            header: "E-Mail",
            cell: (c) => (
              <span className="flex flex-col">
                <span className="break-all">{c.email}</span>
                {c.firstName ? (
                  <span className="text-admin-text-2 text-[12px]">{c.firstName}</span>
                ) : null}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "130px",
            cell: (c) => <NewsletterBadge status={c.status} />,
          },
          { key: "quelle", header: "Quelle", width: "130px", cell: (c) => c.sourceLabel },
          {
            key: "angemeldet",
            header: "Eingetragen",
            width: "120px",
            hideBelowLg: true,
            cell: (c) => formatDate(c.createdAt),
          },
          {
            key: "bestaetigt",
            header: "Bestätigt",
            width: "150px",
            cell: (c) => (
              <span className="flex flex-col">
                <span>{formatDateTime(c.confirmedAt)}</span>
                <span className="text-admin-text-2 text-[12px]">
                  {c.proof.kind === "double_opt_in"
                    ? "Double Opt-in"
                    : c.proof.kind === "shopify_import"
                      ? "Shopify-Import"
                      : c.proof.kind === "pending"
                        ? "ausstehend"
                        : ""}
                </span>
              </span>
            ),
          },
          {
            key: "abgemeldet",
            header: "Abgemeldet",
            width: "120px",
            hideBelowLg: true,
            cell: (c) => formatDate(c.proof.unsubscribedAt),
          },
        ]}
        rowActions={(c) =>
          c.status === "subscribed" || c.status === "pending" ? (
            <UnsubscribeDialog contactId={c.id} email={c.email} returnPath={returnPath} small />
          ) : null
        }
        renderCard={(c) => (
          <div className="flex flex-col gap-2">
            <CardRow
              primary={<span className="break-all">{c.email}</span>}
              secondary={`${c.sourceLabel} · eingetragen ${formatDate(c.createdAt)}`}
              badges={<NewsletterBadge status={c.status} />}
            />
            {c.status === "subscribed" || c.status === "pending" ? (
              <UnsubscribeDialog contactId={c.id} email={c.email} returnPath={returnPath} small />
            ) : null}
          </div>
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
