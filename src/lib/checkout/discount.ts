import "server-only";
import type { DiscountRejection, DiscountRule } from "@/lib/pricing";
import { checkoutDb } from "./db";

/**
 * Rabattcodes im Checkout. Die Prüfung (Laufzeit, Limits, Mindestbestellwert) macht
 * evaluateDiscount aus src/lib/pricing/discounts.ts; hier wird nur geladen und übersetzt.
 * Der eingelöste Code hängt am Warenkorb (carts.discount_code_id), damit Warenkorb und Kasse
 * denselben Stand zeigen.
 */

export type LoadedDiscount = DiscountRule & { id: string };

export const DISCOUNT_MESSAGES: Record<DiscountRejection | "unknown", string> = {
  unknown: "Diesen Rabattcode kennen wir leider nicht.",
  inactive: "Dieser Rabattcode ist nicht mehr aktiv.",
  not_started: "Dieser Rabattcode gilt noch nicht.",
  expired: "Dieser Rabattcode ist abgelaufen.",
  usage_limit_reached: "Dieser Rabattcode wurde schon zu oft eingelöst.",
  customer_limit_reached: "Du hast diesen Rabattcode bereits eingelöst.",
  min_subtotal_not_reached: "Für diesen Rabattcode ist der Mindestbestellwert noch nicht erreicht.",
  not_applicable: "Dieser Rabattcode gilt nicht für die Artikel in deinem Warenkorb.",
};

const SELECT =
  "id, code, kind, value, applies_to, min_subtotal_cents, starts_at, ends_at, usage_limit, usage_limit_per_customer, usage_count, is_active";

type DiscountRow = {
  id: string;
  code: string;
  kind: DiscountRule["kind"];
  value: number;
  applies_to: unknown;
  min_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_limit_per_customer: number | null;
  usage_count: number;
  is_active: boolean;
};

export async function findDiscountByCode(code: string): Promise<DiscountRow | null> {
  const { data } = await checkoutDb()
    .from("discount_codes")
    .select(SELECT)
    .eq("code", code.trim())
    .maybeSingle();
  return (data as DiscountRow | null) ?? null;
}

export async function loadDiscountRule(
  discountId: string | null,
  email: string | null,
): Promise<LoadedDiscount | null> {
  if (!discountId) return null;
  const { data } = await checkoutDb()
    .from("discount_codes")
    .select(SELECT)
    .eq("id", discountId)
    .maybeSingle();
  if (!data) return null;
  return toRule(data as DiscountRow, email);
}

export async function toRule(row: DiscountRow, email: string | null): Promise<LoadedDiscount> {
  const db = checkoutDb();
  let customerUsageCount = 0;
  if (email && row.usage_limit_per_customer != null) {
    const { count } = await db
      .from("discount_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("discount_code_id", row.id)
      .eq("email", email.toLowerCase());
    customerUsageCount = count ?? 0;
  }
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    usageLimitPerCustomer: row.usage_limit_per_customer,
    customerUsageCount,
    isActive: row.is_active,
    productIds: await productScope(row.applies_to),
  };
}

/** applies_to: {"scope":"order"} | {"scope":"products","ids":[...]} | {"scope":"collections","ids":[...]} */
async function productScope(appliesTo: unknown): Promise<string[] | undefined> {
  const scope = appliesTo as { scope?: string; ids?: string[] } | null;
  if (!scope || scope.scope === "order" || !scope.ids?.length) return undefined;
  if (scope.scope === "products") return scope.ids;
  if (scope.scope === "collections") {
    const { data } = await checkoutDb()
      .from("collection_products")
      .select("product_id")
      .in("collection_id", scope.ids);
    return [...new Set((data ?? []).map((r) => r.product_id))];
  }
  return undefined;
}

export async function setCartDiscount(cartId: string, discountId: string | null): Promise<void> {
  const now = new Date().toISOString();
  await checkoutDb()
    .from("carts")
    .update({ discount_code_id: discountId, last_activity_at: now })
    .eq("id", cartId)
    .eq("status", "active");
}
