import type { Metadata } from "next";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { crmDb } from "@/lib/admin/customers/crm-db";
import { saveInvoiceTextsAction } from "@/lib/admin/settings/actions";
import { getSettings } from "@/lib/admin/settings/settings";
import { serverEnv } from "@/lib/env/server";
import { integrations } from "@/lib/integrations";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint, InfoRow, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Textarea } from "@/components/admin/ui/fields";
import { formatNumber } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";

export const metadata: Metadata = { title: "Rechnungen" };

const PATH = "/admin/einstellungen/rechnungen";
const FORM = "rechnungstexte";

const STATUS_LABELS: Record<string, string> = {
  none: "ohne Rechnung",
  queued: "in der Warteschlange",
  draft: "Entwurf",
  finalized: "finalisiert",
  sent: "versendet",
  failed: "fehlgeschlagen",
};

async function invoiceCounts(): Promise<Record<string, number>> {
  const db = crmDb();
  const entries = await Promise.all(
    Object.keys(STATUS_LABELS).map(async (s) => {
      const { count } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("is_test", false)
        .eq("invoice_status", s as "none");
      return [s, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * /admin/einstellungen/rechnungen: Status der Lexware-Anbindung (bis zum Key Mock), Nummernkreis
 * bei Lexware (H21), Vorlagentexte für Einleitung, Schlussbemerkung und Fußzeile.
 */
export default async function InvoiceSettingsPage() {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const canEdit = PERMISSIONS.editSettings(session);
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }
  if (!settings)
    return (
      <>
        <PageHeader title="Rechnungen" />
        <FormMessage tone="error">
          Die Einstellungen konnten gerade nicht geladen werden.
        </FormMessage>
      </>
    );
  const env = serverEnv();
  const provider = integrations().invoicing.name;
  const counts = await invoiceCounts().catch(() => null);
  const texts = settings.sections.invoices;
  const mock = provider === "mock";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <ActionForm
        id={FORM}
        action={saveInvoiceTextsAction}
        resetOnSuccess={false}
        hideMessage
        className="min-w-0"
      >
        <PageHeader
          title="Rechnungen"
          description="Rechnungen entstehen in Lexware Office, der Shop vergibt keine eigenen Nummern"
          meta={
            mock ? (
              <Badge tone="yellow">Testmodus</Badge>
            ) : (
              <Badge tone="green">Lexware verbunden</Badge>
            )
          }
        />
        {!canEdit ? <ReadOnlyNotice what="Einstellungen" /> : null}
        {mock ? (
          <FormMessage tone="warning">
            Testmodus: Lexware antwortet als Mock, weil noch kein API-Key hinterlegt ist. Rechnungen
            bleiben Entwürfe ohne Nummer (H21), PDFs sind Platzhalter, Versand nur an die Allowlist.
          </FormMessage>
        ) : null}
        <ActionFormMessage className="mb-4" />
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <Card title="Rechnungsnummern">
            <p className="text-[14px] leading-[1.6]">{settings.invoices.hint}</p>
            <p className="text-admin-text-2 mt-2 text-[13px]">
              Format und Startwert stellst du in Lexware Office unter Einstellungen, Nummernkreise
              ein. Die Nummer landet nach dem Finalisieren an der Bestellung
              (orders.invoice_number).
            </p>
          </Card>
          <Card title="Vorlagentexte" description="Werden mit jeder Rechnung an Lexware übergeben">
            <div className="flex flex-col gap-4">
              <Textarea
                name="invoices.introduction"
                label="Einleitung"
                defaultValue={texts.introduction}
                rows={2}
                maxLength={500}
                placeholder="Wir stellen dir folgende Leistungen in Rechnung:"
              />
              <Textarea
                name="invoices.remark"
                label="Schlussbemerkung"
                defaultValue={texts.remark}
                rows={3}
                maxLength={1000}
                hint="Die Bestellnummer hängt der Shop automatisch an."
              />
              <Textarea
                name="invoices.footer"
                label="Fußzeile"
                defaultValue={texts.footer}
                rows={2}
                maxLength={500}
                hint="Firmendaten, Bankverbindung und Steuernummer pflegst du im Lexware-Layout; hier nur ein zusätzlicher Hinweis."
              />
            </div>
          </Card>
          <Hint tone="info">
            Gespeichert werden die Texte jetzt; die Übergabe an Lexware hängt die Rechnungserzeugung
            an, sobald der Key da ist (siehe docs/golive.md).
          </Hint>
        </fieldset>
        {canEdit ? <SaveBar formId={FORM} /> : null}
      </ActionForm>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Anbindung">
          <dl>
            <InfoRow label="Anbieter">{mock ? "Mock (Testmodus)" : "Lexware Office"}</InfoRow>
            <InfoRow label="API-Key">{env.LEXWARE_API_KEY ? "hinterlegt" : "fehlt"}</InfoRow>
            <InfoRow label="Modus">
              {env.LEXWARE_INVOICE_MODE === "final" ? "sofort finalisiert" : "Entwurf"}
            </InfoRow>
            <InfoRow label="Integrationen">
              {env.APP_INTEGRATIONS === "mock" ? "Mock" : "live"}
            </InfoRow>
          </dl>
        </Card>
        <Card title="Rechnungen" description="Echte Bestellungen, ohne Testbestellungen">
          {counts ? (
            <dl>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <InfoRow key={k} label={label}>
                  {formatNumber(counts[k] ?? 0)}
                </InfoRow>
              ))}
            </dl>
          ) : (
            <p className="text-admin-text-2 text-[14px]">Zahlen gerade nicht verfügbar.</p>
          )}
          <p className="text-admin-text-2 mt-2 text-[12px]">
            Fehlgeschlagene Rechnungen lassen sich an der Bestellung erneut anstoßen.
          </p>
        </Card>
      </div>
    </div>
  );
}
