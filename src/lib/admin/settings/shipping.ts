import "server-only";
import { z } from "zod";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { crmDb, dbError } from "@/lib/admin/customers/crm-db";
import { assertPermission, parseInput } from "@/lib/admin/customers/guard";
import { revalidateLayout } from "@/lib/admin/content/common";
import { formatEur } from "@/lib/money";

/**
 * Versandzonen und Tarife (shipping_zones, shipping_rates) sowie Steuersätze (tax_rates).
 * Start nur Deutschland, Österreich vorbereitet und abgeschaltet (Briefing 13). Beträge in Cent.
 * Owner und Admin (editSettings). Die Berechnung selbst liegt in src/lib/pricing.
 */

const uuid = z.string().uuid("Ungültige ID");
const cents = z.coerce
  .number("Bitte gib einen gültigen Betrag ein.")
  .int("Betrag in Cent")
  .min(0, "Der Betrag darf nicht negativ sein.")
  .max(10_000_000);
const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Ländercode mit zwei Buchstaben (DE, AT).");

export interface ShippingRateView {
  id: string;
  zoneId: string;
  name: string;
  description: string | null;
  priceCents: number;
  freeAboveSubtotalCents: number | null;
  minSubtotalCents: number;
  maxSubtotalCents: number | null;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  carrier: string;
  service: string;
  deliveryTimeText: string | null;
  taxClass: string;
  isEnabled: boolean;
  position: number;
  /** z.B. "4,90 €, frei ab 50,00 €" */
  summary: string;
}

export interface ShippingZoneView {
  id: string;
  code: string;
  name: string;
  countryCodes: string[];
  isEnabled: boolean;
  position: number;
  rates: ShippingRateView[];
}

export function rateSummary(r: {
  price_cents: number;
  free_above_subtotal_cents: number | null;
}): string {
  const base = r.price_cents === 0 ? "kostenlos" : formatEur(r.price_cents);
  return r.free_above_subtotal_cents != null
    ? `${base}, frei ab ${formatEur(r.free_above_subtotal_cents)}`
    : base;
}

export async function listShippingZones(): Promise<ShippingZoneView[]> {
  const db = crmDb();
  const [{ data: zones, error }, { data: rates, error: rErr }] = await Promise.all([
    db.from("shipping_zones").select("*").order("position"),
    db.from("shipping_rates").select("*").order("position"),
  ]);
  if (error || rErr) throw dbError("Versand laden", error ?? rErr);
  return (zones ?? []).map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
    countryCodes: z.country_codes,
    isEnabled: z.is_enabled,
    position: z.position,
    rates: (rates ?? [])
      .filter((r) => r.zone_id === z.id)
      .map((r) => ({
        id: r.id,
        zoneId: r.zone_id,
        name: r.name,
        description: r.description,
        priceCents: r.price_cents,
        freeAboveSubtotalCents: r.free_above_subtotal_cents,
        minSubtotalCents: r.min_subtotal_cents,
        maxSubtotalCents: r.max_subtotal_cents,
        minWeightGrams: r.min_weight_grams,
        maxWeightGrams: r.max_weight_grams,
        carrier: r.carrier,
        service: r.service,
        deliveryTimeText: r.delivery_time_text,
        taxClass: r.tax_class,
        isEnabled: r.is_enabled,
        position: r.position,
        summary: rateSummary(r),
      })),
  }));
}

/** Mindestens eine eingeschaltete Zone mit eingeschaltetem Tarif muss bleiben, sonst kann niemand bestellen. */
async function assertShippable(): Promise<void> {
  const zones = await listShippingZones();
  const ok = zones.some((z) => z.isEnabled && z.rates.some((r) => r.isEnabled));
  if (!ok)
    throw new Error("Mindestens eine aktive Versandzone mit aktivem Tarif muss bestehen bleiben");
}

const zoneSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,20}$/, "Kurzname aus Kleinbuchstaben, z.B. de oder at."),
  name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(80),
  countryCodes: z.array(country).min(1, "Mindestens ein Land.").max(30),
  isEnabled: z.boolean().default(false),
  position: z.coerce.number().int().min(0).max(1000).default(0),
});

function zoneRow(d: z.infer<typeof zoneSchema>) {
  return {
    code: d.code,
    name: d.name,
    country_codes: d.countryCodes,
    is_enabled: d.isEnabled,
    position: d.position,
  };
}

export async function createShippingZone(
  input: z.input<typeof zoneSchema>,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editSettings");
  const d = parseInput(zoneSchema, input);
  const { data, error } = await crmDb()
    .from("shipping_zones")
    .insert(zoneRow(d))
    .select("id")
    .single();
  if (error) throw dbError("Versandzone anlegen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "shipping_zone.create",
    entityType: "shipping_zone",
    entityId: data.id,
    after: zoneRow(d),
  });
  return { id: data.id };
}

export async function updateShippingZone(
  id: string,
  input: z.input<typeof zoneSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editSettings");
  const zoneId = parseInput(uuid, id);
  const d = parseInput(zoneSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("shipping_zones")
    .select("*")
    .eq("id", zoneId)
    .maybeSingle();
  if (!before) throw new Error("Versandzone nicht gefunden");
  const { error } = await db.from("shipping_zones").update(zoneRow(d)).eq("id", zoneId);
  if (error) throw dbError("Versandzone speichern", error);
  try {
    await assertShippable();
  } catch (e) {
    await db.from("shipping_zones").update({ is_enabled: before.is_enabled }).eq("id", zoneId);
    throw e;
  }
  revalidateLayout();
  await writeAudit(actor, {
    action: "shipping_zone.update",
    entityType: "shipping_zone",
    entityId: zoneId,
    before,
    after: zoneRow(d),
  });
}

export async function deleteShippingZone(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editSettings");
  const zoneId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("shipping_zones")
    .select("*")
    .eq("id", zoneId)
    .maybeSingle();
  if (!before) return;
  if (before.is_enabled) throw new Error("Aktive Versandzonen bitte zuerst abschalten");
  const { error } = await db.from("shipping_zones").delete().eq("id", zoneId);
  if (error) throw dbError("Versandzone löschen", error);
  await writeAudit(actor, {
    action: "shipping_zone.delete",
    entityType: "shipping_zone",
    entityId: zoneId,
    before,
  });
}

const rateSchema = z
  .object({
    zoneId: uuid,
    name: z.string().trim().min(2, "Bitte gib einen Namen für den Checkout ein.").max(80),
    description: z.string().trim().max(200).optional().nullable(),
    priceCents: cents,
    freeAboveSubtotalCents: cents.optional().nullable(),
    minSubtotalCents: cents.default(0),
    maxSubtotalCents: cents.optional().nullable(),
    minWeightGrams: z.coerce.number().int().min(0).max(1_000_000).default(0),
    maxWeightGrams: z.coerce.number().int().min(0).max(1_000_000).optional().nullable(),
    carrier: z.enum(["dhl"]).default("dhl"),
    service: z
      .string()
      .trim()
      .regex(/^V\d{2}[A-Z]{2,5}$/, "DHL-Produktcode, z.B. V01PAK.")
      .default("V01PAK"),
    deliveryTimeText: z.string().trim().max(60).optional().nullable(),
    taxClass: z.enum(["standard", "reduced"]).default("standard"),
    isEnabled: z.boolean().default(true),
    position: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => v.maxSubtotalCents == null || v.maxSubtotalCents > v.minSubtotalCents, {
    message: "Höchstwert muss über dem Mindestwert liegen.",
    path: ["maxSubtotalCents"],
  })
  .refine((v) => v.maxWeightGrams == null || v.maxWeightGrams > v.minWeightGrams, {
    message: "Höchstgewicht muss über dem Mindestgewicht liegen.",
    path: ["maxWeightGrams"],
  });

function rateRow(d: z.infer<typeof rateSchema>) {
  return {
    zone_id: d.zoneId,
    name: d.name,
    description: d.description || null,
    price_cents: d.priceCents,
    free_above_subtotal_cents: d.freeAboveSubtotalCents ?? null,
    min_subtotal_cents: d.minSubtotalCents,
    max_subtotal_cents: d.maxSubtotalCents ?? null,
    min_weight_grams: d.minWeightGrams,
    max_weight_grams: d.maxWeightGrams ?? null,
    carrier: d.carrier,
    service: d.service,
    delivery_time_text: d.deliveryTimeText || null,
    tax_class: d.taxClass,
    is_enabled: d.isEnabled,
    position: d.position,
  };
}

export async function createShippingRate(
  input: z.input<typeof rateSchema>,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editSettings");
  const d = parseInput(rateSchema, input);
  const { data, error } = await crmDb()
    .from("shipping_rates")
    .insert(rateRow(d))
    .select("id")
    .single();
  if (error) throw dbError("Tarif anlegen", error);
  revalidateLayout();
  await writeAudit(actor, {
    action: "shipping_rate.create",
    entityType: "shipping_rate",
    entityId: data.id,
    after: rateRow(d),
  });
  return { id: data.id };
}

export async function updateShippingRate(
  id: string,
  input: z.input<typeof rateSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editSettings");
  const rateId = parseInput(uuid, id);
  const d = parseInput(rateSchema, input);
  const db = crmDb();
  const { data: before } = await db
    .from("shipping_rates")
    .select("*")
    .eq("id", rateId)
    .maybeSingle();
  if (!before) throw new Error("Tarif nicht gefunden");
  const { error } = await db.from("shipping_rates").update(rateRow(d)).eq("id", rateId);
  if (error) throw dbError("Tarif speichern", error);
  try {
    await assertShippable();
  } catch (e) {
    await db.from("shipping_rates").update({ is_enabled: before.is_enabled }).eq("id", rateId);
    throw e;
  }
  revalidateLayout();
  await writeAudit(actor, {
    action: "shipping_rate.update",
    entityType: "shipping_rate",
    entityId: rateId,
    before,
    after: rateRow(d),
  });
}

export async function deleteShippingRate(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editSettings");
  const rateId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db
    .from("shipping_rates")
    .select("*")
    .eq("id", rateId)
    .maybeSingle();
  if (!before) return;
  const { error } = await db.from("shipping_rates").delete().eq("id", rateId);
  if (error) throw dbError("Tarif löschen", error);
  try {
    await assertShippable();
  } catch (e) {
    const { id: _id, ...restore } = before;
    void _id;
    await db.from("shipping_rates").insert({ id: before.id, ...restore });
    throw e;
  }
  revalidateLayout();
  await writeAudit(actor, {
    action: "shipping_rate.delete",
    entityType: "shipping_rate",
    entityId: rateId,
    before,
  });
}

/* Steuersätze ------------------------------------------------------------------------------ */

export interface TaxRateView {
  id: string;
  countryCode: string;
  taxClass: string;
  rateBp: number;
  /** z.B. "19 %" */
  rateLabel: string;
  name: string;
  validFrom: string;
  validTo: string | null;
}

export function rateLabel(bp: number): string {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

export async function listTaxRates(): Promise<TaxRateView[]> {
  const { data, error } = await crmDb()
    .from("tax_rates")
    .select("*")
    .order("country_code")
    .order("tax_class")
    .order("valid_from");
  if (error) throw dbError("Steuersätze laden", error);
  return (data ?? []).map((t) => ({
    id: t.id,
    countryCode: t.country_code,
    taxClass: t.tax_class,
    rateBp: t.rate_bp,
    rateLabel: rateLabel(t.rate_bp),
    name: t.name,
    validFrom: t.valid_from,
    validTo: t.valid_to,
  }));
}

const taxSchema = z
  .object({
    countryCode: country,
    taxClass: z.enum(["standard", "reduced", "zero"]),
    rateBp: z.coerce.number().int().min(0).max(10_000),
    name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(80),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT."),
    validTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .refine((v) => !v.validTo || v.validTo > v.validFrom, {
    message: "Ende muss nach dem Beginn liegen.",
    path: ["validTo"],
  });

function taxRow(d: z.infer<typeof taxSchema>) {
  return {
    country_code: d.countryCode,
    tax_class: d.taxClass,
    rate_bp: d.rateBp,
    name: d.name,
    valid_from: d.validFrom,
    valid_to: d.validTo ?? null,
  };
}

/**
 * Steuersatz anlegen. Satzänderungen bitte als neuen Satz mit valid_from statt Überschreiben
 * (alte Bestellungen behalten ihren Satz ohnehin als Snapshot in order_items.tax_rate_bp).
 */
export async function createTaxRate(
  input: z.input<typeof taxSchema>,
  actor: StaffSession,
): Promise<{ id: string }> {
  assertPermission(actor, "editSettings");
  const d = parseInput(taxSchema, input);
  const { data, error } = await crmDb().from("tax_rates").insert(taxRow(d)).select("id").single();
  if (error) throw dbError("Steuersatz anlegen", error);
  await writeAudit(actor, {
    action: "tax_rate.create",
    entityType: "tax_rate",
    entityId: data.id,
    after: taxRow(d),
  });
  return { id: data.id };
}

export async function updateTaxRate(
  id: string,
  input: z.input<typeof taxSchema>,
  actor: StaffSession,
): Promise<void> {
  assertPermission(actor, "editSettings");
  const taxId = parseInput(uuid, id);
  const d = parseInput(taxSchema, input);
  const db = crmDb();
  const { data: before } = await db.from("tax_rates").select("*").eq("id", taxId).maybeSingle();
  if (!before) throw new Error("Steuersatz nicht gefunden");
  const { error } = await db.from("tax_rates").update(taxRow(d)).eq("id", taxId);
  if (error) throw dbError("Steuersatz speichern", error);
  await writeAudit(actor, {
    action: "tax_rate.update",
    entityType: "tax_rate",
    entityId: taxId,
    before,
    after: taxRow(d),
  });
}

export async function deleteTaxRate(id: string, actor: StaffSession): Promise<void> {
  assertPermission(actor, "editSettings");
  const taxId = parseInput(uuid, id);
  const db = crmDb();
  const { data: before } = await db.from("tax_rates").select("*").eq("id", taxId).maybeSingle();
  if (!before) return;
  const { count } = await db
    .from("tax_rates")
    .select("id", { count: "exact", head: true })
    .eq("country_code", before.country_code)
    .eq("tax_class", before.tax_class);
  if ((count ?? 0) <= 1)
    throw new Error("Der letzte Satz einer Steuerklasse lässt sich nicht löschen");
  const { error } = await db.from("tax_rates").delete().eq("id", taxId);
  if (error) throw dbError("Steuersatz löschen", error);
  await writeAudit(actor, {
    action: "tax_rate.delete",
    entityType: "tax_rate",
    entityId: taxId,
    before,
  });
}
