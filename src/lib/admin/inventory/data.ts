import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { can, db, dbErrorMessage, rpcUntyped } from "@/lib/admin/products/access";
import {
  escapeSearch,
  fail,
  INVALID_INPUT,
  NO_PERMISSION,
  NOT_FOUND,
  ok,
  zodFieldErrors,
  type AdminResult,
} from "@/lib/admin/products/result";
import { revalidateCatalog } from "@/lib/admin/products/revalidate";
import {
  adjustErrorMessage,
  adjustInputSchema,
  checkAdjustment,
  displayAvailable,
  overviewFilterSchema,
  REASON_LABELS,
  stockStatus,
  thresholdSchema,
  type AdjustReason,
  type InventoryReason,
  type OverviewFilter,
  type StockStatus,
} from "./rules";

/**
 * Bestand im Backoffice: Übersicht, Buchungen mit Grund (inventory_movements), Warnschwellen,
 * Bestandsführung je Variante, Historie.
 *
 * Rechte: Buchen dürfen Owner, Admin und Fulfillment (Wareneingang, Schwund, Retoure);
 * Warnschwelle und Bestandsführung ändern Owner und Admin (editProducts).
 */

export interface InventoryRow {
  variantId: string;
  productId: string;
  productHandle: string;
  productTitle: string;
  productStatus: "active" | "draft" | "archived";
  productKind: "simple" | "bundle";
  variantTitle: string;
  sku: string | null;
  unitCount: number;
  variantActive: boolean;
  onHand: number;
  reserved: number;
  /** null = unbegrenzt (nicht geführt oder Nachbestellung erlaubt) */
  available: number | null;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: StockStatus;
  updatedAt: string | null;
}

interface OverviewDbRow {
  variant_id: string;
  product_id: string;
  product_handle: string;
  product_title: string;
  product_status: InventoryRow["productStatus"];
  product_kind: InventoryRow["productKind"];
  variant_title: string;
  sku: string | null;
  unit_count: number;
  variant_active: boolean;
  on_hand: number;
  reserved: number;
  available: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  updated_at: string | null;
}

export interface InventoryOverview {
  rows: InventoryRow[];
  counts: { total: number; low: number; out: number; untracked: number };
}

export async function getInventoryOverview(
  filter: OverviewFilter = {},
): Promise<InventoryOverview> {
  const f = overviewFilterSchema.parse(filter);
  const { data, error } = await rpcUntyped<OverviewDbRow[]>("admin_inventory_overview", {});
  if (error) throw new Error(`Bestandsübersicht: ${error.message}`);
  const all: InventoryRow[] = (data ?? []).map((r) => ({
    variantId: r.variant_id,
    productId: r.product_id,
    productHandle: r.product_handle,
    productTitle: r.product_title,
    productStatus: r.product_status,
    productKind: r.product_kind,
    variantTitle: r.variant_title,
    sku: r.sku,
    unitCount: r.unit_count,
    variantActive: r.variant_active,
    onHand: r.on_hand,
    reserved: r.reserved,
    available: displayAvailable(r.available),
    lowStockThreshold: r.low_stock_threshold,
    trackInventory: r.track_inventory,
    allowBackorder: r.allow_backorder,
    status: stockStatus({
      kind: r.product_kind,
      trackInventory: r.track_inventory,
      allowBackorder: r.allow_backorder,
      available: r.available,
      lowStockThreshold: r.low_stock_threshold,
    }),
    updatedAt: r.updated_at,
  }));

  const q = f.q ? escapeSearch(f.q).toLowerCase() : "";
  const visible = all.filter(
    (r) =>
      (f.includeArchived || r.productStatus !== "archived") &&
      (f.includeInactive || r.variantActive) &&
      (f.includeBundles || r.productKind !== "bundle") &&
      (!q ||
        r.productTitle.toLowerCase().includes(q) ||
        r.productHandle.includes(q) ||
        r.variantTitle.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q)),
  );
  const counts = {
    total: visible.length,
    low: visible.filter((r) => r.status === "low").length,
    out: visible.filter((r) => r.status === "out").length,
    untracked: visible.filter((r) => r.status === "untracked").length,
  };
  const rows = visible.filter((r) => {
    switch (f.status) {
      case "low":
        return r.status === "low";
      case "out":
        return r.status === "out";
      case "untracked":
        return r.status === "untracked";
      case "tracked":
        return r.productKind === "simple" && r.trackInventory;
      default:
        return true;
    }
  });
  return { rows, counts };
}

async function loadVariant(variantId: string) {
  const { data } = await db()
    .from("product_variants")
    .select("id, title, product_id, products (handle, kind)")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return null;
  const p = data.products as unknown as { handle: string; kind: "simple" | "bundle" };
  return {
    id: data.id,
    title: data.title,
    productId: data.product_id,
    handle: p.handle,
    kind: p.kind,
  };
}

/**
 * Bestand buchen (Korrektur, Wareneingang, Schwund, Retoure). Die Regeln prüft checkAdjustment,
 * die Datenbank bucht atomar und prüft erneut (Zeilensperre gegen gleichzeitige Verkäufe).
 */
export async function adjustInventory(
  variantId: string,
  delta: number,
  reason: AdjustReason,
  note: string | null,
  actor: StaffSession,
): Promise<AdminResult<{ onHand: number; reserved: number; movementId: number }>> {
  if (!can(actor, "fulfil")) return fail(NO_PERMISSION);
  const parsed = adjustInputSchema.safeParse({ variantId, delta, reason, note });
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const input = parsed.data;

  const variant = await loadVariant(input.variantId);
  if (!variant) return fail(NOT_FOUND);
  const { data: level } = await db()
    .from("inventory_levels")
    .select("on_hand, track_inventory")
    .eq("variant_id", input.variantId)
    .maybeSingle();

  const check = checkAdjustment(input, {
    role: actor.role,
    onHand: level?.on_hand ?? 0,
    isBundle: variant.kind === "bundle",
    trackInventory: level?.track_inventory ?? false,
  });
  if (!check.ok) return fail(check.error, check.field ? { [check.field]: check.error } : {});

  const { data, error } = await rpcUntyped<
    { new_on_hand: number; current_reserved: number; movement_id: number }[]
  >("admin_adjust_inventory", {
    p_variant_id: input.variantId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note,
    p_actor: actor.userId,
    p_allow_negative: check.allowNegative,
  });
  if (error || !data?.[0]) return fail(adjustErrorMessage(error?.message ?? ""));
  const row = data[0];

  await writeAudit(actor, {
    action: "inventory.adjust",
    entityType: "product_variant",
    entityId: input.variantId,
    before: { on_hand: level?.on_hand ?? 0 },
    after: {
      on_hand: row.new_on_hand,
      delta: input.delta,
      reason: input.reason,
      note: input.note,
      movement_id: row.movement_id,
    },
  });
  // Verfügbarkeit auf Produktseiten und in Kollektionen (ausverkauft/verfügbar)
  revalidateCatalog({ productHandles: [variant.handle], allCollections: true });
  return ok(
    { onHand: row.new_on_hand, reserved: row.current_reserved, movementId: row.movement_id },
    check.warnings,
  );
}

export async function setThreshold(
  variantId: string,
  threshold: number,
  actor: StaffSession,
): Promise<AdminResult<{ lowStockThreshold: number }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = thresholdSchema.safeParse(threshold);
  if (!parsed.success) return fail(INVALID_INPUT, { threshold: parsed.error.issues[0].message });
  const variant = await loadVariant(variantId);
  if (!variant) return fail(NOT_FOUND);
  const client = db();
  const { data: before } = await client
    .from("inventory_levels")
    .select("low_stock_threshold")
    .eq("variant_id", variantId)
    .maybeSingle();
  const { error } = await client.from("inventory_levels").upsert(
    {
      variant_id: variantId,
      low_stock_threshold: parsed.data,
      ...(before ? {} : { track_inventory: false }),
    },
    { onConflict: "variant_id" },
  );
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: "inventory.threshold",
    entityType: "product_variant",
    entityId: variantId,
    before: { low_stock_threshold: before?.low_stock_threshold ?? null },
    after: { low_stock_threshold: parsed.data },
  });
  return ok({ lowStockThreshold: parsed.data });
}

/**
 * Bestandsführung je Variante ein- oder ausschalten, Nachbestellung (Verkauf bei 0) erlauben.
 * Bundles: nicht möglich, ihre Verfügbarkeit kommt aus den Komponenten.
 */
export async function setTracking(
  variantId: string,
  trackInventory: boolean,
  allowBackorder: boolean,
  actor: StaffSession,
): Promise<AdminResult<{ trackInventory: boolean; allowBackorder: boolean }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const variant = await loadVariant(variantId);
  if (!variant) return fail(NOT_FOUND);
  if (variant.kind === "bundle")
    return fail(
      "Bundles haben keinen eigenen Bestand. Stelle die Bestandsführung bei den Komponenten ein.",
    );
  const client = db();
  const { data: before } = await client
    .from("inventory_levels")
    .select("track_inventory, allow_backorder, on_hand")
    .eq("variant_id", variantId)
    .maybeSingle();
  const { error } = await client
    .from("inventory_levels")
    .upsert(
      { variant_id: variantId, track_inventory: trackInventory, allow_backorder: allowBackorder },
      { onConflict: "variant_id" },
    );
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: "inventory.tracking",
    entityType: "product_variant",
    entityId: variantId,
    before: before
      ? { track_inventory: before.track_inventory, allow_backorder: before.allow_backorder }
      : null,
    after: { track_inventory: trackInventory, allow_backorder: allowBackorder },
  });
  revalidateCatalog({ productHandles: [variant.handle], allCollections: true });
  const warnings =
    trackInventory && !allowBackorder && (before?.on_hand ?? 0) <= 0
      ? [
          "Der Bestand ist 0. Die Variante ist jetzt im Shop ausverkauft, bis du einen Wareneingang buchst.",
        ]
      : [];
  return ok({ trackInventory, allowBackorder }, warnings);
}

export interface MovementView {
  id: number;
  delta: number;
  reason: InventoryReason;
  reasonLabel: string;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  /** Bestellnummer, wenn die Bewegung zu einer Bestellung gehört */
  orderNumber: string | null;
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}

export async function getMovements(
  variantId: string,
  options: { limit?: number; beforeId?: number } = {},
): Promise<MovementView[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const client = db();
  let query = client
    .from("inventory_movements")
    .select("*")
    .eq("variant_id", variantId)
    .order("id", { ascending: false })
    .limit(limit);
  if (options.beforeId) query = query.lt("id", options.beforeId);
  const { data, error } = await query;
  if (error) throw new Error(`Bewegungen: ${error.message}`);
  const rows = data ?? [];

  const actorIds = [...new Set(rows.flatMap((r) => (r.created_by ? [r.created_by] : [])))];
  const orderIds = [
    ...new Set(
      rows.flatMap((r) => (r.reference_type === "order" && r.reference_id ? [r.reference_id] : [])),
    ),
  ];
  const [staff, orders] = await Promise.all([
    actorIds.length
      ? client.from("staff_users").select("user_id, email, display_name").in("user_id", actorIds)
      : Promise.resolve({
          data: [] as { user_id: string; email: string; display_name: string | null }[],
        }),
    orderIds.length
      ? client.from("orders").select("id, order_number").in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; order_number: string | null }[] }),
  ]);
  const staffMap = new Map((staff.data ?? []).map((s) => [s.user_id, s]));
  const orderMap = new Map((orders.data ?? []).map((o) => [o.id, o.order_number]));

  return rows.map((r) => {
    const s = r.created_by ? staffMap.get(r.created_by) : undefined;
    return {
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      reasonLabel: REASON_LABELS[r.reason],
      note: r.note,
      referenceType: r.reference_type,
      referenceId: r.reference_id,
      orderNumber:
        r.reference_type === "order" && r.reference_id
          ? (orderMap.get(r.reference_id) ?? null)
          : null,
      actorEmail: s?.email ?? null,
      actorName: s?.display_name ?? null,
      createdAt: r.created_at,
    };
  });
}
