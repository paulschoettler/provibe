import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProductByHandle } from "@/lib/catalog/products";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkReviewToken,
  reviewableItems,
  shortAuthorName,
  type OrderItemRow,
  type TokenOrder,
  type TokenRun,
} from "./logic";
import { revalidateReviews } from "./revalidate";
import type { ReviewInput } from "./schema";
import { hashReviewToken, isPlausibleReviewToken } from "./token";
import type { OwnReview, ReviewFormItem, ReviewTokenResult } from "./types";

/**
 * Datenzugriff des Bewertungsformulars, ausschließlich serverseitig mit Service-Role: anon darf
 * weder automation_runs noch orders lesen und reviews nicht schreiben. Jede Funktion prüft den
 * Token selbst neu, kein Wert aus dem Formular wird ungeprüft übernommen.
 */

/**
 * automation_runs.token_hash entsteht mit Migration 20261017204100 und fehlt noch in den
 * generierten Typen, deshalb für diese eine Abfrage ein untypisierter Client.
 */
function untypedDb(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

interface OrderRow extends TokenOrder {
  order_number: string;
  placed_at: string;
  customer_id: string | null;
  is_test: boolean;
  billing_address: unknown;
  shipping_address: unknown;
  order_items: OrderItemRow[];
}

const DEFAULT_TINT = "var(--pv-cream)";

function nameFromAddress(address: unknown): { first: string | null; last: string | null } {
  if (!address || typeof address !== "object") return { first: null, last: null };
  const a = address as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return { first: str(a.first_name), last: str(a.last_name) };
}

/** Name des Bestellers: Rechnungsadresse, sonst Lieferadresse. */
export function orderAuthorName(order: { billing_address: unknown; shipping_address: unknown }) {
  const billing = nameFromAddress(order.billing_address);
  const n = billing.first || billing.last ? billing : nameFromAddress(order.shipping_address);
  return shortAuthorName(n.first, n.last);
}

async function enrichItem(
  item: ReturnType<typeof reviewableItems>[number],
  existing: OwnReview | null,
): Promise<ReviewFormItem> {
  const product = item.handle ? await getProductByHandle(item.handle).catch(() => null) : null;
  // Platzhalter-Varianten ("Standard", Shopify "Default Title") sagen nichts aus
  const variants = item.variantTitles
    .filter((t) => !/^(standard|default title)$/i.test(t.trim()))
    .join(", ");
  const meta = [product?.line1, variants].filter(Boolean).join(" · ") || null;
  const localImage =
    item.imagePath && item.imagePath.startsWith("/")
      ? { src: item.imagePath, alt: "", width: 400, height: 400 }
      : null;
  const image = product?.image
    ? { ...product.image, alt: "" }
    : product?.gallery?.[0]
      ? { ...product.gallery[0], alt: "" }
      : localImage;
  return {
    productId: item.productId,
    orderItemId: item.orderItemId,
    handle: item.handle,
    title: product?.shortTitle ?? item.title,
    meta,
    image,
    tint: product?.palette.from ?? DEFAULT_TINT,
    existing,
  };
}

/**
 * Token prüfen und die Bestellpositionen samt eigener Bewertungen laden.
 * Ergebnis "invalid" deckt bewusst unbekannte und fremde Tokens gleich ab (keine Auskunft darüber,
 * ob es eine Bestellung gibt).
 */
export async function resolveReviewToken(token: unknown): Promise<ReviewTokenResult> {
  if (!isPlausibleReviewToken(token)) return { status: "invalid" };
  const tokenHash = hashReviewToken(token);
  try {
    const { data: run, error: runError } = await untypedDb()
      .from("automation_runs")
      .select("automation_key, target_type, target_id, status, email, sent_at, created_at")
      .eq("token_hash", tokenHash)
      .eq("automation_key", "review_request")
      .maybeSingle<TokenRun>();
    if (runError) throw runError;
    if (!run) return { status: "invalid" };

    const { data: order, error: orderError } = await supabaseAdmin()
      .from("orders")
      .select(
        "id, order_number, email, status, delivered_at, placed_at, customer_id, is_test, billing_address, shipping_address, order_items(id, product_id, product_handle, product_title, variant_title, image_path, quantity, position)",
      )
      .eq("id", run.target_id)
      .maybeSingle<OrderRow>();
    if (orderError) throw orderError;

    const check = checkReviewToken({ run, order: order ?? null, now: new Date() });
    if (!check.ok) {
      return {
        status:
          check.reason === "unknown" || check.reason === "mismatch" ? "invalid" : check.reason,
      };
    }
    if (!order) return { status: "invalid" };

    const items = reviewableItems(order.order_items ?? []);
    const { data: own, error: ownError } = await supabaseAdmin()
      .from("reviews")
      .select("id, product_id, rating, title, body, status")
      .eq("order_id", order.id);
    if (ownError) throw ownError;
    const ownByProduct = new Map((own ?? []).map((r) => [r.product_id, r]));

    return {
      status: "ok",
      orderId: order.id,
      orderNumber: order.order_number,
      placedAt: order.placed_at,
      customerId: order.customer_id,
      authorName: orderAuthorName(order),
      tokenHash,
      expiresAt: check.expiresAt.toISOString(),
      items: await Promise.all(
        items.map((item) => {
          const r = ownByProduct.get(item.productId);
          return enrichItem(
            item,
            r
              ? { id: r.id, rating: r.rating, title: r.title, body: r.body, status: r.status }
              : null,
          );
        }),
      ),
    };
  } catch (error) {
    console.error("[reviews] Bewertungslink konnte nicht geprüft werden", error);
    return { status: "error" };
  }
}

export type SaveReviewResult =
  | { ok: true; reviewId: string; created: boolean; remaining: number }
  | { ok: false; reason: "invalid_token" | "unknown_product" | "failed"; tokenStatus?: string };

/**
 * Bewertung anlegen oder ändern. Neu: status pending, verified_purchase true, Name gekürzt aus der
 * Bestellung. Änderung: Sterne, Titel und Text überschreiben, Status zurück auf pending (auch nach
 * Freigabe oder Ablehnung), damit jede geänderte Fassung vor der Veröffentlichung geprüft wird.
 * Pro Bestellung und Produkt höchstens eine Bewertung (Code und eindeutiger Index der Migration).
 */
export async function saveReview(input: ReviewInput): Promise<SaveReviewResult> {
  const ctx = await resolveReviewToken(input.token);
  if (ctx.status !== "ok") return { ok: false, reason: "invalid_token", tokenStatus: ctx.status };
  const item = ctx.items.find((i) => i.productId === input.productId);
  if (!item) return { ok: false, reason: "unknown_product" };

  const db = supabaseAdmin();
  const fields = {
    rating: input.rating,
    title: input.title,
    body: input.body,
    author_name: ctx.authorName,
    status: "pending" as const,
    is_verified_purchase: true,
    token_hash: ctx.tokenHash,
    moderated_at: null,
    moderated_by: null,
  };

  try {
    let reviewId: string;
    let created = false;
    const wasApproved = item.existing?.status === "approved";
    if (item.existing) {
      const { error } = await db
        .from("reviews")
        .update(fields)
        .eq("id", item.existing.id)
        .eq("order_id", ctx.orderId);
      if (error) throw error;
      reviewId = item.existing.id;
    } else {
      const { data, error } = await db
        .from("reviews")
        .insert({
          ...fields,
          product_id: item.productId,
          order_id: ctx.orderId,
          order_item_id: item.orderItemId,
          customer_id: ctx.customerId,
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        // Gleichzeitig abgeschickt: vorhandene Bewertung derselben Bestellung ändern
        const { data: dup, error: dupError } = await db
          .from("reviews")
          .update(fields)
          .eq("order_id", ctx.orderId)
          .eq("product_id", item.productId)
          .select("id")
          .single();
        if (dupError) throw dupError;
        reviewId = dup.id;
      } else {
        if (error) throw error;
        reviewId = data.id;
        created = true;
      }
    }
    // Eine freigegebene Bewertung verschwindet bis zur erneuten Prüfung von der Produktseite
    if (wasApproved) revalidateReviews(item.handle);
    const remaining = ctx.items.filter((i) => i.productId !== item.productId && !i.existing).length;
    return { ok: true, reviewId, created, remaining };
  } catch (error) {
    console.error("[reviews] Bewertung konnte nicht gespeichert werden", error);
    return { ok: false, reason: "failed" };
  }
}
