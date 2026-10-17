import Link from "next/link";
import {
  applyRulesAction,
  checkCollectionHandleAction,
  deleteCollectionAction,
  previewRulesAction,
  publishCollectionAction,
  removeCollectionImageAction,
  saveCollectionFormAction,
  uploadCollectionImageAction,
} from "@/lib/admin/collections/actions";
import type { CollectionEditData, RulePreviewItem } from "@/lib/admin/collections/data";
import { SORT_KEYS, type CollectionInput } from "@/lib/admin/collections/rules";
import type { ProductOption } from "@/lib/admin/products/data";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge, StatusBadge } from "@/components/admin/ui/Badge";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { RadioCards, Select } from "@/components/admin/ui/fields";
import { Field } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { HandleField } from "./HandleField";
import { ManualProductList } from "./ManualProductList";
import { PickerList } from "./PickerList";
import { RichTextEditor } from "./RichTextEditor";
import { RulesEditor } from "./RulesEditor";
import { SeoFields } from "./SeoFields";
import { StateError, StateNotice } from "./StateError";

/**
 * Kollektions-Editor (keine eigene Figma-Vorlage, Muster wie Produkt-Editor): Titel, Handle,
 * Beschreibung, Bild, Status, Art (manuell mit Produktauswahl und Reihenfolge oder automatisch
 * mit Bedingungen und Live-Vorschau), Sortierung, SEO. Bild, Veröffentlichen, Regeln anwenden
 * und Löschen laufen über eigene Formulare.
 */
const FORM_ID = "kollektion-form";
const IMAGE_FORM = "kollektion-bild";

export function CollectionEditor({
  data,
  input,
  products,
  preview,
  canEdit,
  updatedBy,
}: {
  data: CollectionEditData | null;
  input: CollectionInput;
  products: ProductOption[];
  preview: RulePreviewItem[];
  canEdit: boolean;
  updatedBy: string | null;
}) {
  const c = data?.collection;
  const isNew = !c;
  const members = data?.products ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const kind = input.kind ?? "manual";

  return (
    <>
      <PageHeader
        title={isNew ? "Kollektion anlegen" : input.title}
        backHref="/admin/kollektionen"
        backLabel="Zurück zu den Kollektionen"
        meta={
          c ? (
            <>
              <StatusBadge kind="record" value={c.status} />
              <Badge tone="gray" noDot>
                {c.kind === "automatic" ? "Automatisch" : "Manuell"}
              </Badge>
            </>
          ) : null
        }
        actions={
          c ? (
            <>
              {c.status === "published" ? (
                <Link
                  href={`/collections/${c.handle}`}
                  target="_blank"
                  rel="noopener"
                  className={buttonClasses("text", "md")}
                >
                  <Icon name="extern" size={16} />
                  Im Shop ansehen
                </Link>
              ) : null}
              {canEdit ? (
                <>
                  {c.kind === "automatic" ? (
                    <form action={applyRulesAction}>
                      <input type="hidden" name="collectionId" value={c.id} />
                      <SubmitButton variant="secondary" pendingLabel="Wird berechnet …">
                        Regeln anwenden
                      </SubmitButton>
                    </form>
                  ) : null}
                  <form action={publishCollectionAction}>
                    <input type="hidden" name="collectionId" value={c.id} />
                    <input
                      type="hidden"
                      name="publish"
                      value={c.status === "published" ? "false" : "true"}
                    />
                    {c.status === "published" ? (
                      <ConfirmSubmit
                        confirm={`/collections/${c.handle} offline nehmen? Der Pfad ist danach nicht mehr erreichbar.`}
                      >
                        Als Entwurf
                      </ConfirmSubmit>
                    ) : (
                      <SubmitButton variant="secondary">Veröffentlichen</SubmitButton>
                    )}
                  </form>
                  {c.status !== "published" ? (
                    <form action={deleteCollectionAction}>
                      <input type="hidden" name="collectionId" value={c.id} />
                      <ConfirmSubmit
                        variant="danger"
                        confirm={`Kollektion „${input.title}“ endgültig löschen?`}
                      >
                        Löschen
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null
        }
      />
      {c ? (
        <p className="text-admin-text-2 -mt-3 mb-4 text-[13px]">
          {members.length} Produkte · zuletzt geändert {formatDateTime(c.updatedAt)}
          {updatedBy ? ` von ${updatedBy}` : ""}
        </p>
      ) : null}
      {!canEdit ? (
        <p className="rounded-admin-feld bg-admin-blau-hell mb-4 p-3 text-[14px]">
          Nur Ansicht: Kollektionen bearbeiten dürfen Owner und Admin.
        </p>
      ) : null}

      <ActionForm
        id={FORM_ID}
        action={saveCollectionFormAction}
        resetOnSuccess={false}
        className="kat-art"
      >
        <StateNotice />
        <fieldset disabled={!canEdit} className="contents">
          {c ? <input type="hidden" name="id" value={c.id} /> : null}
          <input type="hidden" name="locale" value="de" />
          <input type="hidden" name="imagePath" value={c?.imagePath ?? ""} />
          {input.position != null ? (
            <input type="hidden" name="position" value={String(input.position)} />
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              <Card title="Allgemein">
                <div className="flex flex-col gap-4">
                  <Field
                    name="title"
                    label="Titel"
                    required
                    defaultValue={input.title}
                    maxLength={200}
                  />
                  <RichTextEditor
                    name="descriptionHtml"
                    label="Beschreibung"
                    defaultValue={input.descriptionHtml ?? ""}
                  />
                </div>
              </Card>

              <Card
                title="Produkte"
                description="Manuell: du wählst die Produkte und ihre Reihenfolge. Automatisch: Bedingungen bestimmen die Produkte."
              >
                <div className="flex flex-col gap-4">
                  <RadioCards
                    name="kind"
                    legend="Art der Kollektion"
                    defaultValue={kind}
                    options={[
                      {
                        value: "manual",
                        label: "Manuell",
                        description: "Produkte einzeln auswählen und sortieren",
                      },
                      {
                        value: "automatic",
                        label: "Automatisch",
                        description: "Alle Produkte, die die Bedingungen erfüllen",
                      },
                    ]}
                  />
                  <Select
                    name="sortKey"
                    label="Sortierung im Shop"
                    defaultValue={input.sortKey ?? "manual"}
                    options={SORT_KEYS.map((s) => ({ value: s.value, label: s.label }))}
                    hint="Automatische Kollektionen brauchen eine automatische Sortierung."
                  />
                  <div className="kat-nur-manuell flex flex-col gap-4">
                    <ManualProductList
                      items={members.map((m) => ({
                        id: m.id,
                        title: m.title,
                        handle: m.handle,
                        status: m.status,
                        imageUrl: m.imageUrl,
                      }))}
                      disabled={!canEdit}
                    />
                    <StateError names={["productIds"]} />
                    {canEdit ? (
                      <details
                        className="rounded-admin-feld border-admin-rahmen-stark border border-dashed"
                        open={members.length === 0}
                      >
                        <summary className="text-admin-akzent flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[14px] font-semibold">
                          <Icon name="plus" size={16} />
                          Produkte hinzufügen
                        </summary>
                        <div className="p-3">
                          <PickerList
                            name="addProductIds"
                            legend="Produkte auswählen (werden ans Ende gesetzt)"
                            options={products
                              .filter((p) => !memberIds.has(p.id))
                              .map((p) => ({
                                value: p.id,
                                label: p.title,
                                meta:
                                  p.status === "active"
                                    ? `/products/${p.handle}`
                                    : p.status === "draft"
                                      ? "Entwurf"
                                      : "Archiviert",
                                imageUrl: p.imageUrl,
                              }))}
                            selected={[]}
                            emptyText="Alle Produkte sind schon in der Kollektion."
                          />
                        </div>
                      </details>
                    ) : null}
                  </div>
                  <div className="kat-nur-auto">
                    <StateError names={["rules"]} box />
                    <RulesEditor
                      rules={input.rules ?? []}
                      initialPreview={kind === "automatic" ? preview : []}
                      preview={previewRulesAction}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </Card>

              <Card title="Suchmaschinen (SEO)">
                <div className="flex flex-col gap-4">
                  <SeoFields
                    titleName="seoTitle"
                    descriptionName="seoDescription"
                    defaultTitle={input.seoTitle ?? ""}
                    defaultDescription={input.seoDescription ?? ""}
                    fallbackTitle={input.title}
                    fallbackDescription={input.descriptionHtml ?? ""}
                    pathPrefix="collections"
                    handle={input.handle ?? ""}
                  />
                  <HandleField
                    defaultValue={input.handle ?? ""}
                    prefix="/collections/"
                    exceptId={c?.id}
                    check={checkCollectionHandleAction}
                    followTitle={isNew}
                    note={
                      c
                        ? `provibe-drinks.de/collections/${c.handle} · Bei Änderung einer veröffentlichten Kollektion leitet der alte Pfad weiter.`
                        : undefined
                    }
                  />
                </div>
              </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Card title="Status">
                <Select
                  name="status"
                  label="Status"
                  defaultValue={input.status ?? "draft"}
                  options={[
                    { value: "published", label: "Veröffentlicht" },
                    { value: "draft", label: "Entwurf" },
                    { value: "archived", label: "Archiviert" },
                  ]}
                  hint="Veröffentlicht ist unter /collections/… erreichbar."
                />
              </Card>
              <Card
                title="Bild"
                description="Kopfbild der Kollektionsseite und Kachel in der Übersicht."
              >
                {c ? (
                  <div className="flex flex-col gap-3">
                    {c.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.imageUrl}
                        alt={`Bild der Kollektion ${input.title}`}
                        className="rounded-admin-feld bg-admin-flaeche aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="rounded-admin-feld bg-admin-flaeche text-admin-text-2 flex aspect-[4/3] items-center justify-center">
                        <Icon name="bild" size={28} />
                      </div>
                    )}
                    {canEdit ? (
                      <>
                        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                          Neues Bild (bis 2 MB)
                          <input
                            form={IMAGE_FORM}
                            type="file"
                            name="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="text-[13px] file:mr-3 file:rounded-[8px] file:border file:border-[var(--color-admin-rahmen-stark)] file:bg-transparent file:px-3 file:py-2"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            form={IMAGE_FORM}
                            className={buttonClasses("secondary", "sm")}
                          >
                            <Icon name="upload" size={16} />
                            Hochladen
                          </button>
                          {c.imageUrl ? (
                            <ConfirmSubmit
                              form={`${IMAGE_FORM}-entfernen`}
                              size="sm"
                              variant="text"
                              confirm="Bild entfernen?"
                            >
                              Bild entfernen
                            </ConfirmSubmit>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-admin-text-2 text-[14px]">
                    Ein Bild kannst du nach dem Anlegen hochladen.
                  </p>
                )}
              </Card>
              {c ? (
                <Card title="Übersicht">
                  <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[14px]">
                    <dt className="text-admin-text-2">Produkte</dt>
                    <dd className="text-right font-semibold">{members.length}</dd>
                    <dt className="text-admin-text-2">Pfad</dt>
                    <dd className="truncate text-right">/collections/{c.handle}</dd>
                    <dt className="text-admin-text-2">Angelegt</dt>
                    <dd className="text-right">{formatDateTime(c.createdAt)}</dd>
                  </dl>
                </Card>
              ) : null}
            </div>
          </div>
        </fieldset>
        {canEdit ? (
          <SaveBar
            formId={FORM_ID}
            alwaysVisible={isNew}
            saveLabel={isNew ? "Kollektion anlegen" : "Speichern"}
          />
        ) : null}
      </ActionForm>

      {c && canEdit ? (
        <>
          <form id={IMAGE_FORM} action={uploadCollectionImageAction} hidden>
            <input type="hidden" name="collectionId" value={c.id} />
          </form>
          <form id={`${IMAGE_FORM}-entfernen`} action={removeCollectionImageAction} hidden>
            <input type="hidden" name="collectionId" value={c.id} />
          </form>
        </>
      ) : null}
    </>
  );
}
