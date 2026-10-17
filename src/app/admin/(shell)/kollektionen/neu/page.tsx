import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listProductOptions } from "@/lib/admin/products/data";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CollectionEditor } from "@/components/admin/catalog/CollectionEditor";

export const metadata: Metadata = { title: "Kollektion anlegen" };

export default async function NewCollectionPage() {
  const session = await requireStaff("support", { next: "/admin/kollektionen/neu" });
  if (!PERMISSIONS.editProducts(session))
    return (
      <>
        <PageHeader title="Kollektion anlegen" />
        <NoAccess text="Kollektionen anlegen dürfen nur Owner und Admin." />
      </>
    );
  const products = await listProductOptions();
  return (
    <CollectionEditor
      data={null}
      input={{ title: "", kind: "manual", sortKey: "manual", status: "draft", rules: [] }}
      products={products}
      preview={[]}
      canEdit
      updatedBy={null}
    />
  );
}
