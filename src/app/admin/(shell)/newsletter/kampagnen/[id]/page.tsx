import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  getCampaign,
  getCampaignAudience,
  getCampaignStats,
  listCampaignRecipients,
  previewCampaign,
  type CampaignDetail,
  type CampaignRecipientRow,
} from "@/lib/admin/newsletter/campaigns";
import { toDraft } from "@/lib/admin/newsletter/editor-form";
import { EMAIL_STATUS_LABELS } from "@/lib/admin/emails/log";
import { isAllowlistActive } from "@/lib/admin/emails/context";
import { listSegments } from "@/lib/admin/segments/segments";
import type { CampaignStats } from "@/lib/admin/newsletter/resend-events";
import { listProducts } from "@/lib/catalog/products";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDateTime, formatNumber, formatPercent } from "@/components/admin/ui/format";
import { withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { CampaignStatusBadge, EmailStatusBadge } from "@/components/admin/crm/badges";
import { CampaignEditor } from "@/components/admin/crm/CampaignEditor";
import {
  CampaignMoreActions,
  PlanCard,
  TestSendCard,
} from "@/components/admin/crm/CampaignActions";
import { InfoList, KpiCard, MailPreview, Notice } from "@/components/admin/crm/parts";

export const metadata: Metadata = { title: "Kampagne" };

const UUID = /^[0-9a-f-]{36}$/i;
const PAGE_SIZE = 50;

function audienceText(a: {
  eligible: number;
  members: number | null;
  skippedWithoutOptIn: number | null;
}) {
  const base = `${formatNumber(a.eligible)} Empfänger mit bestätigtem Opt-in`;
  return a.skippedWithoutOptIn
    ? `${base}, ${formatNumber(a.skippedWithoutOptIn)} im Segment ohne Opt-in werden übersprungen.`
    : `${base}.`;
}

function tomorrowBerlin(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
}

/**
 * /admin/newsletter/kampagnen/[id] (Figma 39:1619, mobil 35:13134). Entwürfe bearbeiten Owner und
 * Admin im Block-Editor; geplante und versendete Kampagnen sind schreibgeschützt mit Kennzahlen.
 */
export default async function KampagnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { id } = await params;
  const path = `/admin/newsletter/kampagnen/${id}`;
  const session = await requireStaff("support", { next: path });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const canSend = PERMISSIONS.sendNewsletter(session);

  let campaign: CampaignDetail | null;
  try {
    campaign = await getCampaign(id);
  } catch (error) {
    console.error("[admin] Kampagne", error);
    return (
      <>
        <PageHeader title="Kampagne" backHref="/admin/newsletter" backLabel="Newsletter" />
        <FormMessage tone="error">Die Kampagne konnte gerade nicht geladen werden.</FormMessage>
      </>
    );
  }
  if (!campaign) notFound();
  const c = campaign;
  const allowlistActive = await isAllowlistActive().catch(() => true);
  const mock = integrations().email.name === "mock";
  const editable = c.editable && canSend;

  const header = (
    <PageHeader
      backHref="/admin/newsletter"
      backLabel="Newsletter"
      title={c.name}
      meta={<CampaignStatusBadge status={c.status} label={c.statusLabel} />}
      description={
        c.sentAt
          ? `Versendet ${formatDateTime(c.sentAt)}`
          : c.scheduledAt
            ? `Geplant für ${formatDateTime(c.scheduledAt)}`
            : `Zuletzt bearbeitet ${formatDateTime(c.updatedAt)}`
      }
      actions={<CampaignMoreActions campaignId={c.id} status={c.status} canSend={canSend} />}
    />
  );
  const notice = (
    <Notice>
      Versand nur an bestätigte Kontakte (Policy: Status abonniert mit Bestätigungszeitpunkt, nicht
      auf der Sperrliste).
      {allowlistActive ? " Bis zum Go-live gehen Mails nur an die Test-Allowlist." : ""}
      {mock ? " Testmodus: Resend antwortet als Mock." : ""}
    </Notice>
  );

  if (editable) {
    const [segments, products, preview] = await Promise.all([
      listSegments().catch(() => []),
      listProducts().catch(() => []),
      previewCampaign(c.id).catch(() => ({ html: "<p>Vorschau nicht verfügbar</p>" })),
    ]);
    const audience: Record<string, string> = {};
    await Promise.all(
      [null, ...segments.slice(0, 30).map((s) => s.id)].map(async (sid) => {
        try {
          audience[sid ?? "alle"] = audienceText(await getCampaignAudience(sid));
        } catch {
          audience[sid ?? "alle"] = "Zielgruppe konnte nicht berechnet werden.";
        }
      }),
    );
    const current = await getCampaignAudience(c.segmentId).catch(() => null);
    const productOptions = products.flatMap((p) => [
      { value: p.handle, label: `${p.shortTitle} (Standard: ${p.defaultVariant.title})` },
      ...(p.variants.length > 1
        ? p.variants.map((v) => ({
            value: `${p.handle}:${v.id}`,
            label: `${p.shortTitle}: ${v.title}`,
          }))
        : []),
    ]);
    const env = serverEnv();
    return (
      <>
        {header}
        <div className="flex flex-col gap-4">
          {notice}
          <CampaignEditor
            campaignId={c.id}
            meta={{
              name: c.name,
              subject: c.subject,
              preheader: c.preheader ?? "",
              replyTo: c.replyTo ?? env.EMAIL_REPLY_TO,
              segmentId: c.segmentId ?? "",
            }}
            blocks={c.blocks.map(toDraft)}
            segments={segments.map((s) => ({ value: s.id, label: s.name }))}
            audience={audience}
            products={productOptions}
            productNames={Object.fromEntries(products.map((p) => [p.handle, p.shortTitle]))}
            fromEmail={c.fromEmail ?? env.EMAIL_FROM_NEWSLETTER}
            initialHtml={preview.html}
            aside={
              <>
                <TestSendCard
                  campaignId={c.id}
                  defaultTo={session.email}
                  allowlistHint={`Nur an Adressen der Allowlist (${
                    env.EMAIL_ALLOWLIST.split(",")
                      .filter((e) => e.trim() && e.trim() !== "*")
                      .join(", ") || "keine gesetzt"
                  }).${c.testSentAt ? ` Letzter Test ${formatDateTime(c.testSentAt)}.` : ""}`}
                />
                <PlanCard
                  campaignId={c.id}
                  recipients={current?.eligible ?? 0}
                  recipientsText={current ? audienceText(current) : "Zielgruppe unbekannt"}
                  allowlistActive={allowlistActive}
                  defaultDate={tomorrowBerlin()}
                />
              </>
            }
          />
        </div>
      </>
    );
  }

  // Schreibgeschützt: Kennzahlen, Vorschau, Empfänger
  const page = parsePage(sp.seite);
  const showStats =
    c.status === "sent" ||
    c.status === "sending" ||
    c.status === "cancelled" ||
    c.status === "failed";
  let stats: CampaignStats | null = null;
  let recipients: { items: CampaignRecipientRow[]; total: number } = { items: [], total: 0 };
  const [preview] = await Promise.all([
    previewCampaign(c.id).catch(() => ({ html: "<p>Vorschau nicht verfügbar</p>" })),
    showStats
      ? Promise.all([
          getCampaignStats(c.id).then((s) => (stats = s)),
          listCampaignRecipients(c.id, { page, pageSize: PAGE_SIZE }).then((r) => (recipients = r)),
        ]).catch((e) => console.error("[admin] Kennzahlen", e))
      : Promise.resolve(),
  ]);
  const s = stats as CampaignStats | null;
  const r = recipients as { items: CampaignRecipientRow[]; total: number };

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        {notice}
        {!canSend && c.editable ? (
          <FormMessage tone="info">
            Kampagnen bearbeiten und versenden dürfen Owner und Admin. Du siehst den Entwurf nur.
          </FormMessage>
        ) : null}
        {s ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Empfänger"
              value={formatNumber(s.recipients)}
              hint={`${formatNumber(s.blocked)} blockiert (Allowlist)`}
            />
            <KpiCard
              label="Zugestellt"
              value={formatNumber(s.delivered)}
              hint={`${formatNumber(s.sent)} gesendet`}
            />
            <KpiCard
              label="Öffnungen"
              value={formatPercent(s.openRate)}
              hint={`${formatNumber(s.opened)} Kontakte`}
            />
            <KpiCard
              label="Klicks"
              value={formatPercent(s.clickRate)}
              hint={`${formatNumber(s.clicked)} Kontakte`}
            />
            <KpiCard
              label="Bounces"
              value={formatPercent(s.bounceRate)}
              hint={`${formatNumber(s.bounced)} Adressen, ${formatNumber(s.complained)} Beschwerden`}
            />
            <KpiCard
              label="Abmeldungen"
              value={formatNumber(s.unsubscribed)}
              hint={`${formatNumber(s.queued)} noch in Warteschlange`}
            />
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card title="Vorschau" flush>
            <div className="bg-admin-flaeche flex justify-center p-3">
              <MailPreview
                html={preview.html}
                title="Vorschau der Kampagne"
                className="max-w-[640px]"
                height={760}
              />
            </div>
          </Card>
          <Card title="Details">
            <InfoList
              rows={[
                { label: "Betreff", value: c.subject },
                { label: "Vorschautext", value: c.preheader ?? "–" },
                { label: "Absender", value: c.fromEmail ?? "–" },
                { label: "Antwort an", value: c.replyTo ?? "–" },
                {
                  label: "Zielgruppe",
                  value: c.segmentName
                    ? `Segment „${c.segmentName}“`
                    : c.segmentId
                      ? "Segment gelöscht (Schnappschuss)"
                      : "Alle mit Einwilligung",
                },
                { label: "Geplant", value: formatDateTime(c.scheduledAt) },
                { label: "Versendet", value: formatDateTime(c.sentAt) },
                { label: "Letzter Test", value: formatDateTime(c.testSentAt) },
              ]}
            />
          </Card>
        </div>
        {showStats ? (
          <Table
            caption="Empfänger der Kampagne"
            rows={r.items}
            rowKey={(x) => x.contactId}
            empty={<EmptyState icon="newsletter" title="Noch keine Empfänger" compact />}
            columns={[
              {
                key: "email",
                header: "Empfänger",
                cell: (x) => <span className="break-all">{x.email}</span>,
              },
              {
                key: "status",
                header: "Status",
                width: "170px",
                cell: (x) => (
                  <EmailStatusBadge status={x.status} label={EMAIL_STATUS_LABELS[x.status]} />
                ),
              },
              {
                key: "gesendet",
                header: "Gesendet",
                width: "150px",
                cell: (x) => formatDateTime(x.sentAt),
              },
              {
                key: "geoeffnet",
                header: "Geöffnet",
                width: "150px",
                hideBelowLg: true,
                cell: (x) => formatDateTime(x.openedAt),
              },
              {
                key: "klick",
                header: "Klick",
                width: "150px",
                hideBelowLg: true,
                cell: (x) => formatDateTime(x.clickedAt),
              },
              {
                key: "fehler",
                header: "Hinweis",
                cell: (x) => (
                  <span className="text-admin-text-2 text-[13px]">
                    {x.error ?? (x.unsubscribedAt ? "abgemeldet" : "")}
                  </span>
                ),
              },
            ]}
            renderCard={(x) => (
              <CardRow
                primary={<span className="break-all">{x.email}</span>}
                secondary={x.error ?? formatDateTime(x.sentAt)}
                badges={
                  <EmailStatusBadge status={x.status} label={EMAIL_STATUS_LABELS[x.status]} />
                }
              />
            )}
            footer={
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={r.total}
                hrefFor={(p) => withParams(path, sp, { seite: p > 1 ? p : null })}
              />
            }
          />
        ) : null}
      </div>
    </>
  );
}
