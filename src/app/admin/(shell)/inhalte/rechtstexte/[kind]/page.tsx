import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  createLegalDraftAction,
  deleteLegalDraftAction,
  saveLegalDraftAction,
} from "@/lib/admin/content/actions";
import { isoToBerlinLocal } from "@/lib/admin/content/input";
import {
  getLegalVersion,
  LEGAL_KIND_LABELS,
  LEGAL_KINDS,
  listLegalVersions,
} from "@/lib/admin/content/legal";
import { sanitizeRichHtml } from "@/lib/admin/content/sanitize";
import type { LegalKind } from "@/lib/content/legal";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { Hint, InfoRow, PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { RichTextEditor } from "@/components/admin/content/RichTextEditor";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink, buttonClasses } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { Checkbox, Field, Textarea } from "@/components/admin/ui/fields";
import { formatDate, formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { Tabs } from "@/components/admin/ui/Tabs";

export const metadata: Metadata = { title: "Rechtstext bearbeiten" };

/** Zeitpunkt der Anfrage (Server Component, je Request neu gerendert) */
function nowMs(): number {
  return Date.now();
}

/** Vorschlag für "Gültig ab": morgen, gleiche Uhrzeit, Berliner Zeit */
function tomorrowLocal(): string {
  return isoToBerlinLocal(new Date(nowMs() + 86_400_000).toISOString());
}

/**
 * /admin/inhalte/rechtstexte/[kind] (Figma 41:13808, mobil 41:2384): Editor des Entwurfs,
 * Versionen mit Ansehen, Vergleichen und Wiederherstellen, Status der Live-Version.
 * ?version=<id> zeigt eine Version lesend, ?ansicht=vorschau den Entwurf bereinigt.
 */
export default async function LegalDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { kind: rawKind } = await params;
  if (!(LEGAL_KINDS as readonly string[]).includes(rawKind)) notFound();
  const kind = rawKind as LegalKind;
  const path = `/admin/inhalte/rechtstexte/${kind}`;
  const session = await requireStaff("support", { next: path });
  const canEdit = PERMISSIONS.editContent(session);
  const sp = await searchParams;
  const versions = await listLegalVersions(kind);
  const current = versions.find((v) => v.isCurrent) ?? null;
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const now = nowMs();
  const upcoming =
    versions.find(
      (v) => v.status === "published" && v.effectiveFrom && Date.parse(v.effectiveFrom) > now,
    ) ?? null;
  const viewId = firstParam(sp.version);
  const preview = firstParam(sp.ansicht) === "vorschau";
  const viewed =
    viewId && versions.some((v) => v.id === viewId) ? await getLegalVersion(viewId) : null;
  const editing = draft ? await getLegalVersion(draft.id) : null;
  const shown =
    viewed ?? (editing && !preview ? null : current ? await getLegalVersion(current.id) : null);
  const label = LEGAL_KIND_LABELS[kind];
  const docPath = editing?.path ?? shown?.path ?? "";

  const versionList = (
    <Card
      title="Versionen"
      action={
        versions.length > 1 ? (
          <Link href={`${path}/vergleich`} className={cardActionClass}>
            Vergleichen
          </Link>
        ) : null
      }
      flush
    >
      <ul>
        {versions.map((v) => {
          const isViewed = viewed?.id === v.id || (!viewed && editing?.id === v.id && !preview);
          const isUpcoming = v.status === "published" && !v.isCurrent && v.id === upcoming?.id;
          return (
            <li
              key={v.id}
              className={`border-admin-rahmen border-t px-4 py-3 ${isViewed ? "bg-admin-akzent-hell" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold">Version {v.version}</span>
                {v.status === "draft" ? (
                  <Badge tone="gray">Entwurf</Badge>
                ) : v.isCurrent ? (
                  <Badge tone="green">Live</Badge>
                ) : isUpcoming ? (
                  <Badge tone="blue" hollow>
                    ab {formatDate(v.effectiveFrom)}
                  </Badge>
                ) : (
                  <Badge tone="gray" hollow>
                    Archiv
                  </Badge>
                )}
              </div>
              <p className="text-admin-text-2 mt-0.5 text-[12px]">
                {formatDate(v.publishedAt ?? v.createdAt)} · {v.createdByName ?? "Import"}
              </p>
              {v.changeNote ? (
                <p className="mt-1 line-clamp-3 text-[13px]" title={v.changeNote}>
                  {v.changeNote}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={v.status === "draft" ? path : withParams(path, {}, { version: v.id })}
                  className={`${cardActionClass} inline-flex min-h-11 items-center gap-1 md:min-h-0`}
                >
                  <Icon name="auge" size={16} /> {v.status === "draft" ? "Bearbeiten" : "Ansehen"}
                </Link>
                {(draft ?? current) && v.id !== (draft ?? current)?.id ? (
                  <Link
                    href={withParams(
                      `${path}/vergleich`,
                      {},
                      { alt: v.id, neu: (draft ?? current)!.id },
                    )}
                    className={`${cardActionClass} inline-flex min-h-11 items-center md:min-h-0`}
                  >
                    Vergleichen
                  </Link>
                ) : null}
                {canEdit && !draft && v.status === "published" && !v.isCurrent ? (
                  <InlineAction
                    action={createLegalDraftAction}
                    fields={{ kind, basedOnVersionId: v.id }}
                    label="Wiederherstellen"
                    variant="text"
                    confirm={{
                      title: `Version ${v.version} wiederherstellen?`,
                      description: `Legt eine neue Version als Entwurf mit dem Text von Version ${v.version} an. Nichts wird überschrieben, live bleibt Version ${current?.version ?? "–"}, bis du den Entwurf veröffentlichst.`,
                      confirmLabel: "Als Entwurf anlegen",
                    }}
                  >
                    <Field
                      name="changeNote"
                      label="Änderungsvermerk"
                      defaultValue={`Wiederhergestellt aus Version ${v.version}`}
                    />
                  </InlineAction>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const statusCard = (
    <Card title="Status">
      <dl>
        <InfoRow label="Live-Version">{current ? `Version ${current.version}` : "keine"}</InfoRow>
        <InfoRow label="Veröffentlicht am">
          {current?.publishedAt ? formatDateTime(current.publishedAt) : "–"}
        </InfoRow>
        <InfoRow label="Gültig seit">
          {current?.effectiveFrom ? formatDateTime(current.effectiveFrom) : "–"}
        </InfoRow>
        {upcoming ? (
          <InfoRow label={`Version ${upcoming.version} gilt ab`}>
            {formatDateTime(upcoming.effectiveFrom)}
          </InfoRow>
        ) : null}
        {editing ? (
          <InfoRow label="Entwurf angelegt">{formatDateTime(editing.createdAt)}</InfoRow>
        ) : null}
      </dl>
      {docPath ? (
        <ButtonLink
          href={docPath}
          target="_blank"
          variant="text"
          size="sm"
          icon="extern"
          className="mt-2"
        >
          Live-Seite öffnen
        </ButtonLink>
      ) : null}
    </Card>
  );

  const readOnly = (v: NonNullable<typeof shown>, note?: string) => (
    <Card
      title={v.title}
      description={
        <>
          Version {v.version} ·{" "}
          {v.status === "draft"
            ? "Entwurf"
            : `veröffentlicht ${formatDateTime(v.publishedAt)}, gültig ab ${formatDateTime(v.effectiveFrom)}`}
          {note ? ` · ${note}` : ""}
        </>
      }
    >
      {v.changeNote ? (
        <p className="text-admin-text-2 mb-3 text-[13px]">Änderungsvermerk: {v.changeNote}</p>
      ) : null}
      <div
        className="admin-inhalte-prosa border-admin-rahmen rounded-admin-feld max-h-[75vh] overflow-y-auto border px-4 py-3 text-[14px] leading-[1.6]"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(v.bodyHtml) }}
      />
    </Card>
  );

  let main: React.ReactNode;
  if (viewed) {
    main = (
      <div className="flex flex-col gap-3">
        <Link href={path} className={`${cardActionClass} inline-flex items-center gap-1`}>
          <Icon name="chevron-links" size={16} /> Zurück {editing ? "zum Entwurf" : "zur Übersicht"}
        </Link>
        {readOnly(viewed, viewed.id === current?.id ? "aktuell live" : undefined)}
      </div>
    );
  } else if (editing && preview) {
    main = readOnly(editing, "so erscheint der Entwurf nach dem Veröffentlichen");
  } else if (editing) {
    main = (
      <ActionForm
        id="rechtstext-editor"
        action={saveLegalDraftAction}
        resetOnSuccess={false}
        hideMessage
        className="flex min-w-0 flex-col gap-4"
      >
        <input type="hidden" name="versionId" value={editing.id} />
        {canEdit ? (
          <div className="flex flex-wrap items-start gap-2">
            <SubmitButton
              name="intent"
              value="save"
              variant="secondary"
              pendingLabel="Wird gespeichert …"
            >
              Entwurf speichern
            </SubmitButton>
            <details className="group min-w-0 open:basis-full md:open:basis-auto">
              <summary
                className={`${buttonClasses("primary", "md")} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
              >
                Veröffentlichen
              </summary>
              <div className="rounded-admin-karte border-admin-rahmen bg-admin-karte shadow-admin-karte mt-2 flex w-full flex-col gap-3 border p-4 md:w-[420px]">
                <p className="text-[15px] font-semibold">
                  Version {editing.version} veröffentlichen
                </p>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-[13px] font-medium">Gültig ab</legend>
                  <label className="flex min-h-11 items-center gap-2 text-[14px] md:min-h-0">
                    <input
                      type="radio"
                      name="effectiveMode"
                      value="now"
                      defaultChecked
                      className="size-4 accent-[var(--color-admin-akzent)]"
                    />
                    Sofort
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-[14px] md:min-h-0">
                    <input
                      type="radio"
                      name="effectiveMode"
                      value="later"
                      className="size-4 accent-[var(--color-admin-akzent)]"
                    />
                    Zu einem späteren Zeitpunkt (zum Beispiel angekündigte AGB-Änderung)
                  </label>
                </fieldset>
                <Field
                  name="effectiveFrom"
                  label="Datum und Uhrzeit (Berlin)"
                  type="datetime-local"
                  defaultValue={tomorrowLocal()}
                  hint="Gilt nur bei „späterer Zeitpunkt“."
                />
                <Checkbox
                  name="confirmChecked"
                  label="Ich habe den Text geprüft (Rechtsprüfung)"
                  description="Mit dem Speichern wird der aktuelle Editorinhalt veröffentlicht."
                />
                <SubmitButton name="intent" value="publish" pendingLabel="Wird veröffentlicht …">
                  Jetzt veröffentlichen
                </SubmitButton>
              </div>
            </details>
            <span className="flex-1" />
            <InlineAction
              action={deleteLegalDraftAction}
              fields={{ versionId: editing.id, kind }}
              label="Entwurf verwerfen"
              variant="text"
              confirm={{
                title: `Entwurf Version ${editing.version} verwerfen?`,
                description:
                  "Der Entwurf wird gelöscht. Veröffentlichte Versionen bleiben erhalten.",
                confirmLabel: "Verwerfen",
                danger: true,
              }}
            />
          </div>
        ) : null}
        <ActionFormMessage />
        <Card>
          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
            <Field
              name="title"
              label="Titel"
              defaultValue={editing.title}
              required
              maxLength={200}
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                name="stand_anzeige"
                label="Stand"
                defaultValue={formatDate(editing.createdAt)}
                disabled
              />
              <Field
                name="version_anzeige"
                label="Version"
                defaultValue={`${editing.version} (Entwurf)`}
                disabled
              />
              <Field
                name="url_anzeige"
                label="URL"
                defaultValue={editing.path ?? ""}
                disabled
                className="col-span-2 sm:col-span-1"
              />
            </div>
            <RichTextEditor
              name="bodyHtml"
              label="Inhalt"
              defaultValue={editing.bodyHtml}
              disabled={!canEdit}
              minHeight={420}
            />
            <Textarea
              name="changeNote"
              label="Änderungsvermerk"
              defaultValue={editing.changeNote ?? ""}
              maxLength={1000}
              rows={2}
              required
              hint="Pflicht zum Veröffentlichen. Erscheint in der Versionsliste."
            />
            <Hint>
              Veröffentlichen macht Version {editing.version} mit Zeitstempel und deinem Namen zur
              Live-Fassung
              {current ? `, Version ${current.version} bleibt abrufbar und wiederherstellbar` : ""}.
              Lass Rechtstexte vor dem Veröffentlichen prüfen (docs/rechtstexte-aenderungen.md).
            </Hint>
          </fieldset>
        </Card>
      </ActionForm>
    );
  } else {
    main = (
      <div className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <InlineAction
              action={createLegalDraftAction}
              fields={{ kind }}
              label="Neue Version anlegen"
              variant="primary"
              size="md"
              icon="plus"
            />
          </div>
        ) : null}
        {shown ? (
          readOnly(shown, "aktuell live")
        ) : (
          <Hint>Für diesen Rechtstext gibt es noch keine Version.</Hint>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={label}
        backHref="/admin/inhalte/rechtstexte"
        backLabel="Zurück zu den Rechtstexten"
        meta={
          editing ? (
            <PublishBadge status="draft" />
          ) : current ? (
            <PublishBadge status="published" />
          ) : null
        }
        description={docPath}
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      {editing && !viewed ? (
        <Tabs
          label="Ansicht"
          className="mb-4"
          items={[
            { label: "Bearbeiten", href: path, active: !preview },
            { label: "Vorschau", href: `${path}?ansicht=vorschau`, active: preview },
          ]}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="min-w-0">{main}</div>
        <div className="flex min-w-0 flex-col gap-4">
          {versionList}
          {statusCard}
        </div>
      </div>
    </>
  );
}
