import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import { addDays, berlinMidnight } from "@/lib/admin/dashboard/period";
import {
  EMAIL_STATUS_LABELS,
  getEmailMessage,
  listEmailMessages,
  listResendEvents,
  resendEventLabel,
  type EmailLogEntry,
  type ResendEventEntry,
} from "@/lib/admin/emails/log";
import { resendSupport } from "@/lib/admin/emails/resend";
import {
  SUPPRESSION_REASON_LABELS,
  listSuppressions,
  type SuppressionEntry,
} from "@/lib/admin/emails/suppressions";
import {
  listEmailTemplates,
  renderTemplate,
  type EmailTemplateRow,
  type TemplateSource,
} from "@/lib/admin/emails/templates";
import { subjectPlaceholders } from "@/lib/admin/emails/subject";
import { isAllowlistActive } from "@/lib/admin/emails/context";
import {
  removeSuppressionAction,
  resendMessageAction,
  templateTestAction,
  toggleTemplateAction,
  updateTemplateAction,
} from "@/lib/admin/emails/ui-actions";
import { integrations } from "@/lib/integrations";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Select } from "@/components/admin/ui/fields";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { formatDateTime, formatNumber } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";
import { Timeline } from "@/components/admin/ui/Timeline";
import { EmailStatusBadge } from "@/components/admin/crm/badges";
import { InfoList, MailPreview, Notice } from "@/components/admin/crm/parts";

export const metadata: Metadata = { title: "E-Mails" };

const PATH = "/admin/emails";
const PAGE_SIZE = 50;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES = Object.keys(EMAIL_STATUS_LABELS) as (keyof typeof EMAIL_STATUS_LABELS)[];

const CATEGORY: Record<EmailTemplateRow["category"], { label: string; tone: BadgeTone }> = {
  transactional: { label: "Transaktional", tone: "blue" },
  marketing: { label: "Werbung", tone: "accent" },
  auth: { label: "Konto", tone: "gray" },
  internal: { label: "Intern", tone: "gray" },
};
const SOURCE: Record<TemplateSource, string> = {
  crm: "CRM (src/emails)",
  checkout: "Checkout",
  orders: "Bestellungen",
  konto: "Kundenkonto",
  supabase_auth: "Supabase Auth",
};

/**
 * /admin/emails: Vorlagen (Vorschau, Betreff der Werbe-Vorlagen, Testversand), Versandprotokoll
 * (Status, Resend-Ereignisse, erneut senden) und Sperrliste. Vorlagen sehen alle Rollen,
 * Protokoll und Sperrliste nur Rollen mit Kundendaten.
 */
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const sp = await searchParams;
  const canView = PERMISSIONS.viewCustomers(session);
  const tabRaw = firstParam(sp.tab);
  const tab = tabRaw === "protokoll" || tabRaw === "sperrliste" ? tabRaw : "vorlagen";
  const allowlist = await isAllowlistActive().catch(() => true);
  const mock = integrations().email.name === "mock";

  return (
    <>
      <PageHeader
        title="E-Mails"
        description="Transaktionale Vorlagen, Versandprotokoll und Sperrliste"
      />
      <div className="flex flex-col gap-4">
        <Tabs
          label="Bereiche E-Mails"
          items={[
            { label: "Vorlagen", href: PATH, active: tab === "vorlagen" },
            ...(canView
              ? [
                  {
                    label: "Protokoll",
                    href: `${PATH}?tab=protokoll`,
                    active: tab === "protokoll",
                  },
                  {
                    label: "Sperrliste",
                    href: `${PATH}?tab=sperrliste`,
                    active: tab === "sperrliste",
                  },
                ]
              : []),
          ]}
        />
        <Notice>
          Versand über Resend{mock ? " im Testmodus (Mock, es geht keine echte Mail raus)" : ""}.
          {allowlist
            ? " Bis zum Go-live gehen Mails nur an die Test-Allowlist, alle anderen werden als „Blockiert (Allowlist)“ protokolliert."
            : ""}
        </Notice>
        {tab === "vorlagen" ? <TemplatesTab sp={sp} session={session} /> : null}
        {tab === "protokoll" ? canView ? <LogTab sp={sp} session={session} /> : <NoAccess /> : null}
        {tab === "sperrliste" ? (
          canView ? (
            <SuppressionTab sp={sp} session={session} />
          ) : (
            <NoAccess />
          )
        ) : null}
      </div>
    </>
  );
}

async function TemplatesTab({ sp, session }: { sp: SearchParamsInput; session: StaffSession }) {
  const canSend = PERMISSIONS.sendNewsletter(session);
  let templates: EmailTemplateRow[] = [];
  let failed = false;
  try {
    templates = await listEmailTemplates();
  } catch (error) {
    console.error("[admin] Vorlagen", error);
    failed = true;
  }
  const key = firstParam(sp.vorlage);
  const selected = templates.find((t) => t.key === key) ?? null;
  const preview = selected?.previewable
    ? await renderTemplate(
        selected.key,
        selected.previewProps &&
          typeof selected.previewProps === "object" &&
          !Array.isArray(selected.previewProps)
          ? (selected.previewProps as Record<string, unknown>)
          : {},
      ).catch(() => null)
    : null;

  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Vorlagen konnten nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="E-Mail-Vorlagen"
        rows={templates}
        rowKey={(t) => t.key}
        rowHref={(t) => withParams(PATH, sp, { vorlage: t.key })}
        empty={<EmptyState icon="emails" title="Keine Vorlagen" />}
        columns={[
          {
            key: "name",
            header: "Vorlage",
            cell: (t) => (
              <span className="flex flex-col">
                <span>{t.name}</span>
                <span className="text-admin-text-2 font-mono text-[12px] font-normal">{t.key}</span>
              </span>
            ),
          },
          {
            key: "art",
            header: "Art",
            width: "130px",
            cell: (t) => (
              <Badge tone={CATEGORY[t.category].tone} noDot>
                {CATEGORY[t.category].label}
              </Badge>
            ),
          },
          {
            key: "betreff",
            header: "Betreff",
            hideBelowLg: true,
            cell: (t) => <span className="text-admin-text-2">{t.subjectTemplate}</span>,
          },
          {
            key: "quelle",
            header: "Inhalt aus",
            width: "150px",
            hideBelowLg: true,
            cell: (t) => SOURCE[t.source],
          },
          {
            key: "status",
            header: "Status",
            width: "120px",
            cell: (t) =>
              t.isEnabled ? (
                <Badge tone="green">Aktiv</Badge>
              ) : (
                <Badge tone="gray" hollow>
                  Aus
                </Badge>
              ),
          },
          {
            key: "versand",
            header: "30 Tage",
            align: "right",
            width: "90px",
            cell: (t) => formatNumber(t.sentLast30Days),
          },
        ]}
        renderCard={(t) => (
          <CardRow
            primary={t.name}
            secondary={t.subjectTemplate}
            secondaryAside={`${formatNumber(t.sentLast30Days)} in 30 Tagen`}
            badges={
              <>
                <Badge tone={CATEGORY[t.category].tone} noDot>
                  {CATEGORY[t.category].label}
                </Badge>
                {t.isEnabled ? null : (
                  <Badge tone="gray" hollow>
                    Aus
                  </Badge>
                )}
              </>
            }
          />
        )}
      />
      <p className="text-admin-text-2 text-[12px]">
        Absenderdomain: SPF, DKIM und DMARC richtest du bei Resend und beim DNS-Anbieter ein
        (Anleitung in docs/golive.md).
      </p>
      <Drawer
        open={Boolean(selected)}
        closeHref={withParams(PATH, sp, { vorlage: null })}
        title={selected?.name ?? "Vorlage"}
        description={
          selected
            ? `${CATEGORY[selected.category].label} · Inhalt aus ${SOURCE[selected.source]}`
            : undefined
        }
        width="lg"
      >
        {selected ? (
          <div className="flex flex-col gap-5 p-5">
            {selected.description ? <p className="text-[14px]">{selected.description}</p> : null}
            {selected.subjectEditable && canSend ? (
              <ActionForm
                action={updateTemplateAction}
                resetOnSuccess={false}
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="key" value={selected.key} />
                <Field
                  name="subject"
                  label="Betreff"
                  defaultValue={selected.subjectTemplate}
                  maxLength={150}
                  required
                  hint="Gilt für die Automation. Platzhalter: {{first_name}}"
                />
                <Field
                  name="description"
                  label="Beschreibung (intern)"
                  defaultValue={selected.description ?? ""}
                  maxLength={300}
                />
                <div>
                  <SubmitButton pendingLabel="Wird gespeichert …">Speichern</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <InfoList
                rows={[
                  { label: "Betreff", value: selected.subjectTemplate },
                  ...(subjectPlaceholders(selected.subjectTemplate).length
                    ? [
                        {
                          label: "Platzhalter",
                          value: subjectPlaceholders(selected.subjectTemplate).join(", "),
                        },
                      ]
                    : []),
                ]}
              />
            )}
            {!selected.subjectEditable ? (
              <p className="text-admin-text-2 text-[12px]">
                Text und Betreff dieser Vorlage liegen im Code ({SOURCE[selected.source]}) und sind
                hier schreibgeschützt. Pflichtmails lassen sich nicht abschalten.
              </p>
            ) : null}
            {selected.toggleable && canSend ? (
              <ActionForm action={toggleTemplateAction}>
                <input type="hidden" name="key" value={selected.key} />
                <input type="hidden" name="enabled" value={selected.isEnabled ? "false" : "true"} />
                <SubmitButton
                  variant={selected.isEnabled ? "secondary" : "primary"}
                  pendingLabel="…"
                >
                  {selected.isEnabled ? "Vorlage ausschalten" : "Vorlage einschalten"}
                </SubmitButton>
              </ActionForm>
            ) : null}
            {selected.previewable && canSend ? (
              <ActionForm
                action={templateTestAction}
                resetOnSuccess={false}
                className="flex items-end gap-2"
              >
                <input type="hidden" name="key" value={selected.key} />
                <Field
                  name="to"
                  type="email"
                  label="Testversand an"
                  defaultValue={session.email}
                  className="flex-1"
                  hint="Nur Adressen der Allowlist, mit Beispieldaten."
                />
                <SubmitButton variant="secondary" pendingLabel="…">
                  Senden
                </SubmitButton>
              </ActionForm>
            ) : null}
            {preview ? (
              <div className="flex flex-col gap-2">
                <p className="text-[13px]">
                  <span className="text-admin-text-2">Vorschau-Betreff:</span>{" "}
                  <span className="font-bold">{preview.subject}</span>
                </p>
                <MailPreview html={preview.html} title={`Vorschau ${selected.name}`} height={820} />
              </div>
            ) : (
              <p className="text-admin-text-2 text-[13px]">
                {selected.source === "supabase_auth"
                  ? "Diese Mail verschickt Supabase Auth, die Vorlage liegt im Supabase-Dashboard."
                  : "Für diese Vorlage gibt es im Backoffice keine Vorschau (Konto-Paket ohne reine Renderfunktion)."}
              </p>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

async function LogTab({ sp, session }: { sp: SearchParamsInput; session: StaffSession }) {
  const canSend = PERMISSIONS.sendNewsletter(session);
  const statusRaw = firstParam(sp.status);
  const status = (STATUSES as string[]).includes(statusRaw ?? "")
    ? (statusRaw as (typeof STATUSES)[number])
    : undefined;
  const von = firstParam(sp.von);
  const bis = firstParam(sp.bis);
  const q = firstParam(sp.q)?.trim() || undefined;
  const template = firstParam(sp.vorlage)?.slice(0, 80) || undefined;
  const page = parsePage(sp.seite);
  const messageId = firstParam(sp.nachricht);
  let result: { items: EmailLogEntry[]; total: number } = { items: [], total: 0 };
  let message: Awaited<ReturnType<typeof getEmailMessage>> = null;
  let events: ResendEventEntry[] = [];
  let failed = false;
  try {
    [result, message] = await Promise.all([
      listEmailMessages({
        q,
        status,
        template,
        from: von && DAY_RE.test(von) ? berlinMidnight(von).toISOString() : undefined,
        to: bis && DAY_RE.test(bis) ? berlinMidnight(addDays(bis, 1)).toISOString() : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      messageId && UUID.test(messageId) ? getEmailMessage(messageId) : Promise.resolve(null),
    ]);
    if (message) {
      events = await listResendEvents(message.providerMessageId);
    }
  } catch (error) {
    console.error("[admin] Versandprotokoll", error);
    failed = true;
  }
  const filtered = Boolean(status || von || bis || q || template);
  const support = message ? resendSupport(message) : null;
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Das Protokoll konnte nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Versandprotokoll"
        rows={result.items}
        rowKey={(m) => m.id}
        rowHref={(m) => withParams(PATH, sp, { nachricht: m.id })}
        toolbar={
          <FilterBar
            action={PATH}
            hidden={{ tab: "protokoll" }}
            search={{
              value: q,
              placeholder: "Empfänger oder Betreff suchen",
              label: "Protokoll durchsuchen",
            }}
            resetHref={filtered ? `${PATH}?tab=protokoll` : undefined}
          >
            <Select
              name="status"
              label="Status"
              hideLabel
              placeholder="Alle Status"
              defaultValue={status ?? ""}
              options={STATUSES.map((s) => ({ value: s, label: EMAIL_STATUS_LABELS[s] }))}
            />
            <DateInput name="von" label="Von" value={von} />
            <DateInput name="bis" label="Bis" value={bis} />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="emails"
            title={filtered ? "Keine Mails für diese Filter" : "Noch keine Mails verschickt"}
            compact
          >
            Jede Mail aus Shop und Backoffice landet hier, auch blockierte.
          </EmptyState>
        }
        columns={[
          {
            key: "zeit",
            header: "Zeitpunkt",
            width: "160px",
            cell: (m) => formatDateTime(m.createdAt),
          },
          {
            key: "empfaenger",
            header: "Empfänger",
            cell: (m) => <span className="break-all">{m.toEmail}</span>,
          },
          {
            key: "vorlage",
            header: "Vorlage",
            hideBelowLg: true,
            cell: (m) => (
              <span className="flex flex-col">
                <span className="truncate">{m.subject}</span>
                <span className="text-admin-text-2 font-mono text-[12px]">{m.template}</span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "170px",
            cell: (m) => <EmailStatusBadge status={m.status} label={m.statusLabel} />,
          },
          {
            key: "fehler",
            header: "Fehler",
            hideBelowLg: true,
            cell: (m) => <span className="text-admin-rot text-[13px]">{m.error ?? ""}</span>,
          },
        ]}
        renderCard={(m) => (
          <CardRow
            primary={<span className="break-all">{m.toEmail}</span>}
            secondary={m.subject}
            secondaryAside={formatDateTime(m.createdAt)}
            badges={<EmailStatusBadge status={m.status} label={m.statusLabel} />}
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
        open={Boolean(message)}
        closeHref={withParams(PATH, sp, { nachricht: null })}
        title={message?.subject ?? "Nachricht"}
        description={
          message ? `${formatDateTime(message.createdAt)} · ${message.template}` : undefined
        }
        width="md"
      >
        {message ? (
          <div className="flex flex-col gap-5 p-5">
            <InfoList
              rows={[
                { label: "Empfänger", value: <span className="break-all">{message.toEmail}</span> },
                {
                  label: "Absender",
                  value: <span className="break-all">{message.fromEmail}</span>,
                },
                { label: "Antwort an", value: message.replyTo ?? "–" },
                {
                  label: "Status",
                  value: <EmailStatusBadge status={message.status} label={message.statusLabel} />,
                },
                {
                  label: "Anbieter",
                  value: message.provider === "mock" ? "Mock (Testmodus)" : message.provider,
                },
                { label: "Gesendet", value: formatDateTime(message.sentAt) },
                { label: "Zugestellt", value: formatDateTime(message.deliveredAt) },
                ...(message.error
                  ? [
                      {
                        label: "Fehler",
                        value: <span className="text-admin-rot">{message.error}</span>,
                      },
                    ]
                  : []),
                ...(message.orderId
                  ? [
                      {
                        label: "Bestellung",
                        value: (
                          <Link
                            className="text-admin-akzent hover:underline"
                            href={`/admin/bestellungen/${message.orderId}`}
                          >
                            öffnen
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(message.customerId
                  ? [
                      {
                        label: "Kunde",
                        value: (
                          <Link
                            className="text-admin-akzent hover:underline"
                            href={`/admin/kunden/${message.customerId}`}
                          >
                            öffnen
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(message.campaignId
                  ? [
                      {
                        label: "Kampagne",
                        value: (
                          <Link
                            className="text-admin-akzent hover:underline"
                            href={`/admin/newsletter/kampagnen/${message.campaignId}`}
                          >
                            öffnen
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <div>
              <h3 className="mb-2 text-[15px] font-bold">Resend-Ereignisse</h3>
              {events.length === 0 ? (
                <p className="text-admin-text-2 text-[13px]">
                  Noch keine Ereignisse
                  {message.provider === "mock" ? " (im Testmodus kommen keine Webhooks)" : ""}.
                </p>
              ) : (
                <Timeline
                  items={[...events].reverse().map((e) => ({
                    id: e.id,
                    title: resendEventLabel(e.type),
                    description: e.detail ?? undefined,
                    at: e.receivedAt,
                    icon: "emails",
                    tone:
                      e.type === "email.bounced" ||
                      e.type === "email.complained" ||
                      e.type === "email.failed"
                        ? "red"
                        : e.type === "email.delivered"
                          ? "green"
                          : "default",
                  }))}
                />
              )}
            </div>
            {support ? (
              support.ok && canSend ? (
                <ActionForm action={resendMessageAction} className="flex flex-col gap-2">
                  <input type="hidden" name="messageId" value={message.id} />
                  <p className="text-admin-text-2 text-[13px]">
                    {support.label}. Der Inhalt wird neu erzeugt, Allowlist und Sperrliste gelten.
                  </p>
                  <div>
                    <SubmitButton variant="secondary" icon="upload" pendingLabel="Wird gesendet …">
                      Erneut senden
                    </SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <p className="text-admin-text-2 text-[13px]">
                  {support.ok ? "Erneut senden dürfen Owner und Admin." : support.reason}
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function DateInput({ name, label, value }: { name: string; label: string; value?: string }) {
  return (
    <label className="text-admin-text-2 flex flex-col gap-1 text-[12px]">
      <span className="sr-only">{label}</span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        aria-label={label}
        className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte text-admin-text h-11 border px-3 text-[14px] md:h-10"
      />
    </label>
  );
}

async function SuppressionTab({ sp, session }: { sp: SearchParamsInput; session: StaffSession }) {
  const canSend = PERMISSIONS.sendNewsletter(session);
  const reason = firstParam(sp.grund);
  const q = firstParam(sp.q)?.trim() || undefined;
  const page = parsePage(sp.seite);
  let result: { items: SuppressionEntry[]; total: number } = { items: [], total: 0 };
  let failed = false;
  try {
    result = await listSuppressions({ q, reason, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("[admin] Sperrliste", error);
    failed = true;
  }
  const filtered = Boolean(reason || q);
  return (
    <>
      {failed ? (
        <FormMessage tone="error">Die Sperrliste konnte nicht geladen werden.</FormMessage>
      ) : null}
      <Table
        caption="Sperrliste"
        rows={result.items}
        rowKey={(s) => s.email}
        toolbar={
          <FilterBar
            action={PATH}
            hidden={{ tab: "sperrliste" }}
            search={{ value: q, placeholder: "E-Mail suchen", label: "Sperrliste durchsuchen" }}
            resetHref={filtered ? `${PATH}?tab=sperrliste` : undefined}
          >
            <Select
              name="grund"
              label="Grund"
              hideLabel
              placeholder="Alle Gründe"
              defaultValue={reason ?? ""}
              options={Object.entries(SUPPRESSION_REASON_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon="schild"
            title={filtered ? "Keine Einträge für diese Filter" : "Die Sperrliste ist leer"}
            compact
          >
            Harte Bounces und Beschwerden landen automatisch hier und werden nicht mehr
            angeschrieben.
          </EmptyState>
        }
        columns={[
          {
            key: "email",
            header: "E-Mail",
            cell: (s) => <span className="break-all">{s.email}</span>,
          },
          {
            key: "grund",
            header: "Grund",
            width: "190px",
            cell: (s) => (
              <Badge tone={s.reason === "bounce" || s.reason === "complaint" ? "red" : "gray"}>
                {s.reasonLabel}
              </Badge>
            ),
          },
          {
            key: "quelle",
            header: "Quelle",
            hideBelowLg: true,
            cell: (s) => <span className="text-admin-text-2">{s.source ?? "–"}</span>,
          },
          { key: "seit", header: "Seit", width: "160px", cell: (s) => formatDateTime(s.createdAt) },
        ]}
        rowActions={canSend ? (s) => <RemoveSuppression email={s.email} /> : undefined}
        renderCard={(s) => (
          <div className="flex flex-col gap-2">
            <CardRow
              primary={<span className="break-all">{s.email}</span>}
              secondary={s.source ?? ""}
              secondaryAside={formatDateTime(s.createdAt)}
              badges={<Badge tone="gray">{s.reasonLabel}</Badge>}
            />
            {canSend ? <RemoveSuppression email={s.email} /> : null}
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
      <p className="text-admin-text-2 text-[12px]">
        Werbung wird bei jedem Eintrag blockiert, Bestellmails nur bei harten Bounces und manuellen
        Sperren. Entfernen ändert den Newsletter-Status nicht; eine neue Anmeldung braucht wieder
        Double Opt-in.
      </p>
    </>
  );
}

function RemoveSuppression({ email }: { email: string }) {
  return (
    <Dialog
      title="Von der Sperrliste entfernen?"
      description={email}
      trigger={{ label: "Entfernen", variant: "text" }}
      size="sm"
    >
      <ActionForm action={removeSuppressionAction} closeDialogOnSuccess hideMessage>
        <input type="hidden" name="email" value={email} />
        <DialogBody>
          <ActionFormMessage />
          <p className="text-[14px]">
            Nur entfernen, wenn das Problem behoben ist, zum Beispiel ein volles Postfach geleert
            wurde.
          </p>
          <Field name="reason" label="Grund" required maxLength={300} />
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton variant="danger" pendingLabel="…">
            Entfernen
          </SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
