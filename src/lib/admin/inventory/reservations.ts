import "server-only";
import { db } from "@/lib/admin/products/access";

/**
 * Reservierungen einsehen (Checkout und manuelle Bestellung reservieren Bestand mit Ablaufzeit,
 * reserve_stock). Aktiv heißt: hält Bestand fest, bis die Bestellung gebucht oder die Reservierung
 * freigegeben wird. Abgelaufene, noch aktive Reservierungen räumt der Job
 * checkout.release_reservation beziehungsweise pg_cron auf; hier werden sie markiert.
 */

export interface ReservationView {
  id: string;
  variantId: string;
  variantTitle: string;
  productTitle: string;
  sku: string | null;
  /** Bundle, über das die Komponente reserviert wurde */
  bundleTitle: string | null;
  quantity: number;
  expiresAt: string;
  createdAt: string;
  checkoutSessionId: string;
  expired: boolean;
}

export async function listActiveReservations(
  options: { variantId?: string; limit?: number; now?: Date } = {},
): Promise<ReservationView[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  let query = db()
    .from("inventory_reservations")
    .select(
      "id, checkout_session_id, variant_id, bundle_variant_id, quantity, expires_at, created_at, variant:product_variants!inventory_reservations_variant_id_fkey (title, sku, products (handle, product_translations (title, locale))), bundle:product_variants!inventory_reservations_bundle_variant_id_fkey (title, products (handle, product_translations (title, locale)))",
    )
    .eq("status", "active")
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (options.variantId) query = query.eq("variant_id", options.variantId);
  const { data, error } = await query;
  if (error) throw new Error(`Reservierungen: ${error.message}`);

  type Product = {
    handle: string;
    product_translations: { title: string; locale: string }[] | null;
  } | null;
  type Row = {
    id: string;
    checkout_session_id: string;
    variant_id: string;
    quantity: number;
    expires_at: string;
    created_at: string;
    variant: { title: string; sku: string | null; products: Product } | null;
    bundle: { title: string; products: Product } | null;
  };
  const title = (p: Product) =>
    p?.product_translations?.find((t) => t.locale === "de")?.title ?? p?.handle ?? "Produkt";
  const now = (options.now ?? new Date()).getTime();
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    variantId: r.variant_id,
    variantTitle: r.variant?.title ?? "",
    productTitle: title(r.variant?.products ?? null),
    sku: r.variant?.sku ?? null,
    bundleTitle: r.bundle ? `${title(r.bundle.products)} · ${r.bundle.title}` : null,
    quantity: r.quantity,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    checkoutSessionId: r.checkout_session_id,
    expired: new Date(r.expires_at).getTime() <= now,
  }));
}
