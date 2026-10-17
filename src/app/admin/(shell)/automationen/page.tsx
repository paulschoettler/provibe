import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  listAutomationRuns,
  listAutomations,
  previewAutomation,
  type AutomationRunRow,
  type AutomationView,
} from "@/lib/admin/automations/automations";
import {
  AUTOMATION_CHECKS,
  AUTOMATION_KEYS,
  AUTOMATION_META,
  type AutomationKey,
} from "@/lib/admin/automations/rules";
import {
  sendAutomationTestAction,
  updateAutomationAction,
} from "@/lib/admin/automations/ui-actions";
import { maskEmail } from "@/lib/admin/newsletter/unsubscribe";
import { integrations } from "@/lib/integrations";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Select, Switch } from "@/components/admin/ui/fields";
import { formatDateTime, formatNumber } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon, type IconName } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";
import { InfoList, MailPreview, Notice } from "@/components/admin/crm/parts";
import Link from "next/link";

export const metadata: Metadata = { title: "Automationen" };

const PATH = "/admin/automationen";

const ICONS: Record<AutomationKey, IconName> = {
  welcome: "emails",
  abandoned_cart: "bestellungen",
  review_request: "glocke",
};
const TRIGGERS: Record<AutomationKey, string> = {
  welcome: "Double Opt-in bestätigt",
  abandoned_cart: "Warenkorb ohne Bestellung",
  review_request: "Bestellung zugestellt (DHL)",
};
const RUN_TONE: Record<
  AutomationRunRow["status"],
  { tone: BadgeTone; label: string; hollow?: boolean }
> = {
  scheduled: { tone: "blue", label: "Geplant", hollow: true },
  sent: { tone: "green", label: "Gesendet" },
  skipped: { tone: "gray", label: "Übersprungen" },
  failed: { tone: "red", label: "Fehler" },
};

function delayField(a: AutomationView): {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
} {
  const c = a.config;
  const withCurrent = (opts: { value: string; label: string }[], current: string, label: string) =>
    opts.some((o) => o.value === current) ? opts : [...opts, { value: current, label }];
  if (a.key === "welcome") {
    const v = String(c.delay_minutes ?? 5);
    return {
      name: "delay_minutes",
      label: "Verzögerung",
      value: v,
      options: withCurrent(
        [
          { value: "0", label: "sofort" },
          { value: "5", label: "5 Minuten" },
          { value: "15", label: "15 Minuten" },
          { value: "60", label: "1 Stunde" },
          { value: "180", label: "3 Stunden" },
          { value: "1440", label: "1 Tag" },
        ],
        v,
        `${v} Minuten`,
      ),
    };
  }
  if (a.key === "abandoned_cart") {
    const v = String(c.delay_hours ?? 24);
    return {
      name: "delay_hours",
      label: "Verzögerung",
      value: v,
      options: withCurrent(
        [
          { value: "24", label: "24 Stunden" },
          { value: "48", label: "48 Stunden" },
          { value: "72", label: "72 Stunden" },
        ],
        v,
        `${v} Stunden`,
      ),
    };
  }
  const v = String(c.delay_days ?? 7);
  return {
    name: "delay_days",
    label: "Verzögerung",
    value: v,
    options: withCurrent(
      ["3", "5", "7", "10", "14", "21"].map((d) => ({
        value: d,
        label: `${d} Tage nach Zustellung`,
      })),
      v,
      `${v} Tage nach Zustellung`,
    ),
  };
}

/**
 * /admin/automationen (Figma 40:4540, mobil 35:12073): drei abschaltbare Automationen mit
 * Konfiguration, Vorschau, Testversand und den letzten Läufen samt Entscheidungsgrund.
 */
export default async function AutomationenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const canEdit = PERMISSIONS.sendNewsletter(session);
  const sp = await searchParams;
  const runKeyRaw = firstParam(sp.lauf);
  const runKey = (AUTOMATION_KEYS as readonly string[]).includes(runKeyRaw ?? "")
    ? (runKeyRaw as AutomationKey)
    : undefined;
  const previewKeyRaw = firstParam(sp.vorschau);
  const previewKey = (AUTOMATION_KEYS as readonly string[]).includes(previewKeyRaw ?? "")
    ? (previewKeyRaw as AutomationKey)
    : undefined;

  let automations: AutomationView[] = [];
  let runs: AutomationRunRow[] = [];
  let failed = false;
  try {
    [automations, runs] = await Promise.all([
      listAutomations(),
      listAutomationRuns({ key: runKey, limit: 30 }),
    ]);
  } catch (error) {
    console.error("[admin] Automationen", error);
    failed = true;
  }
  const preview = previewKey ? await previewAutomation(previewKey).catch(() => null) : null;
  const allowlist = automations[0]?.allowlistActive ?? true;
  const mock = integrations().email.name === "mock";

  return (
    <>
      <PageHeader
        title="Automationen"
        description="Einfache, einzeln abschaltbare E-Mails über Resend"
        actions={<ButtonLink href="/admin/emails?tab=protokoll">Protokoll ansehen</ButtonLink>}
      />
      <div className="flex flex-col gap-4">
        <Tabs
          label="Bereiche Newsletter"
          items={[
            { label: "Kampagnen", href: "/admin/newsletter" },
            { label: "Kontakte", href: "/admin/newsletter?tab=kontakte" },
            { label: "Automationen", href: PATH, active: true },
          ]}
        />
        {failed ? (
          <FormMessage tone="error">
            Die Automationen konnten gerade nicht geladen werden.
          </FormMessage>
        ) : null}
        {allowlist ? (
          <Notice tone="warning">
            Bis zum Go-live gehen Automationen nur an die Test-Allowlist. Jede Änderung landet im
            Protokoll.{mock ? " Testmodus: Resend antwortet als Mock." : ""}
          </Notice>
        ) : null}
        {!canEdit ? (
          <FormMessage tone="info">
            Automationen ändern dürfen Owner und Admin. Du siehst die Einstellungen nur.
          </FormMessage>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {automations.map((a) => {
            const delay = delayField(a);
            const formId = `automation-${a.key}`;
            return (
              <section
                key={a.key}
                aria-labelledby={`${formId}-titel`}
                className="rounded-admin-karte border-admin-rahmen bg-admin-karte flex min-w-0 flex-col gap-4 border p-4"
              >
                <ActionForm
                  id={formId}
                  action={updateAutomationAction}
                  resetOnSuccess={false}
                  className="flex flex-col gap-4"
                >
                  <input type="hidden" name="key" value={a.key} />
                  <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-admin-akzent-hell text-admin-akzent flex size-10 shrink-0 items-center justify-center rounded-[8px]">
                        <Icon name={ICONS[a.key]} size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2
                          id={`${formId}-titel`}
                          className="text-[17px] leading-[1.3] font-semibold"
                        >
                          {a.name}
                        </h2>
                        <p
                          className={`text-[13px] ${a.isEnabled ? "text-admin-gruen" : "text-admin-text-2"}`}
                        >
                          {a.isEnabled
                            ? "Aktiv"
                            : `Aus${a.updatedAt && a.updatedAt > "2000" ? `, seit ${formatDateTime(a.updatedAt)}` : ""}`}
                        </p>
                      </div>
                      <Switch
                        name="enabled"
                        label={`${a.name} eingeschaltet`}
                        hideLabel
                        defaultChecked={a.isEnabled}
                      />
                    </div>
                    <p className="text-admin-text-2 text-[14px]">{a.description}</p>
                    {a.consentHint ? <Notice tone="accent">{a.consentHint}</Notice> : null}
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium">Auslöser</p>
                      <p className="rounded-admin-feld bg-admin-flaeche flex min-h-11 items-center gap-2 px-3 text-[14px]">
                        <Icon name="automationen" size={16} />
                        {TRIGGERS[a.key]}
                      </p>
                    </div>
                    <Select
                      name={delay.name}
                      label={delay.label}
                      defaultValue={delay.value}
                      options={delay.options}
                    />
                    {a.key === "abandoned_cart" ? (
                      <Select
                        name="max_age_days"
                        label="Höchstens erinnern bis"
                        defaultValue={String(a.config.max_age_days ?? 7)}
                        options={["3", "7", "14", "30"].map((d) => ({
                          value: d,
                          label: `${d} Tage nach der letzten Aktivität`,
                        }))}
                      />
                    ) : null}
                    <Select
                      name="template_display"
                      label="Vorlage"
                      defaultValue={a.template}
                      options={[{ value: a.template, label: templateName(a.key) }]}
                      hint={
                        <>
                          Betreff änderbar unter{" "}
                          <Link
                            className="text-admin-akzent hover:underline"
                            href={`/admin/emails?vorlage=${a.template}`}
                          >
                            E-Mails, Vorlagen
                          </Link>
                        </>
                      }
                    />
                    {a.key !== "review_request" ? (
                      <Field
                        name="discount_code"
                        label="Rabattcode (optional)"
                        defaultValue={
                          typeof a.config.discount_code === "string" ? a.config.discount_code : ""
                        }
                        placeholder="zum Beispiel WILLKOMMEN10"
                        hint="Muss unter Rabatte existieren und aktiv sein."
                        maxLength={40}
                      />
                    ) : null}
                  </fieldset>
                  <InfoList
                    rows={[
                      { label: "Gesendet (30 Tage)", value: formatNumber(a.sentLast30Days) },
                      { label: "Übersprungen (30 Tage)", value: formatNumber(a.skippedLast30Days) },
                      { label: "Verzögerung", value: a.delayLabel },
                    ]}
                  />
                  {canEdit ? (
                    <div>
                      <SubmitButton pendingLabel="Wird gespeichert …">Speichern</SubmitButton>
                    </div>
                  ) : null}
                </ActionForm>
                <details className="rounded-admin-feld border-admin-rahmen border text-[13px]">
                  <summary className="cursor-pointer px-3 py-2.5 font-medium">
                    So entscheidet die Automation
                  </summary>
                  <ol className="list-decimal border-t py-2 pr-3 pl-8">
                    {AUTOMATION_CHECKS[a.key].map((c) => (
                      <li key={c} className="py-0.5">
                        {c}
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link
                    href={withParams(PATH, sp, { vorschau: a.key })}
                    className={`${cardActionClass} inline-flex items-center gap-1`}
                    scroll={false}
                  >
                    <Icon name="auge" size={16} />
                    Vorschau
                  </Link>
                  {canEdit ? (
                    <TestDialog automationKey={a.key} name={a.name} defaultTo={session.email} />
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        <Table
          caption="Letzte Läufe der Automationen"
          rows={runs}
          rowKey={(r) => r.id}
          toolbar={
            <div className="flex flex-col gap-2 p-3">
              <h2 className="text-[16px] font-semibold">Letzte Läufe</h2>
              <Tabs
                variant="chip"
                label="Automation filtern"
                items={[
                  { label: "Alle", href: withParams(PATH, sp, { lauf: null }), active: !runKey },
                  ...AUTOMATION_KEYS.map((k) => ({
                    label: AUTOMATION_META[k].name,
                    href: withParams(PATH, sp, { lauf: k }),
                    active: runKey === k,
                  })),
                ]}
              />
            </div>
          }
          empty={
            <EmptyState icon="automationen" title="Noch keine Läufe" compact>
              Sobald eine Automation eingeschaltet ist, plant der Sweep alle 15 Minuten fällige
              Fälle ein.
            </EmptyState>
          }
          columns={[
            {
              key: "zeit",
              header: "Zeitpunkt",
              width: "160px",
              cell: (r) => formatDateTime(r.sentAt ?? r.scheduledFor),
            },
            {
              key: "automation",
              header: "Automation",
              cell: (r) => AUTOMATION_META[r.key]?.name ?? r.key,
            },
            {
              key: "empfaenger",
              header: "Empfänger",
              cell: (r) => <span className="break-all">{maskEmail(r.email)}</span>,
            },
            {
              key: "ergebnis",
              header: "Ergebnis",
              width: "130px",
              cell: (r) => (
                <Badge tone={RUN_TONE[r.status].tone} hollow={RUN_TONE[r.status].hollow}>
                  {RUN_TONE[r.status].label}
                </Badge>
              ),
            },
            {
              key: "grund",
              header: "Grund",
              cell: (r) => (
                <span className="text-admin-text-2">
                  {r.skipReason ??
                    r.error ??
                    (r.status === "sent" ? "alle Bedingungen erfüllt" : "–")}
                </span>
              ),
            },
          ]}
          renderCard={(r) => (
            <CardRow
              primary={AUTOMATION_META[r.key]?.name ?? r.key}
              secondary={r.skipReason ?? r.error ?? maskEmail(r.email)}
              secondaryAside={formatDateTime(r.sentAt ?? r.scheduledFor)}
              badges={
                <Badge tone={RUN_TONE[r.status].tone} hollow={RUN_TONE[r.status].hollow}>
                  {RUN_TONE[r.status].label}
                </Badge>
              }
            />
          )}
        />
      </div>

      <Drawer
        open={Boolean(previewKey)}
        closeHref={withParams(PATH, sp, { vorschau: null })}
        title={previewKey ? `Vorschau: ${AUTOMATION_META[previewKey].name}` : "Vorschau"}
        description={preview ? `Betreff: ${preview.subject}` : undefined}
        width="lg"
      >
        {preview ? (
          <div className="p-4">
            <MailPreview html={preview.html} title="Vorschau der Automation" height={900} />
          </div>
        ) : (
          <p className="text-admin-text-2 p-5 text-[14px]">Vorschau nicht verfügbar.</p>
        )}
      </Drawer>
    </>
  );
}

function templateName(key: AutomationKey): string {
  return key === "welcome"
    ? "Willkommen"
    : key === "abandoned_cart"
      ? "Warenkorb erinnern"
      : "Bewertungsanfrage";
}

function TestDialog({
  automationKey,
  name,
  defaultTo,
}: {
  automationKey: AutomationKey;
  name: string;
  defaultTo: string;
}) {
  return (
    <Dialog
      title="Testmail senden"
      description={name}
      trigger={{ label: "Test senden", variant: "text", icon: "emails" }}
      size="sm"
    >
      <ActionForm
        action={sendAutomationTestAction}
        closeDialogOnSuccess
        hideMessage
        resetOnSuccess={false}
      >
        <input type="hidden" name="key" value={automationKey} />
        <DialogBody>
          <ActionFormMessage />
          <Field
            name="to"
            type="email"
            label="Testadresse"
            defaultValue={defaultTo}
            required
            hint="Nur Adressen der Allowlist, mit Beispieldaten."
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton pendingLabel="Wird gesendet …">Senden</SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
