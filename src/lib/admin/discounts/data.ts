import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { can, db, dbErrorMessage } from "@/lib/admin/products/access";
import {
  changedFields,
  escapeSearch,
  fail,
  INVALID_INPUT,
  NO_PERMISSION,
  NOT_FOUND,
  ok,
  zodFieldErrors,
  type AdminResult,
} from "@/lib/admin/products/result";
import { DISCOUNT_MESSAGES } from "@/lib/checkout/discount";
import type { DiscountEvaluation, PricedLine } from "@/lib/pricing";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  describeDiscount,
  discountInputSchema,
  discountListFilterSchema,
  discountStatus,
  maskEmail,
  normalizeCode,
  parseAppliesTo,
  previewDiscount,
  toPricingRule,
  type AppliesTo,
  type DiscountInput,
  type DiscountListFilter,
  type DiscountStatus,
} from "./rules";

/**
 * Rabattcodes im Backoffice: Liste, Detail, Anlegen und Ändern, Aktivieren und Deaktivieren,
 * Löschen (nur ungenutzt), Nutzung, Prüfung mit denselben Regeln wie die Kasse.
 * Rechte: Ändern Owner und Admin (editProducts), Lesen alle Staff-Rollen; E-Mail-Adressen in
 * der Nutzung nur mit viewCustomers.
 */

type DiscountRow = Database["public"]["Tables"]["discount_codes"]["Row"];

export interface DiscountListItem {
  id: string;
  code: string;
  title: string | null;
  kind: DiscountRow["kind"];
  summary: string;
  status: DiscountStatus;
  usageCount: number;
  usageLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

export async function listDiscounts(filter: DiscountListFilter = {}): Promise<DiscountListItem[]> {
  const f = discountListFilterSchema.parse(filter);
  let query = db().from("discount_codes").select("*").order("created_at", { ascending: false });
  const q = f.q ? escapeSearch(f.q) : "";
  if (q) query = query.or(`code.ilike.*${q}*,title.ilike.*${q}*`);
  const { data, error } = await query;
  if (error) throw new Error(`Rabatte: ${error.message}`);
  const now = new Date();
  return (data ?? [])
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      kind: r.kind,
      summary: describeDiscount(r),
      status: discountStatus(r, now),
      usageCount: r.usage_count,
      usageLimit: r.usage_limit,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      updatedAt: r.updated_at,
    }))
    .filter((r) => f.status === "all" || r.status === f.status);
}

export interface DiscountEditData {
  discount: DiscountRow;
  status: DiscountStatus;
  summary: string;
  appliesTo: AppliesTo;
  /** Titel der gebundenen Produkte oder Kollektionen */
  scopeItems: { id: string; title: string; handle: string }[];
  formInput: DiscountInput;
}

export async function getDiscountForEdit(id: string): Promise<DiscountEditData | null> {
  const { data: d, error } = await db()
    .from("discount_codes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Rabatt: ${error.message}`);
  if (!d) return null;
  const appliesTo = parseAppliesTo(d.applies_to);
  return {
    discount: d,
    status: discountStatus(d),
    summary: describeDiscount(d),
    appliesTo,
    scopeItems: await scopeItems(appliesTo),
    formInput: {
      id: d.id,
      code: d.code,
      title: d.title,
      kind: d.kind,
      value: d.value,
      minSubtotalCents: d.min_subtotal_cents,
      startsAt: d.starts_at,
      endsAt: d.ends_at,
      usageLimit: d.usage_limit,
      usageLimitPerCustomer: d.usage_limit_per_customer,
      appliesTo,
      combinable: d.combinable,
      customerType: d.customer_type,
      isActive: d.is_active,
    },
  };
}

async function scopeItems(a: AppliesTo): Promise<{ id: string; title: string; handle: string }[]> {
  if (a.scope === "order") return [];
  const client = db();
  if (a.scope === "products") {
    const { data } = await client
      .from("products")
      .select("id, handle, product_translations (locale, title)")
      .in("id", a.ids);
    return (data ?? []).map((p) => ({
      id: p.id,
      handle: p.handle,
      title: p.product_translations.find((t) => t.locale === "de")?.title ?? p.handle,
    }));
  }
  const { data } = await client
    .from("collections")
    .select("id, handle, collection_translations (locale, title)")
    .in("id", a.ids);
  return (data ?? []).map((c) => ({
    id: c.id,
    handle: c.handle,
    title: c.collection_translations.find((t) => t.locale === "de")?.title ?? c.handle,
  }));
}

export async function saveDiscount(
  input: DiscountInput,
  actor: StaffSession,
): Promise<AdminResult<{ id: string; code: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = discountInputSchema.safeParse(input);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const d = parsed.data;
  const client = db();

  let existing: DiscountRow | null = null;
  if (d.id) {
    const { data } = await client.from("discount_codes").select("*").eq("id", d.id).maybeSingle();
    if (!data) return fail(NOT_FOUND);
    existing = data;
  }

  // citext: Vergleich ohne Groß/klein
  const { data: clash } = await client
    .from("discount_codes")
    .select("id")
    .eq("code", d.code)
    .neq("id", d.id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  if (clash) return fail(INVALID_INPUT, { code: "Diesen Code gibt es schon." });

  if (d.appliesTo.scope !== "order") {
    const table = d.appliesTo.scope === "products" ? "products" : "collections";
    const { data: found } = await client.from(table).select("id").in("id", d.appliesTo.ids);
    if ((found ?? []).length !== new Set(d.appliesTo.ids).size)
      return fail(INVALID_INPUT, { appliesTo: "Mindestens eine Auswahl gibt es nicht mehr." });
  }

  const row = {
    code: d.code,
    title: d.title,
    kind: d.kind,
    value: d.value,
    applies_to: d.appliesTo as Json,
    min_subtotal_cents: d.minSubtotalCents,
    starts_at: d.startsAt?.toISOString() ?? null,
    ends_at: d.endsAt?.toISOString() ?? null,
    usage_limit: d.usageLimit,
    usage_limit_per_customer: d.usageLimitPerCustomer,
    combinable: d.combinable,
    customer_type: d.customerType,
    is_active: d.isActive,
  };

  const warnings: string[] = [];
  let id: string;
  if (existing) {
    if (existing.usage_count > 0) {
      if (existing.code.toUpperCase() !== d.code) {
        warnings.push(
          "Der Code wurde schon eingelöst. Kunden mit dem alten Code können ihn nicht mehr nutzen.",
        );
      }
      if (existing.kind !== d.kind || existing.value !== d.value) {
        warnings.push(
          "Bereits eingelöste Bestellungen behalten ihren Rabatt, nur neue Einlösungen rechnen anders.",
        );
      }
    }
    const { error } = await client.from("discount_codes").update(row).eq("id", existing.id);
    if (error) return fail(dbErrorMessage(error));
    id = existing.id;
  } else {
    const { data, error } = await client
      .from("discount_codes")
      .insert({ ...row, created_by: actor.userId })
      .select("id")
      .single();
    if (error || !data) return fail(dbErrorMessage(error));
    id = data.id;
  }
  if (d.usageLimit != null && existing && existing.usage_count >= d.usageLimit) {
    warnings.push("Das Gesamtlimit ist schon erreicht, der Code ist damit aufgebraucht.");
  }

  const diff = changedFields(existing, row);
  await writeAudit(actor, {
    action: existing ? "discount.update" : "discount.create",
    entityType: "discount_code",
    entityId: id,
    before: diff?.before ?? null,
    after: diff?.after ?? null,
  });
  return ok({ id, code: d.code }, warnings);
}

export async function setDiscountActive(
  id: string,
  active: boolean,
  actor: StaffSession,
): Promise<AdminResult<{ isActive: boolean }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: d } = await client
    .from("discount_codes")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!d) return fail(NOT_FOUND);
  if (d.is_active === active) return ok({ isActive: active });
  const { error } = await client.from("discount_codes").update({ is_active: active }).eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: active ? "discount.activate" : "discount.deactivate",
    entityType: "discount_code",
    entityId: id,
    before: { is_active: d.is_active },
    after: { is_active: active },
  });
  return ok({ isActive: active });
}

export function deactivateDiscount(id: string, actor: StaffSession) {
  return setDiscountActive(id, false, actor);
}

/** Löschen nur ohne Einlösungen; eingelöste Codes bleiben für Bestellungen nachvollziehbar. */
export async function deleteDiscount(
  id: string,
  actor: StaffSession,
): Promise<AdminResult<{ id: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: d } = await client
    .from("discount_codes")
    .select("id, code, usage_count")
    .eq("id", id)
    .maybeSingle();
  if (!d) return fail(NOT_FOUND);
  const { count } = await client
    .from("discount_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("discount_code_id", id);
  if (d.usage_count > 0 || count)
    return fail("Der Code wurde schon eingelöst. Deaktiviere ihn statt ihn zu löschen.");
  const { count: carts } = await client
    .from("carts")
    .select("id", { count: "exact", head: true })
    .eq("discount_code_id", id);
  if (carts)
    await client.from("carts").update({ discount_code_id: null }).eq("discount_code_id", id);
  const { error } = await client.from("discount_codes").delete().eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: "discount.delete",
    entityType: "discount_code",
    entityId: id,
    before: { code: d.code },
  });
  return ok({ id });
}

export interface DiscountUsage {
  usageCount: number;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  totalDiscountCents: number;
  uniqueCustomers: number;
  /** Einlösungen aus Testbestellungen (orders.is_test) */
  testRedemptions: number;
  redemptions: {
    orderId: string;
    orderNumber: string | null;
    email: string;
    customerId: string | null;
    amountCents: number;
    isTest: boolean;
    createdAt: string;
  }[];
}

export async function getDiscountUsage(
  id: string,
  viewer?: StaffSession | null,
  options: { limit?: number } = {},
): Promise<DiscountUsage | null> {
  const client = db();
  const { data: d } = await client
    .from("discount_codes")
    .select("usage_count, usage_limit, usage_limit_per_customer")
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const { data: reds, error } = await client
    .from("discount_redemptions")
    .select("order_id, customer_id, email, amount_cents, created_at")
    .eq("discount_code_id", id)
    .order("created_at", { ascending: false })
    .limit(Math.min(options.limit ?? 500, 2000));
  if (error) throw new Error(`Einlösungen: ${error.message}`);
  const rows = reds ?? [];
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const { data: orders } = orderIds.length
    ? await client.from("orders").select("id, order_number, is_test").in("id", orderIds)
    : { data: [] as { id: string; order_number: string; is_test: boolean }[] };
  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
  const showEmail = viewer ? can(viewer, "viewCustomers") : false;

  const redemptions = rows.map((r) => {
    const o = orderMap.get(r.order_id);
    return {
      orderId: r.order_id,
      orderNumber: o?.order_number ?? null,
      email: showEmail ? r.email : maskEmail(r.email),
      customerId: showEmail ? r.customer_id : null,
      amountCents: r.amount_cents,
      isTest: o?.is_test ?? false,
      createdAt: r.created_at,
    };
  });
  return {
    usageCount: d.usage_count,
    usageLimit: d.usage_limit,
    usageLimitPerCustomer: d.usage_limit_per_customer,
    totalDiscountCents: rows.reduce((s, r) => s + r.amount_cents, 0),
    uniqueCustomers: new Set(rows.map((r) => r.email.toLowerCase())).size,
    testRedemptions: redemptions.filter((r) => r.isTest).length,
    redemptions,
  };
}

/**
 * Code prüfen wie an der Kasse (gleiches Laden, gleiche Regeln aus src/lib/pricing):
 * Laufzeit, Limits gesamt und je Kunde (per E-Mail), Mindestbestellwert, Produktbindung.
 */
export async function checkDiscount(input: {
  code: string;
  subtotalCents: number;
  email?: string | null;
  lines?: PricedLine[];
  now?: Date;
}): Promise<{
  found: boolean;
  evaluation: DiscountEvaluation | null;
  message: string | null;
  status: DiscountStatus | null;
}> {
  const client = db();
  const { data: d } = await client
    .from("discount_codes")
    .select("*")
    .eq("code", normalizeCode(input.code))
    .maybeSingle();
  if (!d)
    return { found: false, evaluation: null, message: DISCOUNT_MESSAGES.unknown, status: null };

  let customerUsageCount = 0;
  if (input.email && d.usage_limit_per_customer != null) {
    const { count } = await client
      .from("discount_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("discount_code_id", d.id)
      .eq("email", input.email.trim().toLowerCase());
    customerUsageCount = count ?? 0;
  }
  const appliesTo = parseAppliesTo(d.applies_to);
  let productIds: string[] | undefined;
  if (appliesTo.scope === "products") productIds = appliesTo.ids;
  if (appliesTo.scope === "collections") {
    const { data } = await client
      .from("collection_products")
      .select("product_id")
      .in("collection_id", appliesTo.ids);
    productIds = [...new Set((data ?? []).map((r) => r.product_id))];
  }
  const rule = toPricingRule(d, { customerUsageCount, productIds });
  const evaluation = previewDiscount(
    rule,
    { subtotalCents: input.subtotalCents, lines: input.lines },
    input.now,
  );
  return {
    found: true,
    evaluation,
    message: evaluation.ok ? null : evaluation.reason ? DISCOUNT_MESSAGES[evaluation.reason] : null,
    status: discountStatus(d, input.now),
  };
}
