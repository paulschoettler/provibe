import type { Metadata } from "next";
import Link from "next/link";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  HOMEPAGE_MODULE_KINDS,
  HOMEPAGE_MODULE_LABELS,
  listHomepageModules,
  type HomepageModuleView,
} from "@/lib/admin/content/homepage";
import { isoToBerlinLocal } from "@/lib/admin/content/input";
import {
  createModuleAction,
  deleteAnnouncementAction,
  deleteModuleAction,
  moveAnnouncementAction,
  moveModuleAction,
  saveAnnouncementAction,
  toggleAnnouncementAction,
  toggleModuleAction,
} from "@/lib/admin/content/layout-actions";
import { MODULE_FIELDS, moduleSummary } from "@/lib/admin/content/module-fields";
import { listAnnouncements, type AnnouncementView } from "@/lib/admin/content/navigation";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { ModuleForm } from "@/components/admin/content/ModuleForm";
import { Hint, ReadOnlyNotice } from "@/components/admin/content/parts";
import { SwitchAction } from "@/components/admin/content/SwitchAction";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Drawer } from "@/components/admin/ui/Drawer";
import { Checkbox, Field, Select } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon, type IconName } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

export const metadata: Metadata = { title: "Startseite" };

const PATH = "/admin/inhalte/startseite";

const KIND_ICONS: Record<string, IconName> = {
  hero: "dashboard",
  bestseller: "trend-hoch",
  flavors: "kollektionen",
  story: "bild",
  bundles: "produkte",
  faq: "info",
  custom: "notiz",
};

function period(a: AnnouncementView): string {
  if (!a.startsAt && !a.endsAt) return "ohne Zeitraum";
  if (a.startsAt && a.endsAt)
    return `${formatDateTime(a.startsAt)} bis ${formatDateTime(a.endsAt)}`;
  if (a.startsAt) return `ab ${formatDateTime(a.startsAt)}`;
  return `bis ${formatDateTime(a.endsAt)}`;
}

/**
 * /admin/inhalte/startseite (Figma 41:2481, mobil 44:2888): Reihenfolge und Schalter der
 * Startseiten-Module, Texte und Bilder je Modul (Drawer ?modul=), Announcement-Bar mit Meldungen
 * und Zeitraum (Drawer ?meldung=). Änderungen gehen per On-Demand-Revalidation live.
 */
export default async function HomepageModulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  const sp = await searchParams;
  const [modules, announcements] = await Promise.all([listHomepageModules(), listAnnouncements()]);
  const modulId = firstParam(sp.modul);
  const meldungId = firstParam(sp.meldung);
  const openModule = modules.find((m) => m.id === modulId) ?? null;
  const openAnnouncement =
    meldungId === "neu" ? null : (announcements.find((a) => a.id === meldungId) ?? null);
  const announcementOpen = meldungId === "neu" || Boolean(openAnnouncement);
  const live = announcements.filter((a) => a.isLive);
  const closeHref = withParams(PATH, sp, { modul: null, meldung: null });

  const moveButtons = (
    id: string,
    index: number,
    count: number,
    name: string,
    action: typeof moveModuleAction,
  ) =>
    canEdit ? (
      <span className="flex shrink-0 flex-col">
        <InlineAction
          action={action}
          fields={{ id, dir: "up" }}
          label="↑"
          srLabel={`${name} nach oben`}
          variant="text"
          disabled={index === 0}
        />
        <InlineAction
          action={action}
          fields={{ id, dir: "down" }}
          label="↓"
          srLabel={`${name} nach unten`}
          variant="text"
          disabled={index === count - 1}
        />
      </span>
    ) : null;

  const moduleRow = (m: HomepageModuleView, i: number) => (
    <li
      key={m.id}
      className="border-admin-rahmen flex items-center gap-2 border-t px-3 py-2 first:border-t-0 md:gap-3"
    >
      {moveButtons(m.id, i, modules.length, m.label, moveModuleAction)}
      <span className="bg-admin-flaeche rounded-admin-feld text-admin-text-2 hidden size-10 shrink-0 items-center justify-center sm:flex">
        <Icon name={KIND_ICONS[m.kind] ?? "inhalte"} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          {i + 1}. {m.label}
          {!m.isEnabled ? (
            <Badge tone="gray" hollow>
              ausgeblendet
            </Badge>
          ) : null}
        </span>
        <span className="text-admin-text-2 block truncate text-[12px]">
          {moduleSummary(m.kind, m.config)}
        </span>
      </span>
      {canEdit ? (
        <SwitchAction
          action={toggleModuleAction}
          fields={{ id: m.id }}
          checked={m.isEnabled}
          label={`${m.label} auf der Startseite zeigen`}
        />
      ) : null}
      <Link
        href={withParams(PATH, {}, { modul: m.id })}
        className={`${cardActionClass} inline-flex min-h-11 items-center px-1`}
        aria-label={`${m.label} bearbeiten`}
      >
        {canEdit ? "Bearbeiten" : "Ansehen"}
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Startseiten-Module"
        description="Reihenfolge per Pfeil ändern, Module ein- und ausblenden. Änderungen gehen per On-Demand-Revalidation live."
        actions={
          canEdit ? (
            <Dialog
              title="Modul hinzufügen"
              description="Neue Module starten ausgeblendet am Ende der Startseite."
              size="sm"
              trigger={{ label: "Modul hinzufügen", icon: "plus" }}
            >
              <ActionForm action={createModuleAction}>
                <DialogBody>
                  <Select
                    name="kind"
                    label="Modulart"
                    placeholder="Bitte wählen"
                    options={HOMEPAGE_MODULE_KINDS.map((k) => ({
                      value: k,
                      label: `${HOMEPAGE_MODULE_LABELS[k]}: ${MODULE_FIELDS[k]?.description ?? ""}`,
                    }))}
                  />
                </DialogBody>
                <DialogFooter>
                  <DialogClose />
                  <SubmitButton>Anlegen</SubmitButton>
                </DialogFooter>
              </ActionForm>
            </Dialog>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Module" description="Reihenfolge wie auf der Startseite" flush>
            <ol>{modules.map(moduleRow)}</ol>
          </Card>
          <Hint tone="info">
            Ausgeblendete Module bleiben gespeichert. Inhalte jedes Moduls stehen im Server-HTML, 3D
            nur als Progressive Enhancement. Felder, die das Formular nicht kennt, bleiben beim
            Speichern erhalten.
          </Hint>
        </div>

        <Card
          id="announcement"
          title="Announcement-Bar"
          description={`${live.length} von ${announcements.length} ${announcements.length === 1 ? "Meldung" : "Meldungen"} gerade live`}
          action={
            canEdit ? (
              <ButtonLink href={withParams(PATH, {}, { meldung: "neu" })} size="sm" icon="plus">
                Meldung
              </ButtonLink>
            ) : null
          }
        >
          <div className="bg-admin-seitenleiste text-admin-seitenleiste-text rounded-admin-feld mb-3 flex min-h-11 items-center justify-center px-3 py-2 text-center text-[14px] font-medium">
            {live[0]?.message ?? "Keine Meldung aktiv"}
          </div>
          <ul className="flex flex-col gap-2">
            {announcements.map((a, i) => (
              <li
                key={a.id}
                className="rounded-admin-feld border-admin-rahmen flex items-start gap-2 border p-2.5"
              >
                {moveButtons(
                  a.id,
                  i,
                  announcements.length,
                  `Meldung ${i + 1}`,
                  moveAnnouncementAction,
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold">Meldung {i + 1}</span>
                    {a.isLive ? (
                      <Badge tone="green">Live</Badge>
                    ) : a.isActive ? (
                      <Badge tone="blue" hollow>
                        geplant oder abgelaufen
                      </Badge>
                    ) : (
                      <Badge tone="gray" hollow>
                        pausiert
                      </Badge>
                    )}
                  </span>
                  <span className="mt-1 block text-[14px]">{a.message}</span>
                  <span className="text-admin-text-2 block text-[12px]">
                    {a.linkUrl ? `${a.linkUrl} · ` : ""}
                    {period(a)}
                  </span>
                  <Link
                    href={withParams(PATH, {}, { meldung: a.id })}
                    className={`${cardActionClass} mt-1 inline-flex min-h-11 items-center md:min-h-0`}
                  >
                    {canEdit ? "Bearbeiten" : "Ansehen"}
                  </Link>
                </span>
                {canEdit ? (
                  <SwitchAction
                    action={toggleAnnouncementAction}
                    fields={{ id: a.id }}
                    stateName="active"
                    checked={a.isActive}
                    label={`Meldung ${i + 1} aktiv`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-admin-text-2 mt-3 text-[12px]">
            Die Storefront zeigt die erste Meldung, die gerade live ist. Zeitraum in Berliner Zeit;
            Start und Ende greifen mit bis zu einer Stunde Verzögerung, weil die Seiten statisch
            zwischengespeichert sind.
          </p>
        </Card>
      </div>

      <Drawer
        open={Boolean(openModule)}
        closeHref={closeHref}
        title={openModule ? `${openModule.label} bearbeiten` : "Modul"}
        description={openModule ? MODULE_FIELDS[openModule.kind]?.description : undefined}
        width="md"
      >
        {openModule ? (
          <div className="flex flex-col gap-6 p-5">
            <ModuleForm mod={openModule} canEdit={canEdit} />
            {canEdit ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteModuleAction}
                  fields={{ id: openModule.id }}
                  label="Modul löschen"
                  variant="text"
                  confirm={{
                    title: `${openModule.label} löschen?`,
                    description:
                      "Das Modul und seine Texte werden entfernt. Ausblenden behält sie.",
                    confirmLabel: "Löschen",
                    danger: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={announcementOpen}
        closeHref={closeHref}
        title={openAnnouncement ? "Meldung bearbeiten" : "Neue Meldung"}
        description="Leiste über dem Header auf allen Seiten"
        width="md"
      >
        {announcementOpen ? (
          <div className="flex flex-col gap-6 p-5">
            <ActionForm action={saveAnnouncementAction} resetOnSuccess={false}>
              {openAnnouncement ? (
                <input type="hidden" name="id" value={openAnnouncement.id} />
              ) : null}
              <fieldset disabled={!canEdit} className="flex flex-col gap-4">
                <Field
                  name="message"
                  label="Text"
                  defaultValue={openAnnouncement?.message ?? ""}
                  maxLength={160}
                  required
                  hint="Höchstens 160 Zeichen. Rabattaktionen nur mit Code, keine Streichpreise (I15)."
                />
                <Field
                  name="linkUrl"
                  label="Link (optional)"
                  defaultValue={openAnnouncement?.linkUrl ?? ""}
                  placeholder="/pages/versand"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="startsAt"
                    type="datetime-local"
                    label="Start (optional)"
                    defaultValue={isoToBerlinLocal(openAnnouncement?.startsAt)}
                  />
                  <Field
                    name="endsAt"
                    type="datetime-local"
                    label="Ende (optional)"
                    defaultValue={isoToBerlinLocal(openAnnouncement?.endsAt)}
                  />
                </div>
                <Checkbox
                  name="isActive"
                  label="Aktiv"
                  description="Ohne Zeitraum sofort und dauerhaft sichtbar."
                  defaultChecked={openAnnouncement?.isActive ?? true}
                />
                {canEdit ? (
                  <div className="flex justify-end gap-2">
                    <ButtonLink href={closeHref} variant="secondary">
                      Abbrechen
                    </ButtonLink>
                    <SubmitButton>Speichern</SubmitButton>
                  </div>
                ) : null}
              </fieldset>
            </ActionForm>
            {canEdit && openAnnouncement ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteAnnouncementAction}
                  fields={{ id: openAnnouncement.id }}
                  label="Meldung löschen"
                  variant="text"
                  confirm={{
                    title: "Meldung löschen?",
                    description: openAnnouncement.message,
                    confirmLabel: "Löschen",
                    danger: true,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
