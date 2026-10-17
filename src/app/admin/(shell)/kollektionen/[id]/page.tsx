import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { getCollectionForEdit, previewCollectionRules } from "@/lib/admin/collections/data";
import { lastEditorOf, listProductOptions } from "@/lib/admin/products/data";
import { CollectionEditor } from "@/components/admin/catalog/CollectionEditor";

export const metadata: Metadata = { title: "Kollektion bearbeiten" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CollectionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `/admin/kollektionen/${id}` });
  if (!UUID.test(id)) notFound();
  const data = await getCollectionForEdit(id);
  if (!data) notFound();
  const canEdit = PERMISSIONS.editProducts(session);
  const [products, preview, updatedBy] = await Promise.all([
    canEdit ? listProductOptions() : Promise.resolve([]),
    data.collection.kind === "automatic"
      ? previewCollectionRules(data.collection.rules, String(data.formInput.sortKey ?? "title-asc"))
      : Promise.resolve(null),
    lastEditorOf("collection", id),
  ]);
  return (
    <CollectionEditor
      data={data}
      input={data.formInput}
      products={products}
      preview={preview && preview.ok ? preview.data.items : []}
      canEdit={canEdit}
      updatedBy={updatedBy}
    />
  );
}
