/**
 * Shopify-Rabattcodes (CSV aus Rabatte → Exportieren, oder JSON aus der Admin-API) auf
 * discount_codes abbilden. Reine Funktionen, getestet in __tests__/discounts.test.ts.
 */
import type { RawRow } from "../lib/csv";
import {
  errorMessage,
  parseIntOrNull,
  parseMoneyCents,
  parseShopifyDate,
  parseShopifyId,
  parseYesNo,
  pick,
} from "../lib/values";
import type { MapResult } from "./customers";

export const DISCOUNT_COLUMNS = {
  id: ["Id", "ID", "Discount ID", "Price Rule ID"],
  code: ["Code", "Discount Code", "Name", "Title"],
  type: ["Type", "Value Type", "Discount Type", "value_type"],
  value: ["Value", "Discount Value", "value"],
  minimum: [
    "Minimum",
    "Minimum Subtotal",
    "Minimum Purchase Requirements",
    "Minimum Requirement",
    "Minimum Amount",
  ],
  usageLimit: ["Usage limit", "Usage Limit", "Total Usage Limit", "usage_limit"],
  oncePerCustomer: [
    "Once per customer",
    "Limit one per customer",
    "Once Per Customer",
    "once_per_customer",
  ],
  usageLimitPerCustomer: ["Usage limit per customer"],
  timesUsed: ["Times Used", "Used", "Usage Count", "usage_count"],
  startsAt: ["Starts at", "Starts At", "Start", "Start Date", "starts_at"],
  endsAt: ["Ends at", "Ends At", "End", "End Date", "ends_at"],
  status: ["Status", "status"],
  appliesTo: ["Applies to", "Applies To", "Eligibility", "target_selection"],
  combinesWith: ["Combines with", "Combines With"],
} as const;

export type DiscountKind = "percentage" | "fixed_amount" | "free_shipping";

export interface MappedDiscount {
  code: string;
  shopifyDiscountId: string | null;
  kind: DiscountKind;
  /** percentage: Basispunkte (1000 = 10 %), fixed_amount: Cent, free_shipping: 0 */
  value: number;
  minSubtotalCents: number;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  timesUsed: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  combinable: boolean;
  warnings: string[];
}

/** Typ erkennen: "percentage", "Percentage", "%"; "fixed_amount", "Fixed amount"; "free_shipping". */
export function mapDiscountKind(type: string, value: string): DiscountKind | null {
  const t = type.toLowerCase().replace(/[\s-]+/g, "_");
  if (t.includes("percent") || t === "%" || (!t && value.includes("%"))) return "percentage";
  if (t.includes("free_shipping") || t.includes("shipping") || t.includes("versand"))
    return "free_shipping";
  if (t.includes("fixed") || t.includes("amount") || t === "betrag") return "fixed_amount";
  return null;
}

export function mapDiscountRow(row: RawRow, now: Date): MapResult<MappedDiscount> {
  const warnings: string[] = [];
  try {
    const code = pick(row, DISCOUNT_COLUMNS.code).replace(/\s+/g, "");
    if (!code) return { ok: false, reason: "Code fehlt" };
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(code))
      return { ok: false, reason: `Code "${code}" enthält unzulässige Zeichen` };

    const rawType = pick(row, DISCOUNT_COLUMNS.type);
    const rawValue = pick(row, DISCOUNT_COLUMNS.value);
    const kind = mapDiscountKind(rawType, rawValue);
    if (!kind) {
      return {
        ok: false,
        reason: `Rabatttyp "${rawType || "leer"}" wird nicht unterstützt (z.B. Buy X get Y), bitte im Backoffice anlegen`,
        skip: true,
      };
    }

    let value = 0;
    if (kind !== "free_shipping") {
      const cents = parseMoneyCents(rawValue.replace("%", ""));
      if (cents === null) return { ok: false, reason: "Wert fehlt" };
      // Shopify exportiert Rabatte oft negativ ("-10.0")
      value = Math.abs(cents);
      if (kind === "percentage" && (value <= 0 || value > 10_000)) {
        return { ok: false, reason: `Prozentwert ${rawValue} außerhalb 0 bis 100` };
      }
    }

    // Mindestbestellwert: Betrag in Euro. "Minimum quantity of 2 items" lässt sich nicht abbilden.
    const rawMin = pick(row, DISCOUNT_COLUMNS.minimum);
    let minSubtotalCents = 0;
    if (rawMin && !/^(none|keine?|0([.,]0+)?)$/i.test(rawMin)) {
      if (/quantit|item|artikel|stück/i.test(rawMin)) {
        return {
          ok: false,
          reason: `Mindestmenge "${rawMin}" wird nicht unterstützt, bitte im Backoffice prüfen`,
        };
      }
      const num = /-?\d[\d.,]*/.exec(rawMin);
      if (!num) return { ok: false, reason: `Mindestbestellwert "${rawMin}" nicht lesbar` };
      minSubtotalCents = Math.abs(parseMoneyCents(num[0]) ?? 0);
    }

    const oncePerCustomer = pick(row, DISCOUNT_COLUMNS.oncePerCustomer);
    const perCustomer =
      parseIntOrNull(pick(row, DISCOUNT_COLUMNS.usageLimitPerCustomer)) ??
      (oncePerCustomer && parseYesNo(oncePerCustomer) ? 1 : null);

    const startsAt = parseShopifyDate(pick(row, DISCOUNT_COLUMNS.startsAt));
    const endsAt = parseShopifyDate(pick(row, DISCOUNT_COLUMNS.endsAt));
    if (startsAt && endsAt && endsAt < startsAt)
      return { ok: false, reason: "Ende liegt vor dem Start" };

    const status = pick(row, DISCOUNT_COLUMNS.status).toLowerCase();
    let isActive: boolean;
    if (!status || ["active", "aktiv", "enabled"].includes(status)) isActive = true;
    else if (["scheduled", "geplant"].includes(status))
      isActive = true; // starts_at regelt den Beginn
    else if (["expired", "abgelaufen", "disabled", "inactive", "deaktiviert"].includes(status))
      isActive = false;
    else {
      isActive = false;
      warnings.push(`Status "${status}" unbekannt, als inaktiv übernommen`);
    }
    if (isActive && endsAt && new Date(endsAt) < now) {
      isActive = false;
      warnings.push("Enddatum liegt in der Vergangenheit, als inaktiv übernommen");
    }

    // Einschränkung auf Produkte oder Kollektionen bilden wir nicht automatisch ab: lieber inaktiv
    const appliesTo = pick(row, DISCOUNT_COLUMNS.appliesTo).toLowerCase();
    if (appliesTo && !/^(all|entire|order|alle|gesamte|bestellung)/.test(appliesTo)) {
      isActive = false;
      warnings.push(
        `gilt in Shopify nur für "${appliesTo}", inaktiv übernommen, Einschränkung bitte im Backoffice setzen`,
      );
    }

    const combinesWith = pick(row, DISCOUNT_COLUMNS.combinesWith).toLowerCase();
    return {
      ok: true,
      value: {
        code: code.toUpperCase(),
        shopifyDiscountId: parseShopifyId(pick(row, DISCOUNT_COLUMNS.id)),
        kind,
        value,
        minSubtotalCents,
        usageLimit: parseIntOrNull(pick(row, DISCOUNT_COLUMNS.usageLimit)),
        usageLimitPerCustomer: perCustomer,
        timesUsed: parseIntOrNull(pick(row, DISCOUNT_COLUMNS.timesUsed)) ?? 0,
        startsAt,
        endsAt,
        isActive,
        combinable: combinesWith !== "" && !/^(none|keine|no|nein|false)$/.test(combinesWith),
        warnings,
      },
    };
  } catch (error) {
    return { ok: false, reason: errorMessage(error) };
  }
}
