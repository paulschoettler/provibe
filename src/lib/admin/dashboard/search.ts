import "server-only";
import { escapeLike } from "@/lib/admin/audit-query";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Einfache Backoffice-Suche (Kopfzeile, /admin/suche?q=): Bestellnummer und Bestell-E-Mail,
 * Kunden nach E-Mail und Name, Produkte nach Titel, Handle und SKU. Je Gruppe höchstens 10 Treffer.
 * Kundendaten nur mit Recht viewCustomers (Fulfillment sieht Bestellungen, aber keine Kundenliste).
 */
export interface SearchResults {
  orders: {
    id: string;
    orderNumber: string;
    email: string;
    placedAt: string;
    totalCents: number;
    status: string;
    isTest: boolean;
  }[];
  customers: { id: string; email: string; name: string; ordersCount: number }[];
  products: { id: string; title: string; handle: string; status: string }[];
}

const LIMIT = 10;

export function normalizeQuery(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, 100);
}

export async function searchBackoffice(
  rawQuery: string,
  opts: { customers: boolean },
): Promise<SearchResults> {
  const q = normalizeQuery(rawQuery);
  if (q.length < 2) return { orders: [], customers: [], products: [] };
  const like = `%${escapeLike(q)}%`;
  const db = supabaseAdmin();
  // Bestellnummer auch ohne "PV-" und führende Nullen finden ("10001" → PV-010001)
  const digits = q.replace(/\D/g, "");

  const [
    byNumber,
    byEmail,
    customersByEmail,
    customersByName,
    productsByTitle,
    variantsBySku,
    productsByHandle,
  ] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, email, placed_at, total_cents, status, is_test")
      .ilike("order_number", digits.length >= 3 ? `%${digits}%` : like)
      .order("placed_at", { ascending: false })
      .limit(LIMIT),
    q.includes("@") || q.length >= 3
      ? db
          .from("orders")
          .select("id, order_number, email, placed_at, total_cents, status, is_test")
          .ilike("email", like)
          .order("placed_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [] as never[] }),
    opts.customers
      ? db
          .from("customers")
          .select("id, email, first_name, last_name, orders_count")
          .is("anonymized_at", null)
          .ilike("email", like)
          .limit(LIMIT)
      : Promise.resolve({ data: [] as never[] }),
    opts.customers
      ? db
          .from("customers")
          .select("id, email, first_name, last_name, orders_count")
          .is("anonymized_at", null)
          .or(`first_name.ilike.${pgrstValue(like)},last_name.ilike.${pgrstValue(like)}`)
          .limit(LIMIT)
      : Promise.resolve({ data: [] as never[] }),
    db
      .from("product_translations")
      .select("product_id, title, products!inner(handle, status)")
      .eq("locale", "de")
      .ilike("title", like)
      .limit(LIMIT),
    db.from("product_variants").select("product_id").ilike("sku", like).limit(LIMIT),
    db.from("products").select("id, handle, status").ilike("handle", like).limit(LIMIT),
  ]);

  const orders = new Map<string, SearchResults["orders"][number]>();
  for (const o of [...(byNumber.data ?? []), ...(byEmail.data ?? [])]) {
    orders.set(o.id, {
      id: o.id,
      orderNumber: o.order_number,
      email: String(o.email),
      placedAt: o.placed_at,
      totalCents: o.total_cents,
      status: o.status,
      isTest: o.is_test,
    });
  }

  const customers = new Map<string, SearchResults["customers"][number]>();
  for (const c of [...(customersByEmail.data ?? []), ...(customersByName.data ?? [])]) {
    customers.set(c.id, {
      id: c.id,
      email: String(c.email),
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      ordersCount: c.orders_count,
    });
  }

  const products = new Map<string, SearchResults["products"][number]>();
  type TitleRow = {
    product_id: string;
    title: string;
    products: { handle: string; status: string };
  };
  for (const p of (productsByTitle.data ?? []) as unknown as TitleRow[]) {
    products.set(p.product_id, {
      id: p.product_id,
      title: p.title,
      handle: p.products.handle,
      status: p.products.status,
    });
  }
  const extraIds = [
    ...(variantsBySku.data ?? []).map((v) => v.product_id),
    ...(productsByHandle.data ?? []).map((p) => p.id),
  ].filter((id) => !products.has(id));
  if (extraIds.length) {
    const { data } = await db
      .from("products")
      .select("id, handle, status, product_translations(title, locale)")
      .in("id", [...new Set(extraIds)].slice(0, LIMIT));
    for (const p of data ?? []) {
      const title = p.product_translations.find((t) => t.locale === "de")?.title ?? p.handle;
      products.set(p.id, { id: p.id, title, handle: p.handle, status: p.status });
    }
  }

  return {
    orders: [...orders.values()].slice(0, LIMIT),
    customers: [...customers.values()].slice(0, LIMIT),
    products: [...products.values()].slice(0, LIMIT),
  };
}

/** Wert für PostgREST-or()-Filter in Anführungszeichen setzen (Kommas und Klammern im Suchtext). */
function pgrstValue(value: string): string {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}
