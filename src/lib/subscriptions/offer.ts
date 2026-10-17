import "server-only";
import { loadShippingRates, loadTaxRates } from "@/lib/cart/server";
import { depositPerItemCents } from "@/lib/cart/mapping";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";
import { subscriptionDeliveryPrice } from "@/lib/pricing/subscription";
import { supabaseAnon } from "@/lib/supabase/server";
import { isSubscribable, resolveDiscountBp } from "./rules";
import { berlinDay } from "./schedule";
import { loadPublicSubscriptionSettings } from "./settings";

/**
 * Abo-Angebot für die Kaufbox der Produktseite (Sorten und Mixed): je Packgröße der Preis je
 * Lieferung mit Abo-Rabatt, Pfand getrennt, Grundpreis ohne Pfand, Ersparnis und Versand.
 * Wird beim statischen Rendern berechnet, damit alles im Server-HTML steht.
 */

export interface SubscriptionVariantOffer {
  discountBp: number;
  /** Warenwert je Lieferung nach Rabatt, ohne Pfand (Hauptpreis, H22) */
  goodsCents: number;
  /** Warenwert beim Einmalkauf, ohne Pfand */
  listGoodsCents: number;
  savingsCents: number;
  depositCents: number;
  perCanCents: number;
  basePriceText: string;
  /** Versand für eine Lieferung dieser Packgröße (0 ab der Schwelle) */
  shippingCents: number;
  /** Zahlbetrag je Lieferung inklusive Pfand und Versand */
  totalCents: number;
}

export interface SubscriptionOffer {
  intervals: number[];
  defaultInterval: number;
  /** höchster Rabatt aller Packgrößen, für das Badge "10 % sparen" */
  maxDiscountBp: number;
  variants: Record<string, SubscriptionVariantOffer>;
  shippingPriceCents: number | null;
  freeShippingFromCents: number | null;
  /** Tag der Berechnung (Europe/Berlin), Grundlage für "nächste Lieferung am …" */
  today: string;
  pauseMaxDays: number;
}

export async function getSubscriptionOffer(productId: string): Promise<SubscriptionOffer | null> {
  try {
    const db = supabaseAnon();
    const { data: product } = await db
      .from("products")
      .select(
        "id, kind, status, tax_class, deposit_cents_per_unit, net_content_per_unit, base_price_measure",
      )
      .eq("id", productId)
      .maybeSingle();
    if (!product) return null;
    const { data: variants } = await db
      .from("product_variants")
      .select("id, price_cents, unit_count, weight_grams, packaging_weight_grams, is_active")
      .eq("product_id", productId)
      .eq("is_active", true);
    const eligible = (variants ?? []).filter((v) =>
      isSubscribable({
        productKind: product.kind,
        productStatus: product.status,
        variantActive: v.is_active,
        unitCount: v.unit_count,
        depositCentsPerUnit: product.deposit_cents_per_unit,
      }),
    );
    if (eligible.length === 0) return null;

    const [settings, shippingRates, taxRates] = await Promise.all([
      loadPublicSubscriptionSettings(),
      loadShippingRates(),
      loadTaxRates(),
    ]);
    const taxRateBp = taxRates.get(product.tax_class) ?? 1900;
    const depositTaxRateBp = taxRates.get("standard") ?? 1900;
    const netContent =
      product.net_content_per_unit === null ? null : Number(product.net_content_per_unit);

    const out: Record<string, SubscriptionVariantOffer> = {};
    for (const v of eligible) {
      const discountBp = resolveDiscountBp(settings, product.id, v.id);
      const unitDepositCents = depositPerItemCents({
        priceCents: v.price_cents,
        depositCentsPerUnit: product.deposit_cents_per_unit,
        unitCount: v.unit_count,
      });
      const price = subscriptionDeliveryPrice({
        line: {
          variantId: v.id,
          productId: product.id,
          quantity: 1,
          unitPriceCents: v.price_cents - unitDepositCents,
          unitDepositCents,
          taxRateBp,
          weightGrams: (v.weight_grams ?? 0) + v.packaging_weight_grams,
        },
        discountBp,
        shippingRates,
        depositTaxRateBp,
      });
      const base = calculateBasePrice({
        priceCents: price.goodsCents + unitDepositCents,
        depositCentsPerUnit: unitDepositCents === 0 ? 0 : product.deposit_cents_per_unit,
        unitCount: v.unit_count,
        netContentPerUnit: netContent,
        measure: product.base_price_measure as UnitMeasure,
      });
      out[v.id] = {
        discountBp,
        goodsCents: price.goodsCents,
        listGoodsCents: price.listGoodsCents,
        savingsCents: price.savingsCents,
        depositCents: price.depositCents,
        perCanCents: Math.round(price.goodsCents / v.unit_count),
        basePriceText: formatBasePrice(base),
        shippingCents: price.shippingCents,
        totalCents: price.totalCents,
      };
    }
    const standard =
      shippingRates.find((r) => r.freeAboveSubtotalCents != null) ?? shippingRates[0];
    return {
      intervals: settings.intervals,
      defaultInterval: settings.defaultInterval,
      maxDiscountBp: Math.max(...Object.values(out).map((o) => o.discountBp)),
      variants: out,
      shippingPriceCents: standard?.priceCents ?? null,
      freeShippingFromCents: standard?.freeAboveSubtotalCents ?? null,
      today: berlinDay(new Date()),
      pauseMaxDays: settings.pauseMaxDays,
    };
  } catch (error) {
    console.error("[abo] Abo-Angebot nicht berechnet", error);
    return null;
  }
}
