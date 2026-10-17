import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffSession } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewStatus } from "./rules";

/**
 * Lesen der Bewertungen für das Backoffice (Service-Role). Untypisierter Client, weil die Spalten
 * aus Migration 20261017208000 (rejection_reason, reply_at, reply_by) erst nach der nächsten
 * Typgenerierung in database.types.ts stehen; fehlen sie in der Datenbank noch, bleiben sie leer.
 */

export function reviewsDb(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

/** Wer Bewertungen sehen und moderieren darf: alle außer Fulfillment (Kundendaten). */
export function canModerateReviews(s: StaffSession): boolean {
  return s.role !== "fulfillment";
}

/** Löschen auf Kundenwunsch: Owner und Admin. */
export function canDeleteReviews(s: StaffSession): boolean {
  return s.role === "owner" || s.role === "admin";
}

export interface ReviewListItem {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  moderatedAt: string | null;
  /** Von der Kundin nach einer Moderation geändert, braucht eine neue Freigabe */
  changedAfterModeration: boolean;
  rejectionReason: string | null;
  replyBody: string | null;
  replyAt: string | null;
  product: { id: string; handle: string; title: string } | null;
  customer: { id: string; email: string; name: string | null } | null;
  order: { id: string; number: string } | null;
}

const PAGE_SIZE = 50;

type Row = Record<string, unknown> & {
  id: string;
  status: ReviewStatus;
  rating: number;
  author_name: string;
  created_at: string;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function toItem(r: Row): ReviewListItem {
  const product = one(
    r.products as {
      id: string;
      handle: string;
      product_translations?: { title: string; locale: string }[];
    } | null,
  );
  const customer = one(
    r.customers as {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    } | null,
  );
  const order = one(r.orders as { id: string; order_number: string } | null);
  return {
    id: r.id,
    status: r.status,
    rating: Number(r.rating),
    title: str(r.title),
    body: str(r.body),
    authorName: r.author_name,
    isVerifiedPurchase: r.is_verified_purchase !== false,
    createdAt: r.created_at,
    moderatedAt: str(r.moderated_at),
    changedAfterModeration: r.status === "pending" && Boolean(str(r.moderated_at)),
    rejectionReason: str(r.rejection_reason),
    replyBody: str(r.reply_body),
    replyAt: str(r.reply_at),
    product: product
      ? {
          id: product.id,
          handle: product.handle,
          title:
            product.product_translations?.find((t) => t.locale === "de")?.title ?? product.handle,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null,
        }
      : null,
    order: order ? { id: order.id, number: order.order_number } : null,
  };
}

const SELECT =
  "*, products(id, handle, product_translations(title, locale)), customers(id, email, first_name, last_name), orders(id, order_number)";

/**
 * Liste je Status. Bewusst ohne Sternefilter (UWG), sortiert nach Eingang (älteste offene zuerst,
 * damit nichts liegen bleibt; erledigte neueste zuerst).
 */
export async function listReviews(input: {
  status: ReviewStatus;
  q?: string;
  productId?: string;
  page?: number;
}): Promise<{ rows: ReviewListItem[]; total: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  let query = reviewsDb()
    .from("reviews")
    .select(SELECT, { count: "exact" })
    .eq("status", input.status)
    .order("created_at", { ascending: input.status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (input.productId) query = query.eq("product_id", input.productId);
  const q = input.q?.trim().replace(/[%,()]/g, "");
  if (q) query = query.or(`author_name.ilike.%${q}%,title.ilike.%${q}%,body.ilike.%${q}%`);
  const { data, error, count } = await query;
  if (error) {
    console.error("[reviews] Liste", error.message);
    throw new Error("Bewertungen laden fehlgeschlagen");
  }
  return { rows: ((data ?? []) as Row[]).map(toItem), total: count ?? 0, pageSize: PAGE_SIZE };
}

export async function getReview(id: string): Promise<ReviewListItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await reviewsDb()
    .from("reviews")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[reviews] Bewertung", error.message);
    return null;
  }
  return data ? toItem(data as Row) : null;
}

export async function reviewCounts(): Promise<Record<ReviewStatus, number>> {
  const db = reviewsDb();
  const [p, a, r] = await Promise.all(
    (["pending", "approved", "rejected"] as const).map((status) =>
      db.from("reviews").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  return { pending: p.count ?? 0, approved: a.count ?? 0, rejected: r.count ?? 0 };
}

/** Zähler für die Shell (Navigationspunkt Bewertungen). Fehler ergeben 0. */
export async function countPendingReviews(): Promise<number> {
  const { count, error } = await reviewsDb()
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.error("[reviews] offene Bewertungen", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Produkte mit Bewertungen für den Produktfilter (Name, Anzahl). */
export async function reviewedProducts(): Promise<{ id: string; title: string }[]> {
  const { data } = await reviewsDb()
    .from("reviews")
    .select("product_id, products(handle, product_translations(title, locale))")
    .limit(2000);
  const map = new Map<string, string>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const p = one(
      r.products as {
        handle: string;
        product_translations?: { title: string; locale: string }[];
      } | null,
    );
    if (typeof r.product_id === "string" && !map.has(r.product_id))
      map.set(
        r.product_id,
        p?.product_translations?.find((t) => t.locale === "de")?.title ?? p?.handle ?? "Produkt",
      );
  }
  return [...map.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));
}
