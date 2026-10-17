import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { listCollections } from "@/lib/admin/collections/data";
import { listTaxClasses } from "@/lib/admin/products/data";
import { isProductLine, kindForLine } from "@/lib/admin/products/lines";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";

export const metadata: Metadata = { title: "Produkt hinzufügen" };

/**
 * /admin/produkte/neu: gleicher Editor ohne Bilder, Bundle-Komponenten und Preis-Historie.
 * Das Produkt entsteht als Entwurf mit der ersten Variante, danach geht es im Editor weiter.
 * ?typ=sorte|mixed|bundle|merch belegt den Typ vor.
 */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: "/admin/produkte/neu" });
  if (!PERMISSIONS.editProducts(session))
    return (
      <>
        <PageHeader title="Produkt hinzufügen" />
        <NoAccess text="Produkte anlegen dürfen nur Owner und Admin." />
      </>
    );
  const sp = await searchParams;
  const t = firstParam(sp.typ);
  const line = isProductLine(t) ? t : "sorte";
  const isFood = line === "sorte" || line === "mixed";
  const [collections, taxClasses] = await Promise.all([listCollections(), listTaxClasses()]);

  return (
    <ProductEditor
      mode="new"
      canEdit
      input={{
        title: "",
        status: "draft",
        kind: kindForLine(line),
        vendor: "provibe",
        tags: [],
        isFood,
        depositCentsPerUnit: 0,
        unitLabel: isFood ? "Dose" : "Stück",
        netContentPerUnit: isFood ? 0.33 : null,
        netContentMeasure: isFood ? "l" : "piece",
        basePriceMeasure: isFood ? "l" : "piece",
        taxClass: "standard",
        productType: line === "merch" ? "Merchandise" : line === "bundle" ? "Bundle" : "Eistee",
      }}
      variants={[]}
      line={line}
      data={null}
      collections={collections.map((c) => ({
        id: c.id,
        handle: c.handle,
        title: c.title,
        kind: c.kind,
        status: c.status,
        member: false,
        position: null,
      }))}
      taxClasses={taxClasses}
      candidates={[]}
      stock={{}}
      depositByVariant={{}}
      priceHistory={[]}
      availableTotal={null}
      updatedBy={null}
    />
  );
}
