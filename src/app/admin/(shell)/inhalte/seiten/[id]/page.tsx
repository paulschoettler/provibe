import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { pageStatusAction } from "@/lib/admin/content/actions";
import { getPage, hasFixedRoute } from "@/lib/admin/content/pages";
import { sanitizeRichHtml } from "@/lib/admin/content/sanitize";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { PageForm } from "@/components/admin/content/PageForm";
import { InfoRow, PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { formatDateTime } from "@/components/admin/ui/format";
import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Tabs } from "@/components/admin/ui/Tabs";

export const metadata: Metadata = { title: "Seite bearbeiten" };

/**
 * /admin/inhalte/seiten/[id]: Editor mit Titel, URL-Name, Inhalt, SEO und Status.
 * ?ansicht=vorschau zeigt den gespeicherten Inhalt so bereinigt, wie die Storefront ihn bekommt.
 */
export default async function PageEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { id } = await params;
  const path = `/admin/inhalte/seiten/${id}`;
  const session = await requireStaff("support", { next: path });
  const canEdit = PERMISSIONS.editContent(session);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = await getPage(id);
  if (!page) notFound();
  const preview = firstParam((await searchParams).ansicht) === "vorschau";
  const fixed = hasFixedRoute(page.template);

  const status = (
    <Card title="Status">
      <dl>
        <InfoRow label="Status">
          <PublishBadge status={page.status} />
        </InfoRow>
        <InfoRow label="Veröffentlicht">
          {page.publishedAt ? formatDateTime(page.publishedAt) : "noch nie"}
        </InfoRow>
        <InfoRow label="Zuletzt geändert">{formatDateTime(page.updatedAt)}</InfoRow>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && page.status !== "published" ? (
          <InlineAction
            action={pageStatusAction}
            fields={{ id: page.id, intent: "publish" }}
            label="Veröffentlichen"
            variant="primary"
          />
        ) : null}
        {canEdit && page.status === "published" ? (
          <InlineAction
            action={pageStatusAction}
            fields={{ id: page.id, intent: "unpublish" }}
            label="Zurück auf Entwurf"
            confirm={{
              title: "Seite offline nehmen?",
              description: `${page.path} ist danach nicht mehr erreichbar (404), bis du sie wieder veröffentlichst.`,
              confirmLabel: "Offline nehmen",
              danger: true,
            }}
          />
        ) : null}
        {canEdit && page.status !== "archived" && !fixed ? (
          <InlineAction
            action={pageStatusAction}
            fields={{ id: page.id, intent: "archive" }}
            label="Archivieren"
            variant="text"
            confirm={{
              title: "Seite archivieren?",
              description:
                "Archivierte Seiten sind nicht mehr erreichbar. Lege bei Bedarf eine Weiterleitung an.",
              confirmLabel: "Archivieren",
              danger: true,
            }}
          />
        ) : null}
        {page.status === "published" ? (
          <ButtonLink href={page.path} variant="text" size="sm" icon="extern" target="_blank">
            Live ansehen
          </ButtonLink>
        ) : null}
      </div>
      <p className="text-admin-text-2 mt-3 text-[12px]">
        Nach dem Speichern erneuert die Storefront die Seite sofort (Tag content).
      </p>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={page.title || page.handle}
        meta={<PublishBadge status={page.status} />}
        backHref="/admin/inhalte/seiten"
        backLabel="Zurück zu den Seiten"
        description={page.path}
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <Tabs
        label="Ansicht"
        className="mb-4"
        items={[
          { label: "Bearbeiten", href: path, active: !preview },
          { label: "Vorschau", href: `${path}?ansicht=vorschau`, active: preview },
        ]}
      />
      {preview ? (
        <Card
          title={page.title}
          description="Gespeicherter Stand, bereinigt wie auf der Storefront. Das Layout der Storefront kann abweichen."
        >
          <div
            className="admin-inhalte-prosa max-w-[70ch] text-[15px] leading-[1.6]"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.bodyHtml) }}
          />
        </Card>
      ) : (
        <PageForm
          canEdit={canEdit}
          fixedRoute={fixed}
          aside={status}
          page={{
            id: page.id,
            title: page.title,
            handle: page.handle,
            template: page.template,
            bodyHtml: page.bodyHtml,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            ogImagePath: page.ogImagePath,
            noindex: page.noindex,
            showInSitemap: page.showInSitemap,
            position: page.position,
          }}
        />
      )}
    </>
  );
}
