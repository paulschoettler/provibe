/**
 * Bestandsrückbuchung (Erstattung mit Rückbuchung, Storno). Reine Funktionen.
 *
 * Die Auflösung spiegelt reserve_stock/commit_reservations: gebucht wird immer auf Lagereinheiten
 * (H24, ADR-018: die einzelne Dose je Sorte, Merch mit eigenem Bestand). Ein Bundle löst über
 * seinen Snapshot order_items.components auf, ein Pack (und eine Bundle-Komponente, die selbst ein
 * Pack ist) über seine aktuellen bundle_components. Bestellungen von vor der Umstellung haben den
 * Abgang noch auf dem Pack gebucht; für Varianten mit eigenem Abgang in dieser Bestellung bleibt
 * es deshalb bei der Variante. Zurückgebucht wird höchstens, was für diese Bestellung als Abgang
 * (reason sale) gebucht und noch nicht zurückgebucht wurde, damit Storno und Erstattung nie
 * doppelt einbuchen.
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

export interface ExpandOptions {
  /** Lagereinheiten je Pack (bundle_components der Packs), Menge je 1 Pack */
  packUnits?: Map<string, StockComponent[]>;
  /** Varianten, auf die in dieser Bestellung direkt ein Abgang gebucht wurde (vor H24) */
  bookedDirectly?: Set<string>;
}

/** Lagereinheiten-Mengen für die angegebenen Positionsmengen. */
export function expandStock(items: StockItem[], options: ExpandOptions = {}): Map<string, number> {
  const out = new Map<string, number>();
  const add = (variantId: string, qty: number) => {
    if (qty <= 0) return;
    out.set(variantId, (out.get(variantId) ?? 0) + qty);
  };
  // Ein Pack eine Ebene tiefer auflösen, außer sein Abgang steht noch auf ihm selbst
  const addResolved = (variantId: string, qty: number) => {
    const units = options.packUnits?.get(variantId);
    if (units && units.length > 0 && !options.bookedDirectly?.has(variantId)) {
      for (const u of units) add(u.variant_id, qty * u.quantity);
    } else {
      add(variantId, qty);
    }
  };
  for (const item of items) {
    if (item.quantity <= 0) continue;
    if (item.components && item.components.length > 0) {
      for (const c of item.components) addResolved(c.variant_id, item.quantity * c.quantity);
    } else if (item.variantId) {
      addResolved(item.variantId, item.quantity);
    }
  }
  return out;
}

/** Varianten mit eigenem Abgang (sale) in den Bewegungen einer Bestellung. */
export function directlyBookedVariants(movements: StockMovementRow[]): Set<string> {
  return new Set(
    movements.filter((m) => m.reason === "sale" && m.delta < 0).map((m) => m.variant_id),
  );
}

/** bundle_components-Zeilen zu einer Map Pack → Lagereinheiten. */
export function packUnitsFrom(
  rows: { bundle_variant_id: string; component_variant_id: string; quantity: number }[],
): Map<string, StockComponent[]> {
  const map = new Map<string, StockComponent[]>();
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    map.set(r.bundle_variant_id, [
      ...(map.get(r.bundle_variant_id) ?? []),
      { variant_id: r.component_variant_id, quantity: r.quantity },
    ]);
  }
  return map;
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
