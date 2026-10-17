import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageForm } from "@/components/admin/content/PageForm";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Seite anlegen" };

/** /admin/inhalte/seiten/neu: neue Inhaltsseite als Entwurf (Standardvorlage). */
export default async function NewPagePage() {
  const session = await requireStaff("support", { next: "/admin/inhalte/seiten/neu" });
  if (!PERMISSIONS.editContent(session)) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Seite anlegen"
        backHref="/admin/inhalte/seiten"
        backLabel="Zurück zu den Seiten"
        description="Die Seite entsteht als Entwurf und ist erst nach dem Veröffentlichen live."
      />
      <PageForm
        canEdit
        fixedRoute={false}
        page={{
          title: "",
          handle: "",
          template: "default",
          bodyHtml: "",
          seoTitle: null,
          seoDescription: null,
          ogImagePath: null,
          noindex: false,
          showInSitemap: true,
          position: 100,
        }}
      />
    </>
  );
}
