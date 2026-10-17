import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { NoAccess } from "@/components/admin/NoAccess";
import { BlogForm } from "@/components/admin/content/BlogForm";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Beitrag schreiben" };

/** /admin/inhalte/blog/neu: neuer Beitrag als Entwurf. */
export default async function NewBlogPostPage() {
  const session = await requireStaff("support", { next: "/admin/inhalte/blog/neu" });
  if (!PERMISSIONS.editContent(session)) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Beitrag schreiben"
        backHref="/admin/inhalte/blog"
        backLabel="Zurück zum Blog"
      />
      <BlogForm
        canEdit
        post={{
          title: "",
          handle: "",
          status: "draft",
          excerpt: null,
          bodyHtml: "",
          coverImagePath: null,
          authorName: null,
          seoTitle: null,
          seoDescription: null,
        }}
      />
    </>
  );
}
