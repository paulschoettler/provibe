import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listBlogPosts, type BlogPostListItem } from "@/lib/admin/content/blog";
import { contentImageUrl } from "@/lib/admin/content/image-url";
import { Hint, PublishBadge, ReadOnlyNotice } from "@/components/admin/content/parts";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate } from "@/components/admin/ui/format";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CardRow, Table } from "@/components/admin/ui/Table";

export const metadata: Metadata = { title: "Blog" };

const PATH = "/admin/inhalte/blog";

function Cover({ path }: { path: string | null }) {
  const url = contentImageUrl(path);
  return (
    <span className="bg-admin-flaeche rounded-admin-feld flex size-11 shrink-0 items-center justify-center overflow-hidden">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- kleine Vorschau aus dem Storage
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : null}
    </span>
  );
}

/** /admin/inhalte/blog: Beiträge unter /blogs/news, leer und noindex bis zum ersten Beitrag. */
export default async function BlogListPage() {
  const session = await requireStaff("support", { next: PATH });
  const canEdit = PERMISSIONS.editContent(session);
  let posts: BlogPostListItem[] = [];
  let failed = false;
  try {
    posts = await listBlogPosts();
  } catch {
    failed = true;
  }
  const published = posts.filter((p) => p.status === "published").length;
  return (
    <>
      <PageHeader
        title="Blog"
        description="Magazin unter /blogs/news"
        actions={
          canEdit ? (
            <ButtonLink href={`${PATH}/neu`} variant="primary" icon="plus">
              Beitrag schreiben
            </ButtonLink>
          ) : null
        }
      />
      {!canEdit ? <ReadOnlyNotice /> : null}
      {failed ? (
        <FormMessage tone="error">Der Blog konnte gerade nicht geladen werden.</FormMessage>
      ) : null}
      {published === 0 ? (
        <Hint tone="info" className="mb-4">
          Solange kein Beitrag veröffentlicht ist, bleibt /blogs/news mit Hinweistext auf noindex.
        </Hint>
      ) : null}
      <Table
        caption="Blogbeiträge"
        rows={posts}
        rowKey={(p) => p.id}
        rowHref={(p) => `${PATH}/${p.id}`}
        density="media"
        columns={[
          {
            key: "titel",
            header: "Beitrag",
            cell: (p) => (
              <span className="flex min-w-0 items-center gap-3">
                <Cover path={p.coverImagePath} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="text-admin-text-2 block truncate text-[12px]">{p.path}</span>
                </span>
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "140px",
            cell: (p) => <PublishBadge status={p.status} />,
          },
          {
            key: "datum",
            header: "Veröffentlicht",
            width: "130px",
            cell: (p) => (p.publishedAt ? formatDate(p.publishedAt) : "–"),
          },
        ]}
        renderCard={(p) => (
          <CardRow
            primary={p.title}
            secondary={p.path}
            badges={<PublishBadge status={p.status} />}
            secondaryAside={p.publishedAt ? formatDate(p.publishedAt) : undefined}
          />
        )}
        empty={
          <EmptyState
            icon="notiz"
            title="Noch keine Beiträge"
            action={
              canEdit ? (
                <ButtonLink href={`${PATH}/neu`} icon="plus">
                  Ersten Beitrag schreiben
                </ButtonLink>
              ) : undefined
            }
          >
            Der Blog bereitet SEO-Inhalte vor, zum Beispiel Rezepte oder Hintergründe zu Protein.
          </EmptyState>
        }
      />
    </>
  );
}
