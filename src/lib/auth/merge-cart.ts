import "server-only";
import { cookies } from "next/headers";
import { getCartToken } from "@/lib/cart/server";
import { CART_COOKIE } from "@/lib/cart/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { kontoRpc } from "./db";

/**
 * Warenkorb beim Login übernehmen (docs/konto-und-abo-plan.md, Teil A).
 *
 * - Gast-Warenkorb im Cookie pv_cart wird dem Kunden zugeordnet (carts.customer_id).
 * - Hat der Kunde schon aktive Warenkörbe (anderes Gerät, frühere Sitzung), wandern deren
 *   Positionen in den Cookie-Warenkorb, die alten werden als merged markiert.
 * - Ohne Cookie-Warenkorb bekommt der Browser den jüngsten Kundenwarenkorb zurück.
 * - Ein Cookie-Warenkorb, der einem anderen Kunden gehört (geteiltes Gerät), wird nicht übernommen.
 *
 * Darf nur in Route Handlern und Server Actions laufen (setzt gegebenenfalls ein Cookie).
 * Fehler werden geloggt und verschluckt: Der Login darf nie am Warenkorb scheitern.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export interface MergeCartResult {
  cartId: string | null;
  mergedCarts: number;
}

export async function mergeGuestCart(
  customerId: string,
  email?: string | null,
): Promise<MergeCartResult> {
  try {
    const db = supabaseAdmin();
    const token = await getCartToken();

    let guest: { id: string; customer_id: string | null } | null = null;
    if (token) {
      const { data } = await db
        .from("carts")
        .select("id, customer_id")
        .eq("token", token)
        .eq("status", "active")
        .maybeSingle();
      guest = data && (data.customer_id === null || data.customer_id === customerId) ? data : null;
    }

    const { data: own } = await db
      .from("carts")
      .select("id, token, last_activity_at")
      .eq("customer_id", customerId)
      .eq("status", "active")
      .order("last_activity_at", { ascending: false });
    const others = (own ?? []).filter((c) => c.id !== guest?.id);

    let target = guest?.id ?? null;
    if (!target && others.length > 0) {
      // Kein Gast-Warenkorb: jüngsten Kundenwarenkorb in diesen Browser holen
      const newest = others.shift()!;
      target = newest.id;
      const store = await cookies();
      store.set(CART_COOKIE, newest.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
      });
    }
    if (!target) return { cartId: null, mergedCarts: 0 };

    let merged = 0;
    for (const old of others) {
      const { error } = await kontoRpc<number>("merge_cart_into", {
        p_source: old.id,
        p_target: target,
      });
      if (error) console.error("[auth] Warenkorb nicht zusammengeführt", error.message);
      else merged += 1;
    }

    const update: { customer_id: string; email?: string } = { customer_id: customerId };
    if (email) update.email = email;
    await db.from("carts").update(update).eq("id", target);
    return { cartId: target, mergedCarts: merged };
  } catch (error) {
    console.error("[auth] mergeGuestCart fehlgeschlagen", error);
    return { cartId: null, mergedCarts: 0 };
  }
}

/**
 * Beim Logout: Gehört der Cookie-Warenkorb einem Kunden, löst ihn vom Browser, damit die
 * nächste Person am selben Gerät ihn nicht sieht. Der Warenkorb bleibt am Konto.
 */
export async function detachCustomerCart(): Promise<void> {
  try {
    const token = await getCartToken();
    if (!token) return;
    const { data } = await supabaseAdmin()
      .from("carts")
      .select("customer_id")
      .eq("token", token)
      .maybeSingle();
    if (data?.customer_id) {
      const store = await cookies();
      store.delete(CART_COOKIE);
    }
  } catch (error) {
    console.error("[auth] Warenkorb-Cookie nicht gelöst", error);
  }
}
