import { allocateProportionally, applyBasisPoints, type Cents } from "@/lib/money";
import type { DiscountRejection, DiscountRule, PricedLine } from "./types";

export interface DiscountEvaluation {
  ok: boolean;
  reason: DiscountRejection | null;
  /** Rabatt gesamt in Cent (0 bei free_shipping) */
  discountCents: Cents;
  /** Rabatt je Position, gleiche Reihenfolge wie lines */
  perLineCents: Cents[];
  freeShipping: boolean;
}

export function validateDiscount(
  rule: DiscountRule,
  subtotalCents: Cents,
  now: Date = new Date(),
): DiscountRejection | null {
  if (!rule.isActive) return "inactive";
  if (rule.startsAt && now < rule.startsAt) return "not_started";
  if (rule.endsAt && now >= rule.endsAt) return "expired";
  if (rule.usageLimit != null && rule.usageCount >= rule.usageLimit) return "usage_limit_reached";
  if (
    rule.usageLimitPerCustomer != null &&
    (rule.customerUsageCount ?? 0) >= rule.usageLimitPerCustomer
  ) {
    return "customer_limit_reached";
  }
  if (subtotalCents < rule.minSubtotalCents) return "min_subtotal_not_reached";
  return null;
}

/**
 * Rabatt auf die Warenwerte (ohne Pfand, ohne Versand) anwenden.
 * Pfand ist nie rabattfähig. Der Rabatt kann den Warenwert nicht unterschreiten.
 */
export function evaluateDiscount(
  rule: DiscountRule | null,
  lines: PricedLine[],
  now: Date = new Date(),
): DiscountEvaluation {
  const none: DiscountEvaluation = {
    ok: false,
    reason: null,
    discountCents: 0,
    perLineCents: lines.map(() => 0),
    freeShipping: false,
  };
  if (!rule) return none;

  const lineGross = lines.map((l) => l.quantity * l.unitPriceCents);
  const subtotal = lineGross.reduce((a, b) => a + b, 0);
  const rejection = validateDiscount(rule, subtotal, now);
  if (rejection) return { ...none, reason: rejection };

  // undefined = ganze Bestellung; eine (auch leere) Liste begrenzt den Rabatt auf genau diese Produkte
  const eligible = lines.map((l) =>
    rule.productIds === undefined ? true : rule.productIds.includes(l.productId),
  );
  const eligibleGross = lineGross.map((g, i) => (eligible[i] ? g : 0));
  const eligibleSubtotal = eligibleGross.reduce((a, b) => a + b, 0);
  if (eligibleSubtotal === 0 && rule.kind !== "free_shipping") {
    return { ...none, reason: "not_applicable" };
  }

  if (rule.kind === "free_shipping") {
    return { ...none, ok: true, freeShipping: true };
  }

  let discount =
    rule.kind === "percentage"
      ? applyBasisPoints(eligibleSubtotal, rule.value)
      : Math.min(rule.value, eligibleSubtotal);
  discount = Math.max(0, Math.min(discount, eligibleSubtotal));

  return {
    ok: true,
    reason: null,
    discountCents: discount,
    perLineCents: allocateProportionally(discount, eligibleGross),
    freeShipping: false,
  };
}
