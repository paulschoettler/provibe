import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { getLead, listAssignableStaff, type LeadDetail } from "@/lib/admin/leads/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, canChangeLeadStatus } from "@/lib/admin/leads/status";
import {
  addLeadNoteAction,
  assignLeadAction,
  convertLeadAction,
  setLeadStatusAction,
} from "@/lib/admin/leads/ui-actions";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field, Select, Textarea } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { chipClass } from "@/components/admin/ui/Tabs";
import { LeadStatusBadge } from "@/components/admin/crm/badges";
import { InfoList } from "@/components/admin/crm/parts";

export const metadata: Metadata = { title: "Lead" };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * /admin/leads/[id] (Figma 35:9444, Seitenpanel): Status (H18: "Qualifiziert"), Kontaktdaten mit
 * mailto und tel, Nachricht, Notizen, Zuweisung, Umwandlung in einen B2B-Kunden (Owner, Admin).
 */
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/admin/leads/${id}`;
  const session = await requireStaff("support", { next: path });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  if (!UUID.test(id)) notFound();
  let lead: LeadDetail | null = null;
  let staff: { userId: string; name: string; role: string }[] = [];
  try {
    [lead, staff] = await Promise.all([getLead(id), listAssignableStaff().catch(() => [])]);
  } catch (error) {
    console.error("[admin] Lead", error);
    return (
      <>
        <PageHeader title="Lead" backHref="/admin/leads" backLabel="Leads" />
        <FormMessage tone="error">Der Lead konnte gerade nicht geladen werden.</FormMessage>
      </>
    );
  }
  if (!lead) notFound();
  const l = lead;
  const canConvert = (session.role === "owner" || session.role === "admin") && !l.customerId;
  const phoneHref = l.phone ? `tel:${l.phone.replace(/[^+0-9]/g, "")}` : null;

  return (
    <>
      <PageHeader
        backHref="/admin/leads"
        backLabel="Leads"
        title={l.company ?? l.contactName}
        meta={<LeadStatusBadge status={l.status} />}
        description={`Anfrage vom ${formatDateTime(l.createdAt)} · ${l.kind === "partner" ? "Partnerformular" : l.kind}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:${l.email}?subject=${encodeURIComponent("Deine Partneranfrage bei provibe")}`}
              className={buttonClasses("secondary", "md")}
            >
              <Icon name="emails" size={16} />
              Per E-Mail antworten
            </a>
            {phoneHref ? (
              <a href={phoneHref} className={buttonClasses("secondary", "md")}>
                <Icon name="handy" size={16} />
                Anrufen
              </a>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Status">
            <div className="flex flex-col gap-3">
              <ul className="flex flex-wrap gap-2" aria-label="Status wählen">
                {LEAD_STATUSES.map((s) => {
                  const active = s === l.status;
                  const allowed = canChangeLeadStatus(l.status, s);
                  return (
                    <li key={s}>
                      {active || !allowed ? (
                        <span
                          className={`${chipClass(active, "select")} ${!active ? "opacity-40" : ""}`}
                          aria-current={active ? "true" : undefined}
                          title={!active ? "Wechsel aus diesem Status nicht vorgesehen" : undefined}
                        >
                          {active ? <Icon name="haken" size={16} /> : null}
                          {LEAD_STATUS_LABELS[s]}
                        </span>
                      ) : (
                        <ActionForm action={setLeadStatusAction}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            type="submit"
                            className={`${chipClass(false, "select")} min-h-11 md:min-h-9`}
                          >
                            {LEAD_STATUS_LABELS[s]}
                          </button>
                        </ActionForm>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-admin-text-2 text-[12px]">
                „Qualifiziert“ steht für Angebot oder ernsthaftes Interesse (H18). Aus Gewonnen und
                Verloren geht es nur zurück nach Kontaktiert oder Qualifiziert.
              </p>
            </div>
          </Card>
          <Card title="Nachricht">
            {l.message ? (
              <p className="rounded-admin-feld bg-admin-flaeche p-3 text-[14px] leading-[1.55] break-words whitespace-pre-line">
                {l.message}
              </p>
            ) : (
              <p className="text-admin-text-2 text-[13px]">Keine Nachricht.</p>
            )}
          </Card>
          <Card
            title="Notizen"
            description="Nur intern sichtbar, Statuswechsel werden automatisch notiert"
          >
            <div className="flex flex-col gap-4">
              <ActionForm action={addLeadNoteAction} className="flex flex-col gap-2">
                <input type="hidden" name="leadId" value={l.id} />
                <Textarea
                  name="body"
                  label="Interne Notiz"
                  hideLabel
                  placeholder="Interne Notiz hinzufügen"
                  rows={3}
                  maxLength={5000}
                />
                <div>
                  <SubmitButton variant="secondary" pendingLabel="Wird gespeichert …">
                    Notiz speichern
                  </SubmitButton>
                </div>
              </ActionForm>
              {l.notes.length === 0 ? (
                <p className="text-admin-text-2 text-[13px]">Noch keine Notizen.</p>
              ) : (
                <ul className="divide-admin-rahmen flex flex-col divide-y">
                  {l.notes.map((n) => (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-[14px] break-words whitespace-pre-line">{n.body}</p>
                      <p className="text-admin-text-2 mt-1 text-[12px]">
                        {n.authorName ?? "PROVIBE Team"} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Kontakt">
            <InfoList
              rows={[
                { label: "Firma", value: l.company ?? "–" },
                { label: "Ansprechpartner", value: l.contactName },
                {
                  label: "E-Mail",
                  value: (
                    <a
                      href={`mailto:${l.email}`}
                      className="text-admin-akzent break-all hover:underline"
                    >
                      {l.email}
                    </a>
                  ),
                },
                {
                  label: "Telefon",
                  value: phoneHref ? (
                    <a href={phoneHref} className="text-admin-akzent hover:underline">
                      {l.phone}
                    </a>
                  ) : (
                    "nicht angegeben"
                  ),
                },
                { label: "Art des Geschäfts", value: l.locationType ?? "–" },
                {
                  label: "Quelle",
                  value: l.sourceUrl ? <span className="break-all">{l.sourceUrl}</span> : "–",
                },
              ]}
            />
          </Card>
          <Card title="Zuständig">
            <ActionForm action={assignLeadAction} className="flex items-end gap-2">
              <input type="hidden" name="leadId" value={l.id} />
              <Select
                name="userId"
                label="Zugewiesen an"
                defaultValue={l.assignedTo ?? ""}
                placeholder="niemand"
                options={staff.map((s) => ({ value: s.userId, label: s.name }))}
                className="flex-1"
              />
              <SubmitButton variant="secondary" pendingLabel="…">
                Speichern
              </SubmitButton>
            </ActionForm>
          </Card>
          <Card title="B2B-Kunde">
            {l.customer ? (
              <div className="flex flex-col gap-2 text-[14px]">
                <p>
                  Verknüpft mit <span className="font-bold break-all">{l.customer.email}</span> (
                  {l.customer.customerType.toUpperCase()}, Freigabe {l.customer.b2bStatus}).
                </p>
                <Link
                  href={`/admin/kunden/${l.customer.id}`}
                  className={`${cardActionClass} inline-flex items-center gap-1`}
                >
                  Zum Kundenprofil
                </Link>
              </div>
            ) : canConvert ? (
              <Dialog
                title="Als B2B-Kunde anlegen?"
                description="Legt den Kunden an oder schaltet einen bestehenden mit derselben E-Mail frei. Der Lead wird auf Gewonnen gesetzt."
                trigger={{
                  label: "Als B2B-Kunde anlegen",
                  variant: "secondary",
                  icon: "kunden",
                  block: true,
                }}
              >
                <ActionForm action={convertLeadAction} closeDialogOnSuccess hideMessage>
                  <input type="hidden" name="leadId" value={l.id} />
                  <DialogBody>
                    <ActionFormMessage />
                    <Field
                      name="companyName"
                      label="Firmenname"
                      defaultValue={l.company ?? ""}
                      required
                      maxLength={200}
                    />
                    <Field
                      name="vatId"
                      label="USt-IdNr. (optional)"
                      placeholder="DE123456789"
                      maxLength={14}
                    />
                    <p className="text-admin-text-2 text-[12px]">
                      B2B-Preise und Rechnungskauf sind in Phase 1 nicht aktiv, es wird nur das
                      Datenmodell gepflegt.
                    </p>
                  </DialogBody>
                  <DialogFooter>
                    <DialogClose />
                    <SubmitButton pendingLabel="Wird angelegt …">Anlegen</SubmitButton>
                  </DialogFooter>
                </ActionForm>
              </Dialog>
            ) : (
              <p className="text-admin-text-2 text-[13px]">
                Umwandeln in einen B2B-Kunden dürfen Owner und Admin.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
