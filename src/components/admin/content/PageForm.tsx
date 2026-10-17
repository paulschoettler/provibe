import { savePageAction } from "@/lib/admin/content/actions";
import { PAGE_TEMPLATE_LABELS, PAGE_TEMPLATES } from "@/lib/admin/content/pages";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { Checkbox, Field, Select, Textarea } from "@/components/admin/ui/fields";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { ImageField } from "./ImageField";
import { RichTextEditor } from "./RichTextEditor";

export interface PageFormValues {
  id?: string;
  title: string;
  handle: string;
  template: string;
  bodyHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImagePath: string | null;
  noindex: boolean;
  showInSitemap: boolean;
  position: number;
}

/**
 * Formular einer Inhaltsseite (Titel, URL-Name, Inhalt, SEO). Status und Vorschau stehen
 * daneben in eigenen Formularen. Seiten mit eigener Vorlage behalten URL-Namen und Vorlage.
 */
export function PageForm({
  page,
  canEdit,
  fixedRoute,
  aside,
}: {
  page: PageFormValues;
  canEdit: boolean;
  fixedRoute: boolean;
  aside?: React.ReactNode;
}) {
  const formId = page.id ? `seite-${page.id}` : "seite-neu";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {aside ? (
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">{aside}</div>
      ) : null}
      <ActionForm
        id={formId}
        action={savePageAction}
        resetOnSuccess={false}
        className="contents"
        hideMessage
      >
        <ActionFormMessage className="col-span-full" />
        {page.id ? <input type="hidden" name="id" value={page.id} /> : null}
        <input type="hidden" name="position" value={page.position} />
        {fixedRoute ? (
          <>
            <input type="hidden" name="handle" value={page.handle} />
            <input type="hidden" name="template" value={page.template} />
          </>
        ) : null}
        <fieldset disabled={!canEdit} className="contents">
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <Card>
              <div className="flex flex-col gap-4">
                <Field
                  name="title"
                  label="Titel"
                  defaultValue={page.title}
                  required
                  maxLength={200}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    name={fixedRoute ? "handle_anzeige" : "handle"}
                    label="URL-Name"
                    prefix="/pages/"
                    defaultValue={page.handle}
                    disabled={fixedRoute}
                    required
                    hint={
                      fixedRoute
                        ? "Fest, weil die Storefront eine eigene Route für diese Seite hat."
                        : page.id
                          ? "Ändern legt automatisch eine 301-Weiterleitung vom alten Pfad an."
                          : "Kleinbuchstaben, Ziffern und Bindestriche."
                    }
                  />
                  <Select
                    name={fixedRoute ? "template_anzeige" : "template"}
                    label="Vorlage"
                    defaultValue={page.template}
                    disabled={fixedRoute || !page.id}
                    options={PAGE_TEMPLATES.filter((t) => fixedRoute || t === "default").map(
                      (t) => ({
                        value: t,
                        label: PAGE_TEMPLATE_LABELS[t],
                      }),
                    )}
                    hint={
                      fixedRoute
                        ? "Layout kommt aus dem Code, Texte und SEO von hier."
                        : "Neue Seiten nutzen die Standardvorlage."
                    }
                  />
                </div>
                <RichTextEditor
                  name="bodyHtml"
                  label="Inhalt"
                  defaultValue={page.bodyHtml}
                  disabled={!canEdit}
                  hint="Wird beim Speichern bereinigt: keine Skripte, nur sichere Links. Überschrift 1 setzt die Seite selbst."
                />
              </div>
            </Card>
          </div>
          <div
            className={`flex min-w-0 flex-col gap-4 lg:col-start-2 ${aside ? "lg:row-start-2" : "lg:row-start-1"}`}
          >
            <Card title="Suchmaschinen">
              <div className="flex flex-col gap-4">
                <Field
                  name="seoTitle"
                  label="SEO-Titel"
                  defaultValue={page.seoTitle ?? ""}
                  maxLength={120}
                  hint="Leer: Seitentitel. Höchstens 60 Zeichen werden sicher angezeigt."
                />
                <Textarea
                  name="seoDescription"
                  label="Meta-Beschreibung"
                  defaultValue={page.seoDescription ?? ""}
                  maxLength={320}
                  rows={3}
                />
                <ImageField
                  name="ogImagePath"
                  label="Vorschaubild (Social)"
                  defaultValue={page.ogImagePath ?? ""}
                  disabled={!canEdit}
                />
                <Checkbox
                  name="noindex"
                  label="Nicht indexieren (noindex)"
                  description="Zum Beispiel für die Investoren-Seite"
                  defaultChecked={page.noindex}
                />
                <Checkbox
                  name="showInSitemap"
                  label="In der Sitemap"
                  defaultChecked={page.showInSitemap}
                />
              </div>
            </Card>
          </div>
        </fieldset>
        {canEdit ? (
          <div className="col-span-full">
            <SaveBar
              formId={formId}
              alwaysVisible={!page.id}
              saveLabel={page.id ? "Speichern" : "Als Entwurf anlegen"}
            />
          </div>
        ) : null}
      </ActionForm>
    </div>
  );
}
