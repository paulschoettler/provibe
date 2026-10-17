import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { blogStatusAction } from "@/lib/admin/content/actions";
import { getBlogPost } from "@/lib/admin/content/blog";
import { BlogForm } from "@/components/admin/content/BlogForm";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { InfoRow, PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { formatDateTime } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Beitrag bearbeiten" };

/** /admin/inhalte/blog/[id]: Editor mit Status (veröffentlichen, zurückziehen, archivieren, löschen). */
export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `/admin/inhalte/blog/${id}` });
  const canEdit = PERMISSIONS.editContent(session);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const post = await getBlogPost(id);
  if (!post) notFound();

  const status = (
    <Card title="Status">
      <dl>
        <InfoRow label="Status">
          <PublishBadge status={post.status} />
        </InfoRow>
        <InfoRow label="Veröffentlicht">
          {post.publishedAt ? formatDateTime(post.publishedAt) : "noch nie"}
        </InfoRow>
        <InfoRow label="Zuletzt geändert">{formatDateTime(post.updatedAt)}</InfoRow>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {canEdit && post.status !== "published" ? (
          <InlineAction
            action={blogStatusAction}
            fields={{ id: post.id, intent: "publish" }}
            label="Veröffentlichen"
            variant="primary"
          />
        ) : null}
        {canEdit && post.status === "published" ? (
          <InlineAction
            action={blogStatusAction}
            fields={{ id: post.id, intent: "unpublish" }}
            label="Zurückziehen"
            confirm={{
              title: "Beitrag zurückziehen?",
              description: `${post.path} ist danach nicht mehr erreichbar.`,
              confirmLabel: "Zurückziehen",
              danger: true,
            }}
          />
        ) : null}
        {canEdit && post.status !== "archived" && post.publishedAt ? (
          <InlineAction
            action={blogStatusAction}
            fields={{ id: post.id, intent: "archive" }}
            label="Archivieren"
            variant="text"
          />
        ) : null}
        {canEdit && post.status === "draft" && !post.publishedAt ? (
          <InlineAction
            action={blogStatusAction}
            fields={{ id: post.id, intent: "delete" }}
            label="Löschen"
            variant="text"
            confirm={{
              title: "Entwurf löschen?",
              description: "Nie veröffentlichte Entwürfe lassen sich endgültig löschen.",
              confirmLabel: "Löschen",
              danger: true,
            }}
          />
        ) : null}
        {post.status === "published" ? (
          <ButtonLink href={post.path} target="_blank" variant="text" size="sm" icon="extern">
            Live ansehen
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={post.title || "Beitrag"}
        meta={<PublishBadge status={post.status} />}
        backHref="/admin/inhalte/blog"
        backLabel="Zurück zum Blog"
        description={post.path}
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      <BlogForm
        canEdit={canEdit}
        aside={status}
        post={{
          id: post.id,
          title: post.title,
          handle: post.handle,
          status: post.status,
          excerpt: post.excerpt,
          bodyHtml: post.bodyHtml,
          coverImagePath: post.coverImagePath,
          authorName: post.authorName,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
        }}
      />
    </>
  );
}
