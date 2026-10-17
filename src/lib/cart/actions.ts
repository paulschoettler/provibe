"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCartToken, loadCart, loadCartById } from "./server";
import {
  CART_COOKIE,
  EMPTY_CART,
  MAX_LINE_QUANTITY,
  type CartActionResult,
  type CartView,
} from "./types";

/**
 * Server Actions für den Warenkorb. Der Client schickt ausschließlich IDs und Mengen,
 * jeder Preis wird serverseitig aus der Datenbank gelesen (src/lib/pricing rechnet).
 * carts und cart_items haben keine anon-Policies, deshalb läuft alles über supabaseAdmin.
 */

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const variantIdSchema = z.string().uuid("Unbekannte Variante.");
const lineIdSchema = z.string().uuid("Unbekannte Position im Warenkorb.");
const quantitySchema = z
  .number()
  .int("Bitte gib eine ganze Zahl an.")
  .min(1, "Die Menge muss mindestens 1 sein.")
  .max(MAX_LINE_QUANTITY, `Pro Position sind höchstens ${MAX_LINE_QUANTITY} Stück möglich.`);
const updateQuantitySchema = quantitySchema.or(z.literal(0));

const addSchema = z.object({ variantId: variantIdSchema, quantity: quantitySchema });
const updateSchema = z.object({ lineId: lineIdSchema, quantity: updateQuantitySchema });
const removeSchema = z.object({ lineId: lineIdSchema });

async function fail(error: string): Promise<CartActionResult> {
  return { ok: false, error, cart: await loadCart(await getCartToken()) };
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

/**
 * Warenkorb lesen. Damit kann das Root-Layout statisch bleiben: Es rendert den Provider mit
 * EMPTY_CART, der Client holt den echten Stand beim Mounten nach. Das Cookie ist httpOnly und
 * geht automatisch mit, der Client bekommt weiterhin nur fertig gerechnete Beträge.
 */
export async function readCart(): Promise<CartView> {
  return loadCart(await getCartToken());
}

/** Legt eine Variante in den Warenkorb und gibt den neu berechneten Warenkorb zurück. */
export async function addToCart(variantId: string, quantity = 1): Promise<CartActionResult> {
  const parsed = addSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return fail(firstIssue(parsed.error, "Bitte prüf deine Eingabe."));

  const db = supabaseAdmin();

  // Variante und Produkt müssen aktiv sein, sonst darf nichts in den Warenkorb
  const { data: variant } = await db
    .from("product_variants")
    .select("id, title, is_active, products (id, status)")
    .eq("id", parsed.data.variantId)
    .maybeSingle();
  const product = variant?.products as { id: string; status: string } | null;
  if (!variant || !variant.is_active || !product || product.status !== "active") {
    return fail("Diese Variante ist gerade nicht bestellbar.");
  }

  const cart = await getOrCreateCart();
  if (!cart) return fail("Dein Warenkorb konnte nicht angelegt werden. Bitte versuch es erneut.");

  const { data: existing } = await db
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", parsed.data.variantId)
    .maybeSingle();

  const desired = (existing?.quantity ?? 0) + parsed.data.quantity;
  if (desired > MAX_LINE_QUANTITY) {
    return fail(`Pro Position sind höchstens ${MAX_LINE_QUANTITY} Stück möglich.`);
  }

  const stockError = await checkStock(parsed.data.variantId, desired);
  if (stockError) return fail(stockError);

  if (existing) {
    const { error } = await db
      .from("cart_items")
      .update({ quantity: desired })
      .eq("id", existing.id)
      .eq("cart_id", cart.id);
    if (error) return fail("Der Warenkorb konnte nicht aktualisiert werden.");
  } else {
    const { error } = await db
      .from("cart_items")
      .insert({ cart_id: cart.id, variant_id: parsed.data.variantId, quantity: desired });
    if (error) return fail("Der Warenkorb konnte nicht aktualisiert werden.");
  }

  return { ok: true, cart: await touchAndLoad(cart.id) };
}

/** Ändert die Menge einer Position. Menge 0 entfernt die Position. */
export async function updateCartLine(lineId: string, quantity: number): Promise<CartActionResult> {
  const parsed = updateSchema.safeParse({ lineId, quantity });
  if (!parsed.success) return fail(firstIssue(parsed.error, "Bitte prüf deine Eingabe."));
  if (parsed.data.quantity === 0) return removeCartLine(parsed.data.lineId);

  const db = supabaseAdmin();
  const cartId = await currentCartId();
  if (!cartId) return fail("Dein Warenkorb ist leer.");

  // Die Position muss zum Warenkorb aus dem Cookie gehören
  const { data: line } = await db
    .from("cart_items")
    .select("id, variant_id")
    .eq("id", parsed.data.lineId)
    .eq("cart_id", cartId)
    .maybeSingle();
  if (!line) return fail("Diese Position gibt es in deinem Warenkorb nicht mehr.");

  const stockError = await checkStock(line.variant_id, parsed.data.quantity);
  if (stockError) return fail(stockError);

  const { error } = await db
    .from("cart_items")
    .update({ quantity: parsed.data.quantity })
    .eq("id", parsed.data.lineId)
    .eq("cart_id", cartId);
  if (error) return fail("Die Menge konnte nicht geändert werden.");

  return { ok: true, cart: await touchAndLoad(cartId) };
}

export async function removeCartLine(lineId: string): Promise<CartActionResult> {
  const parsed = removeSchema.safeParse({ lineId });
  if (!parsed.success) return fail(firstIssue(parsed.error, "Bitte prüf deine Eingabe."));

  const cartId = await currentCartId();
  if (!cartId) return fail("Dein Warenkorb ist leer.");

  const { error } = await supabaseAdmin()
    .from("cart_items")
    .delete()
    .eq("id", parsed.data.lineId)
    .eq("cart_id", cartId);
  if (error) return fail("Die Position konnte nicht entfernt werden.");

  return { ok: true, cart: await touchAndLoad(cartId) };
}

/* Formular-Varianten für die Seite /cart: funktionieren ohne JavaScript. */

export async function addToCartForm(formData: FormData): Promise<void> {
  const result = await addToCart(
    String(formData.get("variantId") ?? ""),
    Number(formData.get("quantity") ?? 1),
  );
  finishForm(result, safePath(String(formData.get("redirectTo") ?? "/cart")));
}

export async function updateCartLineForm(formData: FormData): Promise<void> {
  const result = await updateCartLine(
    String(formData.get("lineId") ?? ""),
    Number(formData.get("quantity") ?? 0),
  );
  finishForm(result, "/cart");
}

export async function removeCartLineForm(formData: FormData): Promise<void> {
  const result = await removeCartLine(String(formData.get("lineId") ?? ""));
  finishForm(result, "/cart");
}

/** Nur interne Pfade zulassen, damit über das Formular keine fremde Adresse untergeschoben wird. */
function safePath(value: string): string {
  return /^\/(?!\/)[\w\-/]*$/.test(value) ? value : "/cart";
}

/** Ohne JavaScript gibt es keinen Rückgabewert: Fehler landen als Hinweis in der URL. */
function finishForm(result: CartActionResult, path: string): void {
  revalidatePath("/cart");
  if (!result.ok) redirect(`${path}?fehler=${encodeURIComponent(result.error)}` as Route);
  redirect(path as Route);
}

/* Interne Helfer */

async function currentCartId(): Promise<string | null> {
  const token = await getCartToken();
  if (!token) return null;
  const { data } = await supabaseAdmin()
    .from("carts")
    .select("id")
    .eq("token", token)
    .eq("status", "active")
    .maybeSingle();
  return data?.id ?? null;
}

/** Warenkorb aus dem Cookie holen oder neu anlegen und das Cookie setzen. */
async function getOrCreateCart(): Promise<{ id: string } | null> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value ?? null;
  const db = supabaseAdmin();

  if (token) {
    const { data } = await db
      .from("carts")
      .select("id")
      .eq("token", token)
      .eq("status", "active")
      .maybeSingle();
    if (data) return data;
  }

  // Token kommt aus dem Default der Datenbank (public.random_token(24)) und wird zurückgelesen
  const { data: created, error } = await db.from("carts").insert({}).select("id, token").single();
  if (error || !created) return null;

  store.set(CART_COOKIE, created.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return { id: created.id };
}

/**
 * Bestandsprüfung über public.available_quantity: löst Bundles auf Komponenten auf und
 * liefert 999999, wenn der Bestand nicht geführt wird oder Nachbestellung erlaubt ist.
 */
async function checkStock(variantId: string, desiredQuantity: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin().rpc("available_quantity", {
    p_variant_id: variantId,
  });
  if (error || typeof data !== "number") return null; // Bestandsdienst still ausfallen lassen
  if (data >= desiredQuantity) return null;
  const label = await variantLabel(variantId);
  if (data <= 0) return `„${label}“ ist gerade ausverkauft.`;
  return `Von „${label}“ sind nur noch ${data} verfügbar.`;
}

/** Sprechender Name einer Variante für Fehlermeldungen, z.B. "Wildberry Eistee, 9 Dosen". */
async function variantLabel(variantId: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from("product_variants")
    .select("title, products (handle, product_translations (locale, title))")
    .eq("id", variantId)
    .maybeSingle();
  if (!data) return "Dieser Artikel";
  const product = data.products as {
    handle: string;
    product_translations: { locale: string; title: string }[];
  } | null;
  const productTitle =
    product?.product_translations.find((t) => t.locale === "de")?.title ?? product?.handle ?? "";
  return productTitle ? `${productTitle}, ${data.title}` : data.title;
}

async function touchAndLoad(cartId: string): Promise<CartView> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin()
    .from("carts")
    .update({ last_activity_at: now, updated_at: now })
    .eq("id", cartId)
    .select("updated_at")
    .maybeSingle();
  const cart = await loadCartById(cartId, data?.updated_at ?? now);
  return cart.id ? cart : { ...EMPTY_CART, id: cartId };
}
