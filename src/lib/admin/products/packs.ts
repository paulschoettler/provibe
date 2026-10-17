/**
 * Lagereinheit Dose (H24, ADR-018): Packs einer Sorte und von Mixed bestehen über
 * bundle_components aus Einzeldosen. Legt jemand im Backoffice ein neues Pack an oder ändert die
 * Einheiten eines Packs, müssen die Komponenten mitziehen, sonst hätte das Pack wieder eigenen
 * Bestand. Reine Planung, die Datenbank schreibt write.ts (syncPackComponents).
 *
 * Regel: Vorlage ist das kleinste vorhandene Pack mit Komponenten. Jede andere Variante des
 * Produkts, die nicht selbst Lagereinheit ist, bekommt dieselben Dosen im Verhältnis ihrer
 * Einheiten (9er Wildberry: 9 Dosen; 12er Mixed: je 4 Dosen). Geht das nicht ganzzahlig auf,
 * bleibt die Variante unverändert und es gibt einen Hinweis.
 */

export interface PackVariant {
  id: string;
  unitCount: number;
  title?: string;
}

export interface PackComponent {
  componentVariantId: string;
  quantity: number;
}

export interface PackPlan {
  /** Komponenten, die so gesetzt werden müssen (vollständige Liste je Pack) */
  set: { variantId: string; items: PackComponent[] }[];
  /** Varianten, deren Einheiten nicht zum Verhältnis der Vorlage passen */
  skipped: { variantId: string; title?: string; unitCount: number }[];
}

function sameComponents(a: PackComponent[], b: PackComponent[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((c) => [c.componentVariantId, c.quantity]));
  return b.every((c) => byId.get(c.componentVariantId) === c.quantity);
}

export function planPackComponents(
  variants: PackVariant[],
  current: Map<string, PackComponent[]>,
): PackPlan {
  const plan: PackPlan = { set: [], skipped: [] };
  const units = new Set([...current.values()].flat().map((c) => c.componentVariantId));
  const template = variants
    .filter((v) => (current.get(v.id)?.length ?? 0) > 0 && v.unitCount > 0)
    .sort((a, b) => a.unitCount - b.unitCount || a.id.localeCompare(b.id))[0];
  if (!template) return plan;
  const base = current.get(template.id)!;

  for (const v of variants) {
    if (v.id === template.id || units.has(v.id) || v.unitCount <= 0) continue;
    const items: PackComponent[] = [];
    let fits = true;
    for (const c of base) {
      const q = (c.quantity * v.unitCount) / template.unitCount;
      if (!Number.isInteger(q) || q <= 0) {
        fits = false;
        break;
      }
      items.push({ componentVariantId: c.componentVariantId, quantity: q });
    }
    if (!fits) {
      plan.skipped.push({ variantId: v.id, title: v.title, unitCount: v.unitCount });
      continue;
    }
    if (!sameComponents(current.get(v.id) ?? [], items)) plan.set.push({ variantId: v.id, items });
  }
  return plan;
}
