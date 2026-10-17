import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listCollections } from "@/lib/admin/collections/data";
import { getDiscountForEdit, getDiscountUsage } from "@/lib/admin/discounts/data";
import { listProductOptions } from "@/lib/admin/products/data";
import { DiscountEditor } from "@/components/admin/catalog/DiscountEditor";

export const metadata: Metadata = { title: "Rabatt" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /admin/rabatte/[id]: Code, Regeln und Nutzung (discount_redemptions). */
export default async function DiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `/admin/rabatte/${id}` });
  if (!UUID.test(id)) notFound();
  const data = await getDiscountForEdit(id);
  if (!data) notFound();
  const canEdit = PERMISSIONS.editProducts(session);
  const [usage, products, collections] = await Promise.all([
    getDiscountUsage(id, session),
    listProductOptions(),
    listCollections(),
  ]);
  return (
    <DiscountEditor
      data={data}
      input={data.formInput}
      usage={usage}
      products={products}
      collections={collections}
      canEdit={canEdit}
    />
  );
}
