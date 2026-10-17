import { z } from "zod";

/**
 * Reine Regeln für die Bestandsführung im Backoffice (Paket Admin-Katalog).
 * Die Datenbank prüft dieselben Regeln noch einmal atomar (admin_adjust_inventory).
 *
 * Lagereinheit (H14/H24, ADR-018): Bestand wird nur auf Lagereinheiten geführt, das ist die
 * einzelne Dose je Sorte (inaktive Variante, SKU PV-WB-01, PV-RL-01, PV-PE-01) und Merch.
 * Packs (9 bis 48 Dosen, auch Mixed) und Bundles haben keinen eigenen Bestand; ihre
 * Verfügbarkeit ergibt sich aus den Lagereinheiten (available_quantity: Minimum über
 * floor(verfügbar / Menge)). Warnschwellen gelten in Dosen beziehungsweise Stück.
 */

/** unit = Lagereinheit (Dose, Merch), pack = Pack aus Dosen, bundle = Bundle (admin_inventory_overview) */
export type StockRole = "unit" | "pack" | "bundle";

export interface StockUnitComponent {
  variantId: string;
  sku: string | null;
  productTitle: string;
  variantTitle: string;
  quantity: number;
}

/** Kurzname einer Sorte aus dem Produkttitel, z.B. "Wildberry Eistee" → "Wildberry". */
export function flavorName(productTitle: string): string {
  return productTitle.replace(/\s+Eistee$/i, "").trim() || productTitle;
}

/**
 * Zusammensetzung eines Packs oder Bundles aus Lagereinheiten als Text, z.B.
 * "9 Dosen Wildberry" oder "je 4 Dosen Wildberry, Raspberry Lime und Peach".
 * Dosen erkennt die Funktion am Variantentitel ("1 Dose …"), alles andere ist Stück.
 */
export function componentsText(components: StockUnitComponent[]): string {
  if (components.length === 0) return "";
  const isCan = (c: StockUnitComponent) => /\bdose\b/i.test(c.variantTitle);
  const cans = components.filter(isCan);
  const others = components.filter((c) => !isCan(c));
  const parts: string[] = [];
  const names = (list: string[]) =>
    list.length <= 1
      ? (list[0] ?? "")
      : `${list.slice(0, -1).join(", ")} und ${list[list.length - 1]}`;
  if (cans.length > 1 && cans.every((c) => c.quantity === cans[0].quantity)) {
    const q = cans[0].quantity;
    parts.push(
      `je ${q} ${q === 1 ? "Dose" : "Dosen"} ${names(cans.map((c) => flavorName(c.productTitle)))}`,
    );
  } else {
    for (const c of cans)
      parts.push(
        `${c.quantity} ${c.quantity === 1 ? "Dose" : "Dosen"} ${flavorName(c.productTitle)}`,
      );
  }
  for (const o of others) {
    const size = /^(standard|default)/i.test(o.variantTitle) ? "" : ` ${o.variantTitle}`;
    parts.push(`${o.quantity} × ${o.productTitle}${size}`);
  }
  return parts.join(" + ");
}

export type StaffRoleName = "owner" | "admin" | "support" | "fulfillment";

export type InventoryReason =
  | "initial"
  | "purchase"
  | "sale"
  | "refund_restock"
  | "correction"
  | "damaged"
  | "import"
  | "reservation_commit";

/** Gründe, die im Backoffice gebucht werden können. */
export const ADJUST_REASONS = [
  { value: "correction", label: "Korrektur", sign: "any" },
  { value: "purchase", label: "Wareneingang", sign: "positive" },
  { value: "damaged", label: "Schwund", sign: "negative" },
  { value: "refund_restock", label: "Retoure", sign: "positive" },
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number]["value"];

export const REASON_LABELS: Record<InventoryReason, string> = {
  initial: "Anfangsbestand",
  purchase: "Wareneingang",
  sale: "Verkauf",
  refund_restock: "Retoure",
  correction: "Korrektur",
  damaged: "Schwund",
  import: "Import",
  reservation_commit: "Reservierung gebucht",
};

/** available_quantity liefert 999999 für "nicht geführt"; Bundles daraus geteilt durch die Menge. */
export const UNLIMITED_FROM = 100_000;

export const adjustInputSchema = z
  .object({
    variantId: z.guid(),
    delta: z
      .number({ error: "Bitte gib eine Menge ein." })
      .int("Nur ganze Einheiten.")
      .min(-100_000)
      .max(100_000)
      .refine((n) => n !== 0, "Die Änderung darf nicht 0 sein."),
    reason: z.enum(["correction", "purchase", "damaged", "refund_restock"], {
      error: "Bitte wähle einen Grund.",
    }),
    note: z
      .string()
      .trim()
      .max(500, "Bitte höchstens 500 Zeichen.")
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "correction" && !v.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Bitte beschreibe kurz, warum du korrigierst.",
      });
    }
  });
export type AdjustInput = z.input<typeof adjustInputSchema>;

export const thresholdSchema = z
  .number({ error: "Bitte gib eine Zahl ein." })
  .int("Nur ganze Einheiten.")
  .min(0, "Die Warnschwelle darf nicht negativ sein.")
  .max(100_000);

export interface AdjustContext {
  role: StaffRoleName;
  onHand: number;
  isBundle: boolean;
  /** Pack aus Dosen (H24): Bestand kommt aus der Einzeldose */
  isPack?: boolean;
  trackInventory: boolean;
}

export type AdjustCheck =
  | { ok: true; allowNegative: boolean; newOnHand: number; warnings: string[] }
  | { ok: false; error: string; field?: string };

export function canAdjustNegative(role: StaffRoleName): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Regeln einer Bestandsbuchung:
 * - Bundles und Packs haben keinen eigenen Bestand (gebucht wird die Lagereinheit).
 * - Wareneingang und Retoure nur positiv, Schwund nur negativ, Korrektur in beide Richtungen.
 * - Negativer Bestand nur mit Grund Korrektur und nur für Owner oder Admin.
 * - Ohne Bestandsführung ist die Buchung erlaubt, wirkt aber erst nach dem Einschalten.
 */
export function checkAdjustment(
  input: { delta: number; reason: AdjustReason },
  ctx: AdjustContext,
): AdjustCheck {
  if (ctx.isBundle) {
    return {
      ok: false,
      error:
        "Bundles haben keinen eigenen Bestand. Buche die Komponenten (zum Beispiel die Dosen).",
    };
  }
  if (ctx.isPack) {
    return {
      ok: false,
      error:
        "Packs haben keinen eigenen Bestand. Buche die Dosen der Sorte (Lagereinheit), das Pack rechnet sich daraus.",
    };
  }
  const def = ADJUST_REASONS.find((r) => r.value === input.reason)!;
  if (def.sign === "positive" && input.delta < 0) {
    return {
      ok: false,
      field: "delta",
      error: `${def.label} erhöht den Bestand, bitte eine positive Menge.`,
    };
  }
  if (def.sign === "negative" && input.delta > 0) {
    return {
      ok: false,
      field: "delta",
      error: `${def.label} verringert den Bestand, bitte eine negative Menge.`,
    };
  }
  const newOnHand = ctx.onHand + input.delta;
  const warnings: string[] = [];
  let allowNegative = false;
  if (newOnHand < 0) {
    if (input.reason !== "correction" || !canAdjustNegative(ctx.role)) {
      return {
        ok: false,
        field: "delta",
        error: `Der Bestand würde auf ${newOnHand} fallen. Unter 0 buchen dürfen nur Owner und Admin mit dem Grund Korrektur.`,
      };
    }
    allowNegative = true;
    warnings.push(`Der Bestand ist jetzt negativ (${newOnHand}). Bitte prüfe die Zählung.`);
  }
  if (!ctx.trackInventory) {
    warnings.push(
      "Die Bestandsführung ist für diese Variante aus. Die Buchung zählt erst, wenn du sie einschaltest.",
    );
  }
  return { ok: true, allowNegative, newOnHand, warnings };
}

export type StockStatus = "bundle" | "pack" | "untracked" | "backorder" | "out" | "low" | "ok";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  bundle: "Aus Komponenten",
  pack: "Aus Dosen",
  untracked: "Nicht geführt",
  backorder: "Nachbestellbar",
  out: "Ausverkauft",
  low: "Niedrig",
  ok: "Auf Lager",
};

export function stockStatus(row: {
  kind: "simple" | "bundle";
  /** pack: abgeleitet aus Dosen; die Warnschwelle gilt an der Dose, nicht am Pack */
  role?: StockRole;
  trackInventory: boolean;
  allowBackorder: boolean;
  available: number;
  lowStockThreshold: number;
}): StockStatus {
  if (row.role === "pack" && row.kind !== "bundle") {
    return row.available <= 0 ? "out" : "pack";
  }
  if (row.kind === "bundle") {
    if (row.available >= UNLIMITED_FROM) return "bundle";
    if (row.available <= 0) return "out";
    return row.available <= row.lowStockThreshold ? "low" : "bundle";
  }
  if (!row.trackInventory) return "untracked";
  if (row.allowBackorder) return "backorder";
  if (row.available <= 0) return "out";
  if (row.available <= row.lowStockThreshold) return "low";
  return "ok";
}

/** Verfügbar für die Anzeige: null steht für unbegrenzt (nicht geführt oder Nachbestellung). */
export function displayAvailable(available: number): number | null {
  return available >= UNLIMITED_FROM ? null : available;
}

/** Fehlercodes aus admin_adjust_inventory in Texte übersetzen. */
export function adjustErrorMessage(dbMessage: string): string {
  if (dbMessage.includes("NEGATIVE_STOCK"))
    return "Der Bestand würde negativ. Unter 0 buchen dürfen nur Owner und Admin mit dem Grund Korrektur.";
  if (dbMessage.includes("NEGATIVE_ONLY_CORRECTION"))
    return "Negativer Bestand ist nur mit dem Grund Korrektur möglich.";
  if (dbMessage.includes("DELTA_SIGN")) return "Menge und Grund passen nicht zusammen.";
  if (dbMessage.includes("INVALID_REASON"))
    return "Dieser Grund kann im Backoffice nicht gebucht werden.";
  if (dbMessage.includes("BUNDLE_STOCK_DERIVED")) return "Bundles haben keinen eigenen Bestand.";
  if (dbMessage.includes("PACK_STOCK_DERIVED"))
    return "Packs haben keinen eigenen Bestand. Buche die Dosen der Sorte.";
  if (dbMessage.includes("VARIANT_NOT_FOUND")) return "Die Variante gibt es nicht mehr.";
  if (dbMessage.includes("INVALID_DELTA")) return "Die Änderung darf nicht 0 sein.";
  return "Die Buchung ist fehlgeschlagen. Bitte versuche es noch einmal.";
}

export const overviewFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "low", "out", "untracked", "tracked"]).default("all"),
  /** Standard an: die Einzeldosen (Lagereinheit, H24) sind inaktive Varianten und tragen den Bestand */
  includeInactive: z.boolean().default(true),
  includeArchived: z.boolean().default(false),
  /** abgeleitete Zeilen (Packs und Bundles) mit berechneter Verfügbarkeit */
  includeDerived: z.boolean().default(true),
});
export type OverviewFilter = z.input<typeof overviewFilterSchema>;
