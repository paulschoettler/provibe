import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { applyAutomaticCollections, upsertRedirect } from "@/lib/admin/collections/data";
import type { Database, Json } from "@/lib/supabase/database.types";
import { can, db, dbErrorMessage } from "./access";
import {
  changedFields,
  fail,
  INVALID_INPUT,
  NO_PERMISSION,
  NOT_FOUND,
  ok,
  zodFieldErrors,
  type AdminResult,
  type FieldErrors,
} from "./result";
import { revalidateCatalog } from "./revalidate";
import {
  bundleComponentErrors,
  bundleComponentsSchema,
  FORMER_PRICE_ENABLED,
  handleChangeRedirect,
  nextFreeHandle,
  normalizeProductInput,
  optionKey,
  productInputSchema,
  publishErrors,
  validateVariants,
  variantsInputSchema,
  type BundleComponentInput,
  type ComponentFacts,
  type ProductInput,
  type VariantInput,
} from "./rules";

/**
 * Schreibende Funktionen des Produkt-Editors. Jede prüft die Rolle (editProducts), validiert
 * mit Zod, schreibt audit_log und löst die On-Demand-Revalidation aus. Die Preishistorie
 * schreibt der Trigger product_variants_price_history; hier wird nur changed_by nachgetragen.
 */

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];

const NIL = "00000000-0000-0000-0000-000000000000";

/* ------------------------------------------------------------------------------------------ */
/* Produkt                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export async function saveProduct(
  input: ProductInput,
  actor: StaffSession,
): Promise<AdminResult<{ id: string; handle: string; created: boolean }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const { product: p, fieldErrors, warnings } = normalizeProductInput(parsed.data);
  if (Object.keys(fieldErrors).length) return fail(INVALID_INPUT, fieldErrors);

  const client = db();
  let existing: ProductRow | null = null;
  if (p.id) {
    const { data } = await client.from("products").select("*").eq("id", p.id).maybeSingle();
    if (!data) return fail(NOT_FOUND);
    existing = data;
  }

  const errors: FieldErrors = {};
  const [{ data: clash }, { data: tax }] = await Promise.all([
    client
      .from("products")
      .select("id")
      .eq("handle", p.handle)
      .neq("id", p.id ?? NIL)
      .maybeSingle(),
    client.from("tax_rates").select("tax_class").eq("tax_class", p.taxClass).limit(1),
  ]);
  if (clash) errors.handle = "Dieser Handle ist schon vergeben.";
  if (!tax?.length) errors.taxClass = "Diese Steuerklasse gibt es nicht.";
  if (existing && existing.kind !== p.kind) {
    const { count } = await client
      .from("bundle_components")
      .select("bundle_variant_id", { count: "exact", head: true })
      .in("bundle_variant_id", await variantIdsOf(existing.id));
    if (count)
      errors.kind = "Das Bundle hat noch Komponenten. Entferne sie, bevor du die Art änderst.";
  }
  if (p.collectionIds?.length) {
    const { data: cols } = await client
      .from("collections")
      .select("id, kind")
      .in("id", p.collectionIds);
    const manual = new Set((cols ?? []).filter((c) => c.kind === "manual").map((c) => c.id));
    if (p.collectionIds.some((id) => !manual.has(id)))
      errors.collectionIds = "Produkte lassen sich nur manuellen Kollektionen zuordnen.";
  }
  if (p.status === "active") {
    const variants = existing
      ? ((
          await client
            .from("product_variants")
            .select("price_cents, is_active")
            .eq("product_id", existing.id)
        ).data ?? [])
      : [];
    Object.assign(
      errors,
      publishErrors(
        p,
        variants.map((v) => ({ priceCents: v.price_cents, isActive: v.is_active })),
      ),
    );
    if (!existing)
      errors.status = "Lege das Produkt zuerst als Entwurf an und ergänze die Varianten.";
  }
  if (Object.keys(errors).length) return fail(INVALID_INPUT, errors);

  const row = {
    handle: p.handle,
    status: p.status,
    kind: p.kind,
    vendor: p.vendor,
    product_type: p.productType,
    tags: p.tags,
    tax_class: p.taxClass,
    is_food: p.isFood,
    deposit_cents_per_unit: p.depositCentsPerUnit,
    unit_label: p.unitLabel,
    net_content_per_unit: p.netContentPerUnit,
    net_content_measure: p.netContentMeasure,
    base_price_measure: p.basePriceMeasure,
    weight_grams_per_unit: p.weightGramsPerUnit,
    attributes: p.attributes as Json,
    ...(p.position != null ? { position: p.position } : {}),
    ...(p.status === "active" && !existing?.published_at
      ? { published_at: new Date().toISOString() }
      : {}),
  };

  let id: string;
  if (existing) {
    const { error } = await client.from("products").update(row).eq("id", existing.id);
    if (error) return fail(dbErrorMessage(error));
    id = existing.id;
  } else {
    const { data, error } = await client.from("products").insert(row).select("id").single();
    if (error || !data) return fail(dbErrorMessage(error));
    id = data.id;
  }

  const translation = {
    product_id: id,
    locale: p.locale,
    title: p.title,
    subtitle: p.subtitle,
    description_html: p.descriptionHtml,
    delivery_time_text: p.deliveryTimeText,
    seo_title: p.seo.title,
    seo_description: p.seo.description,
    og_image_path: p.seo.ogImagePath,
    food_name: p.lmiv.foodName,
    ingredients_html: p.lmiv.ingredientsHtml,
    allergens: p.lmiv.allergens,
    nutrition: p.lmiv.nutrition as Json,
    storage_instructions: p.lmiv.storageInstructions,
    food_business_operator: p.lmiv.foodBusinessOperator,
    country_of_origin: p.lmiv.countryOfOrigin,
    faq: p.faq as Json,
  };
  const { data: prevT } = await client
    .from("product_translations")
    .select("*")
    .eq("product_id", id)
    .eq("locale", p.locale)
    .maybeSingle();
  const { error: tErr } = await client
    .from("product_translations")
    .upsert(translation, { onConflict: "product_id,locale" });
  if (tErr) return fail(dbErrorMessage(tErr));

  if (p.collectionIds) await syncManualCollections(id, p.collectionIds);

  const redirect = handleChangeRedirect(existing?.handle, p.handle, !!existing?.published_at);
  if (redirect) {
    await upsertRedirect(redirect.fromPath, redirect.toPath, `Produkt umbenannt (${id})`);
    warnings.push(`Alter Pfad ${redirect.fromPath} leitet jetzt auf ${redirect.toPath} weiter.`);
  }

  await applyAutomaticCollections(actor);

  const { product_id: _pid, ...tFields } = translation;
  const diff = changedFields(existing ? { ...existing, ...(prevT ?? {}) } : null, {
    ...row,
    ...tFields,
    ...(p.collectionIds ? { collection_ids: p.collectionIds } : {}),
  });
  await writeAudit(actor, {
    action: existing ? "product.update" : "product.create",
    entityType: "product",
    entityId: id,
    before: diff?.before ?? null,
    after: diff?.after ?? null,
  });

  revalidateCatalog({
    productHandles: [
      p.handle,
      ...(existing && existing.handle !== p.handle ? [existing.handle] : []),
    ],
    allCollections: true,
  });
  return ok({ id, handle: p.handle, created: !existing }, warnings);
}

async function variantIdsOf(productId: string): Promise<string[]> {
  const { data } = await db().from("product_variants").select("id").eq("product_id", productId);
  const ids = (data ?? []).map((v) => v.id);
  return ids.length ? ids : [NIL];
}

/** Zuordnung zu manuellen Kollektionen: neue ans Ende, abgewählte entfernen. */
async function syncManualCollections(productId: string, collectionIds: string[]): Promise<void> {
  const client = db();
  const { data: current } = await client
    .from("collection_products")
    .select("collection_id, collections!inner (kind)")
    .eq("product_id", productId)
    .eq("collections.kind", "manual");
  const have = new Set((current ?? []).map((r) => r.collection_id));
  const want = new Set(collectionIds);
  for (const cid of want) {
    if (have.has(cid)) continue;
    const { data: last } = await client
      .from("collection_products")
      .select("position")
      .eq("collection_id", cid)
      .order("position", { ascending: false })
      .limit(1);
    await client.from("collection_products").insert({
      collection_id: cid,
      product_id: productId,
      position: (last?.[0]?.position ?? -1) + 1,
    });
  }
  const remove = [...have].filter((cid) => !want.has(cid));
  if (remove.length) {
    await client
      .from("collection_products")
      .delete()
      .eq("product_id", productId)
      .in("collection_id", remove);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Varianten                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const VARIANT_AUDIT_KEYS = [
  "title",
  "option_values",
  "price_cents",
  "compare_at_cents",
  "compare_at_kind",
  "sku",
  "gtin",
  "weight_grams",
  "packaging_weight_grams",
  "unit_count",
  "is_active",
  "position",
] as const;

/**
 * Varianten anlegen und ändern. Varianten, die nicht in der Liste stehen, bleiben unverändert
 * (Entfernen über removeVariant). Neue einfache Varianten bekommen eine Bestandszeile mit 0.
 */
export async function saveVariants(
  productId: string,
  variants: VariantInput[],
  actor: StaffSession,
): Promise<AdminResult<{ variants: { id: string; title: string; created: boolean }[] }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = variantsInputSchema.safeParse(variants);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));

  const client = db();
  const { data: product } = await client
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return fail(NOT_FOUND);

  const {
    variants: list,
    fieldErrors,
    warnings,
  } = validateVariants(parsed.data, {
    productKind: product.kind,
    depositCentsPerUnit: product.deposit_cents_per_unit,
  });

  const { data: existingRows } = await client
    .from("product_variants")
    .select("*")
    .eq("product_id", productId);
  const existing = new Map((existingRows ?? []).map((v) => [v.id, v]));
  const inputIds = new Set(list.flatMap((v) => (v.id ? [v.id] : [])));

  list.forEach((v, i) => {
    if (v.id && !existing.has(v.id))
      fieldErrors[`variants.${i}`] = "Diese Variante gehört nicht zum Produkt.";
  });

  // Optionswerte gegen Varianten, die nicht in der Liste stehen
  const otherKeys = new Map(
    (existingRows ?? [])
      .filter((v) => !inputIds.has(v.id))
      .map((v) => [optionKey(v.option_values as Record<string, string>), v.title]),
  );
  list.forEach((v, i) => {
    const other = otherKeys.get(optionKey(v.optionValues));
    if (other)
      fieldErrors[`variants.${i}.optionValues`] = `Diese Optionswerte hat schon „${other}“.`;
  });

  // SKU und GTIN eindeutig über alle Produkte
  const skus = list.flatMap((v) => (v.sku ? [v.sku] : []));
  const gtins = list.flatMap((v) => (v.gtin ? [v.gtin] : []));
  const [skuHits, gtinHits] = await Promise.all([
    skus.length
      ? client.from("product_variants").select("id, sku, title").in("sku", skus)
      : Promise.resolve({ data: [] as { id: string; sku: string | null; title: string }[] }),
    gtins.length
      ? client.from("product_variants").select("id, gtin, title").in("gtin", gtins)
      : Promise.resolve({ data: [] as { id: string; gtin: string | null; title: string }[] }),
  ]);
  list.forEach((v, i) => {
    const s = (skuHits.data ?? []).find(
      (h) => h.sku === v.sku && h.id !== v.id && !inputIds.has(h.id),
    );
    if (s)
      fieldErrors[`variants.${i}.sku`] = "Diese SKU ist schon an einer anderen Variante vergeben.";
    const g = (gtinHits.data ?? []).find(
      (h) => h.gtin === v.gtin && h.id !== v.id && !inputIds.has(h.id),
    );
    if (g)
      fieldErrors[`variants.${i}.gtin`] =
        "Diese GTIN ist schon an einer anderen Variante vergeben.";
  });

  // Früherer Preis (nur wenn freigeschaltet, H17): muss dem niedrigsten Preis der letzten 30 Tage entsprechen
  if (FORMER_PRICE_ENABLED) {
    for (const [i, v] of list.entries()) {
      if (v.compareAtKind !== "former_price" || !v.id) continue;
      const { data: lowest } = await client.rpc("lowest_price_last_30_days", {
        p_variant_id: v.id,
      });
      if (typeof lowest !== "number" || lowest !== v.compareAtCents) {
        fieldErrors[`variants.${i}.compareAtCents`] =
          "Der frühere Preis muss dem niedrigsten Preis der letzten 30 Tage entsprechen.";
      }
    }
  }

  // Aktives Produkt muss kaufbar bleiben
  if (product.status === "active") {
    const merged = [
      ...(existingRows ?? [])
        .filter((v) => !inputIds.has(v.id))
        .map((v) => ({ priceCents: v.price_cents, isActive: v.is_active })),
      ...list.map((v) => ({ priceCents: v.priceCents, isActive: v.isActive })),
    ];
    if (!merged.some((v) => v.isActive && v.priceCents > 0)) {
      fieldErrors.variants =
        "Ein aktives Produkt braucht mindestens eine aktive Variante mit Preis.";
    }
  }
  if (Object.keys(fieldErrors).length) return fail(INVALID_INPUT, fieldErrors);

  const trackDefault = await defaultTracking(productId);
  const saved: { id: string; title: string; created: boolean }[] = [];
  const auditChanges: { id: string; before: unknown; after: unknown }[] = [];
  const priceChanged: string[] = [];

  for (const v of list) {
    const row = {
      title: v.title,
      option_values: v.optionValues as Json,
      price_cents: v.priceCents,
      compare_at_cents: v.compareAtCents,
      compare_at_kind: v.compareAtKind,
      sku: v.sku,
      gtin: v.gtin,
      weight_grams: v.weightGrams,
      packaging_weight_grams: v.packagingWeightGrams,
      unit_count: v.unitCount,
      is_active: v.isActive,
      position: v.position,
    };
    const prev = v.id ? existing.get(v.id) : undefined;
    if (prev) {
      const diff = changedFields(pick(prev), row);
      if (!diff) {
        saved.push({ id: prev.id, title: v.title, created: false });
        continue;
      }
      const { error } = await client.from("product_variants").update(row).eq("id", prev.id);
      if (error)
        return fail(dbErrorMessage(error), {
          [`variants.${list.indexOf(v)}`]: dbErrorMessage(error),
        });
      if ("price_cents" in diff.after || "compare_at_cents" in diff.after)
        priceChanged.push(prev.id);
      auditChanges.push({ id: prev.id, before: diff.before, after: diff.after });
      saved.push({ id: prev.id, title: v.title, created: false });
    } else {
      const { data, error } = await client
        .from("product_variants")
        .insert({ ...row, product_id: productId })
        .select("id")
        .single();
      if (error || !data)
        return fail(dbErrorMessage(error), {
          [`variants.${list.indexOf(v)}`]: dbErrorMessage(error),
        });
      if (product.kind === "simple") {
        await client
          .from("inventory_levels")
          .upsert(
            { variant_id: data.id, on_hand: 0, track_inventory: trackDefault },
            { onConflict: "variant_id", ignoreDuplicates: true },
          );
      }
      priceChanged.push(data.id);
      auditChanges.push({ id: data.id, before: null, after: row });
      saved.push({ id: data.id, title: v.title, created: true });
    }
  }

  // Preishistorie: der Trigger kennt mit Service-Role keinen Benutzer, changed_by nachtragen
  if (priceChanged.length) {
    await client
      .from("price_history")
      .update({ changed_by: actor.userId })
      .in("variant_id", priceChanged)
      .is("valid_to", null)
      .is("changed_by", null);
  }

  await syncOptions(productId);

  if (auditChanges.length) {
    await writeAudit(actor, {
      action: "product.variants.update",
      entityType: "product",
      entityId: productId,
      before: auditChanges.map((c) => ({ id: c.id, ...(c.before as object | null) })),
      after: auditChanges.map((c) => ({ id: c.id, ...(c.after as object) })),
    });
    await applyAutomaticCollections(actor);
    revalidateCatalog({ productHandles: [product.handle], allCollections: true });
  }
  return ok({ variants: saved }, warnings);
}

function pick(v: VariantRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of VARIANT_AUDIT_KEYS) out[k] = v[k];
  return out;
}

/**
 * Bestandsführung für neue Varianten: wie die übrigen Varianten des Produkts, sonst wie der
 * Shop insgesamt (bis zum Import ist sie laut C5/H3 überall aus).
 */
async function defaultTracking(productId: string): Promise<boolean> {
  const client = db();
  const ids = await variantIdsOf(productId);
  const { data: own } = await client
    .from("inventory_levels")
    .select("track_inventory")
    .in("variant_id", ids)
    .limit(1);
  if (own?.length) return own[0].track_inventory;
  const { data: any } = await client
    .from("inventory_levels")
    .select("track_inventory")
    .eq("track_inventory", true)
    .limit(1);
  return !!any?.length;
}

/** product_options aus den Optionswerten der Varianten ableiten (Name, Reihenfolge, Werte). */
async function syncOptions(productId: string): Promise<void> {
  const client = db();
  const { data: variants } = await client
    .from("product_variants")
    .select("option_values, position")
    .eq("product_id", productId)
    .order("position");
  const values = new Map<string, string[]>();
  for (const v of variants ?? []) {
    const ov = (v.option_values ?? {}) as Record<string, unknown>;
    for (const [name, value] of Object.entries(ov)) {
      const list = values.get(name) ?? [];
      if (!list.includes(String(value))) list.push(String(value));
      values.set(name, list);
    }
  }
  const names = [...values.keys()];
  if (names.length) {
    await client.from("product_options").upsert(
      names.map((name, position) => ({
        product_id: productId,
        name,
        position,
        values: values.get(name)!,
      })),
      { onConflict: "product_id,name" },
    );
  }
  const { data: existing } = await client
    .from("product_options")
    .select("id, name")
    .eq("product_id", productId);
  const stale = (existing ?? []).filter((o) => !values.has(o.name)).map((o) => o.id);
  if (stale.length) await client.from("product_options").delete().in("id", stale);
}

/**
 * Variante entfernen. Hat sie Geschichte (Bestellungen, Abos, Bundle-Komponente, Bewegungen),
 * wird sie nur deaktiviert, damit Bestellungen, Preishistorie und Bestand nachvollziehbar bleiben.
 */
export async function removeVariant(
  variantId: string,
  actor: StaffSession,
): Promise<AdminResult<{ deleted: boolean; deactivated: boolean }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: v } = await client
    .from("product_variants")
    .select("id, title, product_id, is_active, products (handle, status)")
    .eq("id", variantId)
    .maybeSingle();
  if (!v) return fail(NOT_FOUND);
  const product = v.products as unknown as { handle: string; status: string };

  const { data: siblings } = await client
    .from("product_variants")
    .select("id, is_active, price_cents")
    .eq("product_id", v.product_id)
    .neq("id", variantId);
  if (
    product.status === "active" &&
    !(siblings ?? []).some((s) => s.is_active && s.price_cents > 0)
  ) {
    return fail("Das ist die letzte kaufbare Variante eines aktiven Produkts.");
  }

  const [orders, components, subs, movements] = await Promise.all([
    client
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId),
    client
      .from("bundle_components")
      .select("bundle_variant_id", { count: "exact", head: true })
      .eq("component_variant_id", variantId),
    client
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId),
    client
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId),
  ]);
  const hasHistory = !!(orders.count || components.count || subs.count || movements.count);

  if (hasHistory) {
    if (v.is_active) {
      const { error } = await client
        .from("product_variants")
        .update({ is_active: false })
        .eq("id", variantId);
      if (error) return fail(dbErrorMessage(error));
    }
    await writeAudit(actor, {
      action: "product.variant.deactivate",
      entityType: "product_variant",
      entityId: variantId,
      before: { is_active: v.is_active },
      after: { is_active: false },
    });
    revalidateCatalog({ productHandles: [product.handle], allCollections: true });
    return ok({ deleted: false, deactivated: true }, [
      `„${v.title}“ hat Bestellungen, Bestandsbewegungen oder steckt in einem Bundle und wurde deshalb nur deaktiviert.`,
    ]);
  }

  const { error } = await client.from("product_variants").delete().eq("id", variantId);
  if (error) return fail(dbErrorMessage(error));
  await syncOptions(v.product_id);
  await writeAudit(actor, {
    action: "product.variant.delete",
    entityType: "product_variant",
    entityId: variantId,
    before: { title: v.title, product_id: v.product_id },
  });
  revalidateCatalog({ productHandles: [product.handle], allCollections: true });
  return ok({ deleted: true, deactivated: false });
}

/* ------------------------------------------------------------------------------------------ */
/* Duplizieren, Archivieren                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Kopie als Entwurf: Übersetzungen (Titel mit "(Kopie)"), Varianten ohne SKU, GTIN und
 * Shopify-IDs, Bestand 0 mit gleichen Einstellungen, Bilder (gleiche Dateien), Bundle-
 * Komponenten und manuelle Kollektionen.
 */
export async function duplicateProduct(
  productId: string,
  actor: StaffSession,
): Promise<AdminResult<{ id: string; handle: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: src } = await client.from("products").select("*").eq("id", productId).maybeSingle();
  if (!src) return fail(NOT_FOUND);

  const { data: similar } = await client
    .from("products")
    .select("handle")
    .like("handle", `${src.handle.slice(0, 60)}%`);
  const handle = nextFreeHandle(src.handle, new Set((similar ?? []).map((r) => r.handle)));

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    published_at: _p,
    shopify_product_id: _s,
    ...rest
  } = src;
  const { data: copy, error } = await client
    .from("products")
    .insert({ ...rest, handle, status: "draft" })
    .select("id")
    .single();
  if (error || !copy) return fail(dbErrorMessage(error));
  const newId = copy.id;

  const [translations, options, variants, images, memberships] = await Promise.all([
    client.from("product_translations").select("*").eq("product_id", productId),
    client.from("product_options").select("*").eq("product_id", productId),
    client.from("product_variants").select("*").eq("product_id", productId).order("position"),
    client.from("product_images").select("*").eq("product_id", productId),
    client
      .from("collection_products")
      .select("collection_id, position, collections!inner (kind)")
      .eq("product_id", productId)
      .eq("collections.kind", "manual"),
  ]);

  if (translations.data?.length) {
    await client.from("product_translations").insert(
      translations.data.map((t) => ({
        ...t,
        product_id: newId,
        title: `${t.title} (Kopie)`.slice(0, 200),
      })),
    );
  }
  if (options.data?.length) {
    await client
      .from("product_options")
      .insert(options.data.map(({ id: _oid, ...o }) => ({ ...o, product_id: newId })));
  }

  const variantMap = new Map<string, string>();
  for (const v of variants.data ?? []) {
    const {
      id: oldId,
      created_at: _vc,
      updated_at: _vu,
      shopify_variant_id: _sv,
      sku: _sku,
      legacy_sku: _lsku,
      gtin: _gtin,
      ...vr
    } = v;
    const { data: nv, error: vErr } = await client
      .from("product_variants")
      .insert({ ...vr, product_id: newId })
      .select("id")
      .single();
    if (vErr || !nv) return fail(dbErrorMessage(vErr));
    variantMap.set(oldId, nv.id);
  }

  const oldIds = [...variantMap.keys()];
  if (oldIds.length) {
    const [levels, comps] = await Promise.all([
      client.from("inventory_levels").select("*").in("variant_id", oldIds),
      client.from("bundle_components").select("*").in("bundle_variant_id", oldIds),
    ]);
    if (levels.data?.length) {
      await client.from("inventory_levels").insert(
        levels.data.map((l) => ({
          variant_id: variantMap.get(l.variant_id)!,
          on_hand: 0,
          reserved: 0,
          low_stock_threshold: l.low_stock_threshold,
          track_inventory: l.track_inventory,
          allow_backorder: l.allow_backorder,
        })),
      );
    }
    if (comps.data?.length) {
      await client.from("bundle_components").insert(
        comps.data.map((c) => ({
          bundle_variant_id: variantMap.get(c.bundle_variant_id)!,
          component_variant_id: c.component_variant_id,
          quantity: c.quantity,
        })),
      );
    }
  }

  if (images.data?.length) {
    await client.from("product_images").insert(
      images.data.map(({ id: _iid, created_at: _ic, ...img }) => ({
        ...img,
        product_id: newId,
        variant_id: img.variant_id ? (variantMap.get(img.variant_id) ?? null) : null,
      })),
    );
  }
  if (memberships.data?.length) {
    for (const m of memberships.data) {
      const { data: last } = await client
        .from("collection_products")
        .select("position")
        .eq("collection_id", m.collection_id)
        .order("position", { ascending: false })
        .limit(1);
      await client.from("collection_products").insert({
        collection_id: m.collection_id,
        product_id: newId,
        position: (last?.[0]?.position ?? -1) + 1,
      });
    }
  }

  await applyAutomaticCollections(actor);
  await writeAudit(actor, {
    action: "product.duplicate",
    entityType: "product",
    entityId: newId,
    after: { source_id: productId, source_handle: src.handle, handle },
  });
  // Entwurf: kein Storefront-Pfad, aber Kollektionszähler und Listen bleiben aktuell
  revalidateCatalog({ allCollections: true });
  return ok({ id: newId, handle }, [
    "Die Kopie ist ein Entwurf ohne SKU und GTIN. Bitte ergänze beides vor dem Veröffentlichen.",
  ]);
}

export async function archiveProduct(
  productId: string,
  actor: StaffSession,
): Promise<AdminResult<{ id: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: p } = await client
    .from("products")
    .select("id, handle, status")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return fail(NOT_FOUND);
  if (p.status === "archived") return ok({ id: p.id });

  const { error } = await client
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId);
  if (error) return fail(dbErrorMessage(error));

  const warnings: string[] = [];
  const ids = await variantIdsOf(productId);
  const { data: usedIn } = await client
    .from("bundle_components")
    .select("bundle_variant_id")
    .in("component_variant_id", ids);
  if (usedIn?.length) {
    warnings.push(
      "Das Produkt steckt als Komponente in Bundles. Prüfe die Bundles, sie bleiben sonst mit dieser Komponente verkäuflich.",
    );
  }
  if (p.status === "active") {
    warnings.push(
      `/products/${p.handle} ist jetzt nicht mehr erreichbar. Lege bei Bedarf eine Weiterleitung an (kein alter Pfad darf in einer 404 enden).`,
    );
  }

  await applyAutomaticCollections(actor);
  await writeAudit(actor, {
    action: "product.archive",
    entityType: "product",
    entityId: productId,
    before: { status: p.status },
    after: { status: "archived" },
  });
  revalidateCatalog({ productHandles: [p.handle], allCollections: true });
  return ok({ id: p.id }, warnings);
}

/* ------------------------------------------------------------------------------------------ */
/* Bundles                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/**
 * Komponenten einer Bundle-Variante ersetzen (H14: Lagereinheit Dose, Bestandsabzug auf
 * Komponentenebene). Erst neue Mengen schreiben, dann Überzählige löschen, damit das Bundle
 * zu keinem Zeitpunkt ohne Komponenten ist (available_quantity wäre sonst 0).
 */
export async function setBundleComponents(
  bundleVariantId: string,
  components: BundleComponentInput[],
  actor: StaffSession,
): Promise<AdminResult<{ componentsSumCents: number }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = bundleComponentsSchema.safeParse(components);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const list = parsed.data;

  const client = db();
  const { data: bundle } = await client
    .from("product_variants")
    .select("id, title, products (id, handle, kind)")
    .eq("id", bundleVariantId)
    .maybeSingle();
  if (!bundle) return fail(NOT_FOUND);
  const bp = bundle.products as unknown as { id: string; handle: string; kind: string };
  if (bp.kind !== "bundle") return fail("Komponenten gibt es nur bei Produkten der Art Bundle.");

  const { data: comps } = await client
    .from("product_variants")
    .select("id, title, unit_count, products (kind, status, product_translations (locale, title))")
    .in(
      "id",
      list.map((c) => c.componentVariantId),
    );
  const facts = new Map<string, ComponentFacts>(
    (comps ?? []).map((c) => {
      const cp = c.products as unknown as {
        kind: ComponentFacts["productKind"];
        status: ComponentFacts["productStatus"];
        product_translations: { locale: string; title: string }[];
      };
      const title = cp.product_translations.find((t) => t.locale === "de")?.title ?? "";
      return [
        c.id,
        {
          productKind: cp.kind,
          productStatus: cp.status,
          unitCount: c.unit_count,
          title: [title, c.title].filter(Boolean).join(" · "),
        },
      ];
    }),
  );
  const errors = bundleComponentErrors(bundleVariantId, list, facts);
  if (Object.keys(errors).length) return fail(INVALID_INPUT, errors);

  const { data: before } = await client
    .from("bundle_components")
    .select("component_variant_id, quantity")
    .eq("bundle_variant_id", bundleVariantId);

  const { error: upErr } = await client.from("bundle_components").upsert(
    list.map((c) => ({
      bundle_variant_id: bundleVariantId,
      component_variant_id: c.componentVariantId,
      quantity: c.quantity,
    })),
    { onConflict: "bundle_variant_id,component_variant_id" },
  );
  if (upErr) return fail(dbErrorMessage(upErr));
  const keep = new Set(list.map((c) => c.componentVariantId));
  const remove = (before ?? [])
    .filter((b) => !keep.has(b.component_variant_id))
    .map((b) => b.component_variant_id);
  if (remove.length) {
    const { error } = await client
      .from("bundle_components")
      .delete()
      .eq("bundle_variant_id", bundleVariantId)
      .in("component_variant_id", remove);
    if (error) return fail(dbErrorMessage(error));
  }

  const { data: sum } = await client.rpc("bundle_components_sum_cents", {
    p_bundle_variant_id: bundleVariantId,
  });
  await writeAudit(actor, {
    action: "product.bundle_components.update",
    entityType: "product_variant",
    entityId: bundleVariantId,
    before: before ?? [],
    after: list,
  });
  revalidateCatalog({ productHandles: [bp.handle], allCollections: true });
  return ok({ componentsSumCents: typeof sum === "number" ? sum : 0 });
}
