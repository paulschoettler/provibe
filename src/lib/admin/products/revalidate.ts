import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { catalogRevalidateTargets } from "./rules";

/**
 * On-Demand-Revalidation nach Katalogänderungen im Backoffice (Briefing 1).
 *
 * Die Storefront liest Katalogdaten mit dem Cache-Tag "catalog" (src/lib/catalog/products.ts)
 * und ist mit revalidate = 3600 statisch. Hier wird der Tag mit { expire: 0 } erneuert, nicht
 * mit "max": Preise, Pfand und Grundpreis sind Pflichtangaben (PAngV), ein veralteter Preis
 * auf der Produktseite soll nach dem Speichern nicht einmal mehr ausgeliefert werden.
 * revalidatePath erneuert zusätzlich die betroffenen Seiten sofort.
 */
export const CATALOG_TAG = "catalog";

export function revalidateCatalog(scope: {
  productHandles?: string[];
  collectionHandles?: string[];
  allProducts?: boolean;
  allCollections?: boolean;
}): void {
  revalidateTag(CATALOG_TAG, { expire: 0 });
  for (const t of catalogRevalidateTargets(scope)) {
    if (t.type) revalidatePath(t.path, t.type);
    else revalidatePath(t.path);
  }
}
