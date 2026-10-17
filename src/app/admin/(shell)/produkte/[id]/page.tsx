import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { automaticMatchesFor } from "@/lib/admin/collections/data";
import {
  availableByVariant,
  depositByVariant,
  getProductForEdit,
  lastEditorOf,
  listComponentCandidates,
  listPriceHistory,
  UNLIMITED_STOCK,
} from "@/lib/admin/products/data";
import { productLineOf } from "@/lib/admin/products/lines";
import { ProductEditor } from "@/components/admin/catalog/ProductEditor";

export const metadata: Metadata = { title: "Produkt bearbeiten" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /admin/produkte/[id]: Produkt-Editor (Figma 40:13025, 41:13346, 41:13690). */
export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `/admin/produkte/${id}` });
  if (!UUID.test(id)) notFound();
  // unabhängige Abfragen parallel (die Datenbank steht in Frankfurt, jede Runde kostet Zeit)
  const [data, priceHistory, updatedBy, autoMatches] = await Promise.all([
    getProductForEdit(id),
    listPriceHistory(id),
    lastEditorOf("product", id),
    automaticMatchesFor(id),
  ]);
  if (!data) notFound();
  const canEdit = PERMISSIONS.editProducts(session);
  const p = data.product;
  const isBundle = p.kind === "bundle";
  const componentIds = data.variants.flatMap((v) => v.components.map((c) => c.componentVariantId));

  const [candidates, stock, deposits] = await Promise.all([
    isBundle && canEdit ? listComponentCandidates() : Promise.resolve([]),
    isBundle ? availableByVariant(componentIds) : Promise.resolve({}),
    isBundle ? depositByVariant(componentIds) : Promise.resolve({}),
  ]);
  const collections = data.collections.map((c) =>
    c.kind === "automatic" ? { ...c, member: autoMatches.has(c.id) } : c,
  );

  const tracked = data.variants.filter(
    (v) =>
      v.inventory?.trackInventory &&
      v.inventory.available != null &&
      v.inventory.available < UNLIMITED_STOCK,
  );
  const availableTotal = tracked.length
    ? tracked.reduce((s, v) => s + (v.inventory?.available ?? 0), 0)
    : null;

  return (
    <ProductEditor
      mode="edit"
      canEdit={canEdit}
      input={data.formInput}
      variants={data.variantsInput}
      line={productLineOf({
        kind: p.kind,
        handle: p.handle,
        tags: p.tags,
        productType: p.productType,
        isFood: p.isFood,
        attributes: p.attributes,
      })}
      data={data}
      collections={collections}
      taxClasses={data.taxClasses}
      candidates={candidates}
      stock={stock}
      depositByVariant={deposits}
      priceHistory={priceHistory}
      availableTotal={availableTotal}
      updatedBy={updatedBy}
    />
  );
}
