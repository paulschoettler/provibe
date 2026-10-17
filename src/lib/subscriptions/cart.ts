import "server-only";
import { aboDb } from "./db";
import { isAllowedInterval, isSubscribable, resolveDiscountBp } from "./rules";
import { loadSubscriptionSettings } from "./settings";
import type { SubscriptionSettings } from "./types";

/**
 * Abo-Kennzeichen der Warenkorbpositionen (cart_items.is_subscription und
 * subscription_interval_weeks, Migration 20261017107100). Die Abfrage läuft getrennt und still:
 * Fehlen die Spalten noch (Migration remote nicht angewendet), gilt jede Position als Einmalkauf
 * und Warenkorb und Checkout funktionieren unverändert weiter.
 */
export async function loadSubscriptionFlags(cartId: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const { data, error } = await aboDb()
      .from("cart_items")
      .select("id, is_subscription, subscription_interval_weeks")
      .eq("cart_id", cartId)
      .eq("is_subscription", true);
    if (error) return result;
    for (const row of (data ?? []) as {
      id: string;
      is_subscription: boolean;
      subscription_interval_weeks: number | null;
    }[]) {
      if (row.is_subscription && row.subscription_interval_weeks) {
        result.set(row.id, row.subscription_interval_weeks);
      }
    }
  } catch {
    // Spalten fehlen: kein Abo
  }
  return result;
}

export interface SubscriptionLineInput {
  cartItemId: string;
  productId: string;
  variantId: string;
  productKind: string;
  unitCount: number;
  depositCentsPerUnit: number;
}

/**
 * Abo-Angaben je Position: Intervall aus dem Warenkorb, Rabatt aus den aktuellen Einstellungen.
 * Positionen, die (nicht mehr) abonnierbar sind, werden als Einmalkauf behandelt.
 */
export async function resolveSubscriptionLines<T extends SubscriptionLineInput>(
  cartId: string,
  lines: T[],
  settingsInput?: SubscriptionSettings,
): Promise<Map<string, { intervalWeeks: number; discountBp: number }>> {
  const out = new Map<string, { intervalWeeks: number; discountBp: number }>();
  const flags = await loadSubscriptionFlags(cartId);
  if (flags.size === 0) return out;
  const settings = settingsInput ?? (await loadSubscriptionSettings());
  for (const line of lines) {
    const weeks = flags.get(line.cartItemId);
    if (!weeks) continue;
    if (
      !isSubscribable({
        productKind: line.productKind,
        unitCount: line.unitCount,
        depositCentsPerUnit: line.depositCentsPerUnit,
      })
    ) {
      continue;
    }
    // Ein inzwischen nicht mehr angebotenes Intervall fällt auf den Standard zurück
    const intervalWeeks = isAllowedInterval(settings, weeks) ? weeks : settings.defaultInterval;
    out.set(line.cartItemId, {
      intervalWeeks,
      discountBp: resolveDiscountBp(settings, line.productId, line.variantId),
    });
  }
  return out;
}

/**
 * Abo-Position in den Warenkorb legen oder erhöhen (cart_items mit is_subscription = true).
 * Prüft Abonnierbarkeit und Intervall serverseitig; der Client schickt nur IDs, Menge und Intervall.
 * Gibt eine Fehlermeldung zurück oder null bei Erfolg.
 */
export async function upsertSubscriptionItem(input: {
  cartId: string;
  variantId: string;
  quantity: number;
  intervalWeeks: number;
  maxQuantity: number;
}): Promise<string | null> {
  const db = aboDb();
  const { data: variant } = await db
    .from("product_variants")
    .select("id, unit_count, is_active, products (id, kind, status, deposit_cents_per_unit)")
    .eq("id", input.variantId)
    .maybeSingle();
  const v = variant as {
    id: string;
    unit_count: number;
    is_active: boolean;
    products: { id: string; kind: string; status: string; deposit_cents_per_unit: number } | null;
  } | null;
  if (
    !v ||
    !v.products ||
    !isSubscribable({
      productKind: v.products.kind,
      productStatus: v.products.status,
      variantActive: v.is_active,
      unitCount: v.unit_count,
      depositCentsPerUnit: v.products.deposit_cents_per_unit,
    })
  ) {
    return "Diese Packgröße gibt es nicht im Abo.";
  }
  const settings = await loadSubscriptionSettings();
  if (!isAllowedInterval(settings, input.intervalWeeks)) {
    return "Bitte wähl ein Lieferintervall.";
  }

  const { data: existing, error: readError } = await db
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", input.cartId)
    .eq("variant_id", input.variantId)
    .eq("is_subscription", true)
    .maybeSingle();
  if (readError) {
    console.error("[abo] Abo-Position nicht lesbar (Migration 20261017107100?)", readError.message);
    return "Das Abo ist gerade nicht verfügbar. Bitte versuch es später noch einmal.";
  }
  const row = existing as { id: string; quantity: number } | null;
  const desired = (row?.quantity ?? 0) + input.quantity;
  if (desired > input.maxQuantity) {
    return `Pro Abo-Position sind höchstens ${input.maxQuantity} Stück möglich.`;
  }

  const { error } = row
    ? await db
        .from("cart_items")
        .update({ quantity: desired, subscription_interval_weeks: input.intervalWeeks })
        .eq("id", row.id)
        .eq("cart_id", input.cartId)
    : await db.from("cart_items").insert({
        cart_id: input.cartId,
        variant_id: input.variantId,
        quantity: desired,
        is_subscription: true,
        subscription_interval_weeks: input.intervalWeeks,
      });
  if (error) {
    console.error("[abo] Abo-Position nicht gespeichert", error.message);
    return "Das Abo konnte nicht in den Warenkorb gelegt werden.";
  }
  return null;
}

/**
 * Einmalkauf-Position derselben Variante finden. Mit Abo-Spalten gibt es bis zu zwei Zeilen je
 * Variante; ohne Migration genau eine. Liefert die Zeile, die kein Abo ist.
 */
export async function findOneTimeItem(
  cartId: string,
  variantId: string,
): Promise<{ id: string; quantity: number } | null> {
  const { data } = await aboDb()
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId);
  const rows = (data ?? []) as { id: string; quantity: number; is_subscription?: boolean }[];
  const row = rows.find((r) => !r.is_subscription);
  return row ? { id: row.id, quantity: row.quantity } : null;
}
