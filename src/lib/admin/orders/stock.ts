/**
 * Bestandsrückbuchung (Erstattung mit Rückbuchung, Storno). Reine Funktionen.
 *
 * Die Auflösung spiegelt reserve_stock/commit_reservations (0004): eine einfache Variante bucht
 * sich selbst, ein Bundle seine Komponenten (Snapshot order_items.components, Menge × Komponenten-
 * menge). Zurückgebucht wird höchstens, was für diese Bestellung als Abgang (reason sale) gebucht
 * und noch nicht zurückgebucht wurde, damit Storno und Erstattung nie doppelt einbuchen.
 */

export interface StockComponent {
  variant_id: string;
  quantity: number;
}

export interface StockItem {
  variantId: string | null;
  components: StockComponent[] | null;
  quantity: number;
}

/** Varianten-Mengen für die angegebenen Positionsmengen. */
export function expandStock(items: StockItem[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (variantId: string, qty: number) => {
    if (qty <= 0) return;
    out.set(variantId, (out.get(variantId) ?? 0) + qty);
  };
  for (const item of items) {
    if (item.quantity <= 0) continue;
    if (item.components && item.components.length > 0) {
      for (const c of item.components) add(c.variant_id, item.quantity * c.quantity);
    } else if (item.variantId) {
      add(item.variantId, item.quantity);
    }
  }
  return out;
}

export interface StockMovementRow {
  variant_id: string;
  delta: number;
  reason: string;
}

/**
 * Noch rückbuchbare Menge je Variante: Abgänge (sale, negative delta) minus bereits gebuchte
 * Zugänge dieser Bestellung (refund_restock, correction mit positiver delta).
 */
export function restockableByVariant(movements: StockMovementRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of movements) {
    let change = 0;
    if (m.reason === "sale" && m.delta < 0) change = -m.delta;
    else if (m.delta > 0) change = -m.delta;
    if (change !== 0) out.set(m.variant_id, (out.get(m.variant_id) ?? 0) + change);
  }
  for (const [k, v] of out) if (v < 0) out.set(k, 0);
  return out;
}

export interface CappedRestock {
  /** tatsächlich zurückzubuchen */
  apply: { variantId: string; quantity: number }[];
  /** gewünscht, aber nicht als Abgang dieser Bestellung gebucht (wird nicht eingebucht) */
  skipped: { variantId: string; quantity: number }[];
}

export function capRestock(
  requested: Map<string, number>,
  available: Map<string, number>,
): CappedRestock {
  const apply: CappedRestock["apply"] = [];
  const skipped: CappedRestock["skipped"] = [];
  for (const [variantId, qty] of requested) {
    const open = available.get(variantId) ?? 0;
    const take = Math.min(qty, open);
    if (take > 0) apply.push({ variantId, quantity: take });
    if (qty > take) skipped.push({ variantId, quantity: qty - take });
  }
  return { apply, skipped };
}

/** Komponenten-Snapshot aus order_items.components lesen (jsonb, tolerant). */
export function readComponents(value: unknown): StockComponent[] | null {
  if (!Array.isArray(value)) return null;
  const out: StockComponent[] = [];
  for (const raw of value) {
    const c = raw as { variant_id?: unknown; quantity?: unknown };
    if (typeof c?.variant_id === "string" && typeof c.quantity === "number" && c.quantity > 0) {
      out.push({ variant_id: c.variant_id, quantity: c.quantity });
    }
  }
  return out.length > 0 ? out : null;
}
