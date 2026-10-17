import { saveBlogPostAction } from "@/lib/admin/content/actions";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { Field, Textarea } from "@/components/admin/ui/fields";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { ImageField } from "./ImageField";
import { RichTextEditor } from "./RichTextEditor";

export interface BlogFormValues {
  id?: string;
  title: string;
  handle: string;
  status: "draft" | "published" | "archived";
  excerpt: string | null;
  bodyHtml: string;
  coverImagePath: string | null;
  authorName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/**
 * Blogbeitrag (Figma-Muster wie Seiten): Titel, URL-Name, Teaser, Text, Titelbild, Autorin,
 * SEO. Veröffentlichte Beiträge behalten ihren URL-Namen (Links und Rankings).
 * Gleiche Rasteraufteilung wie PageForm: das Formular ist display:contents, damit die
 * Statuskarte (eigene Formulare) daneben stehen kann, ohne verschachtelte Formulare.
 */
export function BlogForm({
  post,
  canEdit,
  aside,
}: {
  post: BlogFormValues;
  canEdit: boolean;
  aside?: React.ReactNode;
}) {
  const formId = post.id ? `blog-${post.id}` : "blog-neu";
  const handleLocked = post.status === "published";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {aside ? (
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">{aside}</div>
      ) : null}
      <ActionForm
        id={formId}
        action={saveBlogPostAction}
        resetOnSuccess={false}
        className="contents"
        hideMessage
      >
        <ActionFormMessage className="col-span-full" />
        {post.id ? <input type="hidden" name="id" value={post.id} /> : null}
        {handleLocked ? <input type="hidden" name="handle" value={post.handle} /> : null}
        <fieldset disabled={!canEdit} className="contents">
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <Card>
              <div className="flex flex-col gap-4">
                <Field
                  name="title"
                  label="Titel"
                  defaultValue={post.title}
                  required
                  maxLength={200}
                />
                <Field
                  name={handleLocked ? "handle_anzeige" : "handle"}
                  label="URL-Name"
                  prefix="/blogs/news/"
                  defaultValue={post.handle}
                  disabled={handleLocked}
                  hint={
                    handleLocked
                      ? "Fest, weil der Beitrag veröffentlicht ist."
                      : "Leer: wird aus dem Titel gebildet."
                  }
                />
                <Textarea
                  name="excerpt"
                  label="Teaser"
                  defaultValue={post.excerpt ?? ""}
                  rows={3}
                  maxLength={400}
                  hint="Erscheint in der Beitragsliste."
                />
                <RichTextEditor
                  name="bodyHtml"
                  label="Text"
                  defaultValue={post.bodyHtml}
                  disabled={!canEdit}
                  hint="Titel und Text sind Pflicht zum Veröffentlichen."
                />
              </div>
            </Card>
          </div>
          <div
            className={`flex min-w-0 flex-col gap-4 lg:col-start-2 ${aside ? "lg:row-start-2" : "lg:row-start-1"}`}
          >
            <Card title="Titelbild und Autorin">
              <div className="flex flex-col gap-4">
                <ImageField
                  name="coverImagePath"
                  label="Titelbild"
                  defaultValue={post.coverImagePath ?? ""}
                  disabled={!canEdit}
                />
                <Field
                  name="authorName"
                  label="Autorin oder Autor"
                  defaultValue={post.authorName ?? ""}
                  maxLength={120}
                  placeholder="Celine Grimm"
                />
              </div>
            </Card>
            <Card title="Suchmaschinen">
              <div className="flex flex-col gap-4">
                <Field
                  name="seoTitle"
                  label="SEO-Titel"
                  defaultValue={post.seoTitle ?? ""}
                  maxLength={120}
                />
                <Textarea
                  name="seoDescription"
                  label="Meta-Beschreibung"
                  defaultValue={post.seoDescription ?? ""}
                  rows={3}
                  maxLength={320}
                />
              </div>
            </Card>
          </div>
        </fieldset>
        {canEdit ? (
          <div className="col-span-full">
            <SaveBar
              formId={formId}
              alwaysVisible={!post.id}
              saveLabel={post.id ? "Speichern" : "Als Entwurf anlegen"}
            />
          </div>
        ) : null}
      </ActionForm>
    </div>
  );
}
