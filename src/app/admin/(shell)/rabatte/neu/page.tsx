import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listCollections } from "@/lib/admin/collections/data";
import { listProductOptions } from "@/lib/admin/products/data";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { DiscountEditor } from "@/components/admin/catalog/DiscountEditor";

export const metadata: Metadata = { title: "Rabatt anlegen" };

export default async function NewDiscountPage() {
  const session = await requireStaff("support", { next: "/admin/rabatte/neu" });
  if (!PERMISSIONS.editProducts(session))
    return (
      <>
        <PageHeader title="Rabatt anlegen" />
        <NoAccess text="Rabatte anlegen dürfen nur Owner und Admin." />
      </>
    );
  const [products, collections] = await Promise.all([listProductOptions(), listCollections()]);
  return (
    <DiscountEditor
      data={null}
      input={{
        code: "",
        kind: "percentage",
        value: 1000,
        appliesTo: { scope: "order" },
        isActive: true,
      }}
      usage={null}
      products={products}
      collections={collections}
      canEdit
    />
  );
}
