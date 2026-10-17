import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { ordersDb } from "./db";
import {
  capRestock,
  directlyBookedVariants,
  expandStock,
  packUnitsFrom,
  readComponents,
  restockableByVariant,
  type CappedRestock,
} from "./stock";

/**
 * Bestand einer Bestellung zurückbuchen (inventory_movements über apply_inventory_movement).
 * Gebucht wird auf Lagereinheiten (H24: Dosen je Sorte, Merch), Packs lösen über ihre
 * bundle_components auf. Höchstens das, was für diese Bestellung als Abgang gebucht und noch nicht
 * zurückgebucht wurde.
 * reason: refund_restock (Erstattung) oder correction (Storno).
 */
export async function restockOrderItems(input: {
  orderId: string;
  orderNumber: string;
  lines: { orderItemId: string; quantity: number }[];
  reason: "refund_restock" | "correction";
  note: string;
  actor: StaffSession | null;
}): Promise<CappedRestock> {
  const db = ordersDb();
  const ids = input.lines.filter((l) => l.quantity > 0).map((l) => l.orderItemId);
  if (ids.length === 0) return { apply: [], skipped: [] };

  const [{ data: items }, { data: movements }] = await Promise.all([
    db.from("order_items").select("id, variant_id, components").in("id", ids),
    db
      .from("inventory_movements")
      .select("variant_id, delta, reason")
      .eq("reference_type", "order")
      .eq("reference_id", input.orderId),
  ]);
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const stockItems = input.lines.map((l) => {
    const item = byId.get(l.orderItemId);
    return {
      variantId: item?.variant_id ?? null,
      components: readComponents(item?.components),
      quantity: item ? l.quantity : 0,
    };
  });
  // Packs (auch als Bundle-Komponente) auf ihre Lagereinheiten auflösen
  const candidates = [
    ...new Set(
      stockItems.flatMap((i) =>
        i.components ? i.components.map((c) => c.variant_id) : i.variantId ? [i.variantId] : [],
      ),
    ),
  ];
  const { data: packRows } = candidates.length
    ? await db
        .from("bundle_components")
        .select("bundle_variant_id, component_variant_id, quantity")
        .in("bundle_variant_id", candidates)
    : { data: [] };
  const requested = expandStock(stockItems, {
    packUnits: packUnitsFrom(packRows ?? []),
    bookedDirectly: directlyBookedVariants(movements ?? []),
  });
  const capped = capRestock(requested, restockableByVariant(movements ?? []));

  for (const m of capped.apply) {
    const { error } = await db.rpc("apply_inventory_movement", {
      p_variant_id: m.variantId,
      p_delta: m.quantity,
      p_reason: input.reason,
      p_reference_type: "order",
      p_reference_id: input.orderId,
      p_note: input.note.slice(0, 500),
      p_actor: input.actor?.userId ?? undefined,
    });
    if (error) throw new Error(`Bestand konnte nicht zurückgebucht werden: ${error.message}`);
  }
  return capped;
}
