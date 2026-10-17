import "server-only";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { can, db, dbErrorMessage } from "@/lib/admin/products/access";
import { imageUrl } from "@/lib/admin/products/data";
import {
  changedFields,
  fail,
  INVALID_INPUT,
  NO_PERMISSION,
  NOT_FOUND,
  ok,
  zodFieldErrors,
  type AdminResult,
} from "@/lib/admin/products/result";
import { revalidateCatalog } from "@/lib/admin/products/revalidate";
import { handleChangeRedirect, handleError, slugifyHandle } from "@/lib/admin/products/rules";
import { sanitizeHtml } from "@/lib/admin/products/sanitize";
import type { Database } from "@/lib/supabase/database.types";
import {
  collectionInputSchema,
  collectionProductsSchema,
  computeMembership,
  diffMembership,
  parseStoredRules,
  type CollectionInput,
  type CollectionRule,
  type ProductFacts,
  type SortKey,
} from "./rules";

/**
 * Kollektionen im Backoffice: CRUD mit Übersetzungen, manuelle Zuordnung mit Position,
 * regelbasierte Zuordnung (applyCollectionRules), Veröffentlichen, Revalidation.
 */

type PublishStatus = Database["public"]["Enums"]["publish_status"];

export interface CollectionListItem {
  id: string;
  handle: string;
  title: string;
  kind: "manual" | "automatic";
  status: PublishStatus;
  sortKey: string;
  productCount: number;
  rulesCount: number;
  position: number;
  imageUrl: string | null;
  updatedAt: string;
}

export async function listCollections(locale = "de"): Promise<CollectionListItem[]> {
  const { data, error } = await db()
    .from("collections")
    .select(
      "id, handle, kind, status, sort_key, rules, position, image_path, updated_at, collection_translations (locale, title), collection_products (product_id)",
    )
    .order("position");
  if (error) throw new Error(`Kollektionen: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    handle: c.handle,
    title:
      c.collection_translations.find((t) => t.locale === locale)?.title ??
      c.collection_translations[0]?.title ??
      c.handle,
    kind: c.kind === "automatic" ? "automatic" : "manual",
    status: c.status,
    sortKey: c.sort_key,
    productCount: c.collection_products.length,
    rulesCount: parseStoredRules(c.rules).length,
    position: c.position,
    imageUrl: c.image_path ? imageUrl("product-media", c.image_path) : null,
    updatedAt: c.updated_at,
  }));
}

export interface CollectionEditData {
  collection: {
    id: string;
    handle: string;
    kind: "manual" | "automatic";
    status: PublishStatus;
    sortKey: string;
    rules: CollectionRule[];
    imagePath: string | null;
    imageUrl: string | null;
    position: number;
    createdAt: string;
    updatedAt: string;
  };
  translations: {
    locale: string;
    title: string;
    descriptionHtml: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
  products: {
    id: string;
    handle: string;
    title: string;
    status: string;
    position: number;
    imageUrl: string | null;
  }[];
  formInput: CollectionInput;
}

export async function getCollectionForEdit(
  id: string,
  locale = "de",
): Promise<CollectionEditData | null> {
  const client = db();
  const { data: c, error } = await client
    .from("collections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Kollektion: ${error.message}`);
  if (!c) return null;
  const [translations, members] = await Promise.all([
    client.from("collection_translations").select("*").eq("collection_id", id),
    client
      .from("collection_products")
      .select(
        "position, products (id, handle, status, product_translations (locale, title), product_images (storage_bucket, storage_path, position))",
      )
      .eq("collection_id", id)
      .order("position"),
  ]);
  const tr = (translations.data ?? []).map((t) => ({
    locale: t.locale,
    title: t.title,
    descriptionHtml: t.description_html,
    seoTitle: t.seo_title,
    seoDescription: t.seo_description,
  }));
  const t = tr.find((x) => x.locale === locale) ?? null;
  const rules = parseStoredRules(c.rules);
  const products = (members.data ?? []).flatMap((m) => {
    const p = m.products as unknown as {
      id: string;
      handle: string;
      status: string;
      product_translations: { locale: string; title: string }[];
      product_images: { storage_bucket: string; storage_path: string; position: number }[];
    } | null;
    if (!p) return [];
    const img = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    return [
      {
        id: p.id,
        handle: p.handle,
        title: p.product_translations.find((x) => x.locale === locale)?.title ?? p.handle,
        status: p.status,
        position: m.position,
        imageUrl: img ? imageUrl(img.storage_bucket, img.storage_path) : null,
      },
    ];
  });
  const kind = c.kind === "automatic" ? "automatic" : "manual";
  return {
    collection: {
      id: c.id,
      handle: c.handle,
      kind,
      status: c.status,
      sortKey: c.sort_key,
      rules,
      imagePath: c.image_path,
      imageUrl: c.image_path ? imageUrl("product-media", c.image_path) : null,
      position: c.position,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    },
    translations: tr,
    products,
    formInput: {
      id: c.id,
      locale,
      title: t?.title ?? c.handle,
      handle: c.handle,
      descriptionHtml: t?.descriptionHtml ?? null,
      seoTitle: t?.seoTitle ?? null,
      seoDescription: t?.seoDescription ?? null,
      kind,
      rules,
      // regelbasierte Kollektionen brauchen eine automatische Sortierung (Seed "all" steht auf manual)
      sortKey: (kind === "automatic" && c.sort_key === "manual"
        ? "title-asc"
        : c.sort_key) as SortKey,
      status: c.status,
      imagePath: c.image_path,
      position: c.position,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Schreiben                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export async function saveCollection(
  input: CollectionInput,
  actor: StaffSession,
): Promise<AdminResult<{ id: string; handle: string; productCount: number | null }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = collectionInputSchema.safeParse(input);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const c = parsed.data;
  const handle = c.handle ? c.handle : slugifyHandle(c.title);
  const hErr = handleError(handle);
  if (hErr) return fail(INVALID_INPUT, { handle: hErr });

  const client = db();
  const existing = c.id
    ? (await client.from("collections").select("*").eq("id", c.id).maybeSingle()).data
    : null;
  if (c.id && !existing) return fail(NOT_FOUND);

  const { data: clash } = await client
    .from("collections")
    .select("id")
    .eq("handle", handle)
    .neq("id", c.id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  if (clash) return fail(INVALID_INPUT, { handle: "Dieser Handle ist schon vergeben." });

  const row = {
    handle,
    kind: c.kind,
    rules: c.kind === "automatic" ? (c.rules as never) : ([] as never),
    sort_key: c.sortKey,
    status: c.status,
    image_path: c.imagePath,
    ...(c.position != null ? { position: c.position } : {}),
  };

  let id = c.id ?? "";
  if (existing) {
    const { error } = await client.from("collections").update(row).eq("id", existing.id);
    if (error) return fail(dbErrorMessage(error));
  } else {
    const { data, error } = await client.from("collections").insert(row).select("id").single();
    if (error || !data) return fail(dbErrorMessage(error));
    id = data.id;
  }

  const translation = {
    collection_id: id,
    locale: c.locale,
    title: c.title,
    description_html: sanitizeHtml(c.descriptionHtml, "rich") || null,
    seo_title: c.seoTitle,
    seo_description: c.seoDescription,
  };
  const { data: prevT } = await client
    .from("collection_translations")
    .select("*")
    .eq("collection_id", id)
    .eq("locale", c.locale)
    .maybeSingle();
  const { error: tErr } = await client
    .from("collection_translations")
    .upsert(translation, { onConflict: "collection_id,locale" });
  if (tErr) return fail(dbErrorMessage(tErr));

  const warnings: string[] = [];
  const redirect = handleChangeRedirect(
    existing?.handle,
    handle,
    existing?.status === "published",
    "/collections",
  );
  if (redirect) {
    await upsertRedirect(redirect.fromPath, redirect.toPath, `Kollektion umbenannt (${id})`);
    warnings.push(`Alter Pfad ${redirect.fromPath} leitet jetzt auf ${redirect.toPath} weiter.`);
  }

  let productCount: number | null = null;
  if (c.kind === "automatic") {
    const applied = await applyRulesInternal(id);
    productCount = applied.total;
  } else if (existing?.kind === "automatic") {
    warnings.push("Die bisherige Zuordnung aus den Regeln bleibt als manuelle Liste erhalten.");
  }

  const diff = changedFields(existing ? { ...existing, ...(prevT ?? {}) } : null, {
    ...row,
    title: translation.title,
    description_html: translation.description_html,
    seo_title: translation.seo_title,
    seo_description: translation.seo_description,
  });
  await writeAudit(actor, {
    action: existing ? "collection.update" : "collection.create",
    entityType: "collection",
    entityId: id,
    before: diff?.before ?? null,
    after: diff?.after ?? null,
  });

  revalidateCatalog({ collectionHandles: [handle, ...(existing ? [existing.handle] : [])] });
  return ok({ id, handle, productCount }, warnings);
}

export async function upsertRedirect(
  fromPath: string,
  toPath: string,
  note: string,
): Promise<void> {
  const client = db();
  // Ketten vermeiden: alte Weiterleitungen auf den bisherigen Pfad zeigen jetzt direkt aufs Ziel
  await client.from("redirects").update({ to_path: toPath }).eq("to_path", fromPath);
  // Eine Weiterleitung vom neuen Pfad weg würde eine Schleife bilden
  await client.from("redirects").update({ is_enabled: false }).eq("from_path", toPath);
  await client
    .from("redirects")
    .upsert(
      { from_path: fromPath, to_path: toPath, status_code: 301, is_enabled: true, note },
      { onConflict: "from_path" },
    );
}

/**
 * Manuelle Zuordnung mit Position (Reihenfolge der Liste). Erst neue Positionen schreiben,
 * dann Überzählige löschen: die Kollektion ist nie zwischendurch leer.
 */
export async function setCollectionProducts(
  collectionId: string,
  productIds: string[],
  actor: StaffSession,
): Promise<AdminResult<{ total: number; added: number; removed: number }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = collectionProductsSchema.safeParse(productIds);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const ids = [...new Set(parsed.data)];
  const client = db();
  const { data: c } = await client
    .from("collections")
    .select("id, handle, kind")
    .eq("id", collectionId)
    .maybeSingle();
  if (!c) return fail(NOT_FOUND);
  if (c.kind === "automatic")
    return fail(
      "Diese Kollektion ist regelbasiert. Ändere die Bedingungen statt der Produktliste.",
    );

  if (ids.length) {
    const { data: found } = await client.from("products").select("id").in("id", ids);
    if ((found ?? []).length !== ids.length)
      return fail(INVALID_INPUT, { productIds: "Mindestens ein Produkt gibt es nicht mehr." });
  }
  const result = await replaceMembers(collectionId, ids);
  if (!result.ok) return result;
  await writeAudit(actor, {
    action: "collection.products.update",
    entityType: "collection",
    entityId: collectionId,
    before: { productIds: result.data.before },
    after: { productIds: ids },
  });
  revalidateCatalog({ collectionHandles: [c.handle], allProducts: false });
  return ok({ total: ids.length, added: result.data.added, removed: result.data.removed });
}

async function replaceMembers(
  collectionId: string,
  ids: string[],
): Promise<AdminResult<{ before: string[]; added: number; removed: number; reordered: boolean }>> {
  const client = db();
  const { data: current } = await client
    .from("collection_products")
    .select("product_id, position")
    .eq("collection_id", collectionId)
    .order("position");
  const before = (current ?? []).map((r) => r.product_id);
  const diff = diffMembership(before, ids);
  if (ids.length && (diff.added.length || diff.reordered || before.length !== ids.length)) {
    const { error } = await client.from("collection_products").upsert(
      ids.map((product_id, position) => ({ collection_id: collectionId, product_id, position })),
      { onConflict: "collection_id,product_id" },
    );
    if (error) return fail(dbErrorMessage(error));
  }
  if (diff.removed.length) {
    const { error } = await client
      .from("collection_products")
      .delete()
      .eq("collection_id", collectionId)
      .in("product_id", diff.removed);
    if (error) return fail(dbErrorMessage(error));
  }
  return ok({
    before,
    added: diff.added.length,
    removed: diff.removed.length,
    reordered: diff.reordered,
  });
}

/** Fakten aller Produkte für die Regelauswertung. */
export async function loadProductFacts(): Promise<ProductFacts[]> {
  const { data, error } = await db()
    .from("products")
    .select(
      "id, handle, tags, product_type, vendor, status, kind, is_food, created_at, position, product_translations (locale, title), product_variants (price_cents, is_active)",
    );
  if (error) throw new Error(`Produkte: ${error.message}`);
  return (data ?? []).map((p) => {
    const prices = p.product_variants.filter((v) => v.is_active).map((v) => v.price_cents);
    return {
      id: p.id,
      handle: p.handle,
      title: p.product_translations.find((t) => t.locale === "de")?.title ?? p.handle,
      tags: p.tags,
      productType: p.product_type,
      vendor: p.vendor,
      status: p.status,
      kind: p.kind,
      isFood: p.is_food,
      priceCents: prices.length ? Math.min(...prices) : null,
      createdAt: p.created_at,
      position: p.position,
    };
  });
}

async function applyRulesInternal(
  collectionId: string,
  facts?: ProductFacts[],
): Promise<{ handle: string; total: number; added: number; removed: number; changed: boolean }> {
  const client = db();
  const { data: c } = await client
    .from("collections")
    .select("id, handle, kind, rules, sort_key")
    .eq("id", collectionId)
    .maybeSingle();
  if (!c || c.kind !== "automatic") throw new Error("Keine regelbasierte Kollektion");
  const rules = parseStoredRules(c.rules);
  const sortKey = (c.sort_key === "manual" ? "title-asc" : c.sort_key) as SortKey;
  const ids = computeMembership(facts ?? (await loadProductFacts()), rules, sortKey);
  const res = await replaceMembers(collectionId, ids);
  if (!res.ok) throw new Error(res.error);
  return {
    handle: c.handle,
    total: ids.length,
    added: res.data.added,
    removed: res.data.removed,
    changed: res.data.added > 0 || res.data.removed > 0 || res.data.reordered,
  };
}

/**
 * Zuordnung einer regelbasierten Kollektion neu berechnen und speichern.
 * Ohne actor (Aufruf nach einer Produktänderung) wird nur bei Änderungen protokolliert.
 */
export async function applyCollectionRules(
  collectionId: string,
  actor?: StaffSession,
): Promise<AdminResult<{ total: number; added: number; removed: number }>> {
  if (actor && !can(actor, "editProducts")) return fail(NO_PERMISSION);
  try {
    const r = await applyRulesInternal(collectionId);
    if (r.changed || actor) {
      await writeAudit(actor ?? null, {
        action: "collection.rules.apply",
        entityType: "collection",
        entityId: collectionId,
        after: { total: r.total, added: r.added, removed: r.removed },
      });
    }
    if (r.changed) revalidateCatalog({ collectionHandles: [r.handle] });
    return ok({ total: r.total, added: r.added, removed: r.removed });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Regeln konnten nicht angewendet werden.");
  }
}

/** Alle regelbasierten Kollektionen neu berechnen (nach Produkt- oder Preisänderungen). */
export async function applyAutomaticCollections(
  actor: StaffSession | null,
): Promise<{ changedHandles: string[] }> {
  const { data } = await db().from("collections").select("id").eq("kind", "automatic");
  if (!data?.length) return { changedHandles: [] };
  const facts = await loadProductFacts();
  const changed: string[] = [];
  for (const c of data) {
    try {
      const r = await applyRulesInternal(c.id, facts);
      if (r.changed) {
        changed.push(r.handle);
        await writeAudit(actor, {
          action: "collection.rules.apply",
          entityType: "collection",
          entityId: c.id,
          after: { total: r.total, added: r.added, removed: r.removed },
        });
      }
    } catch (e) {
      console.error("applyAutomaticCollections:", e instanceof Error ? e.message : e);
    }
  }
  return { changedHandles: changed };
}

export async function publishCollection(
  collectionId: string,
  publish: boolean,
  actor: StaffSession,
): Promise<AdminResult<{ status: PublishStatus }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: c } = await client
    .from("collections")
    .select("id, handle, status")
    .eq("id", collectionId)
    .maybeSingle();
  if (!c) return fail(NOT_FOUND);
  const status: PublishStatus = publish ? "published" : "draft";
  if (c.status === status) return ok({ status });
  if (publish) {
    const { data: t } = await client
      .from("collection_translations")
      .select("title")
      .eq("collection_id", collectionId)
      .eq("locale", "de")
      .maybeSingle();
    if (!t?.title)
      return fail("Vor dem Veröffentlichen braucht die Kollektion einen deutschen Titel.");
  }
  const { error } = await client.from("collections").update({ status }).eq("id", collectionId);
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: publish ? "collection.publish" : "collection.unpublish",
    entityType: "collection",
    entityId: collectionId,
    before: { status: c.status },
    after: { status },
  });
  revalidateCatalog({ collectionHandles: [c.handle] });
  const warnings =
    !publish && c.status === "published"
      ? [
          `/collections/${c.handle} ist jetzt nicht mehr erreichbar. Lege bei Bedarf eine Weiterleitung an.`,
        ]
      : [];
  return ok({ status }, warnings);
}

/** Löschen nur für nie veröffentlichte oder archivierte Kollektionen (alte Pfade bleiben erhalten). */
export async function deleteCollection(
  collectionId: string,
  actor: StaffSession,
): Promise<AdminResult<{ id: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: c } = await client
    .from("collections")
    .select("id, handle, status, shopify_collection_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (!c) return fail(NOT_FOUND);
  if (c.status === "published")
    return fail("Veröffentlichte Kollektionen kannst du nicht löschen. Archiviere sie zuerst.");
  if (c.shopify_collection_id)
    return fail(
      "Diese Kollektion stammt aus Shopify, ihr Pfad muss erhalten bleiben. Archiviere sie statt sie zu löschen.",
    );
  const { error } = await client.from("collections").delete().eq("id", collectionId);
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: "collection.delete",
    entityType: "collection",
    entityId: collectionId,
    before: { handle: c.handle, status: c.status },
  });
  revalidateCatalog({ collectionHandles: [c.handle] });
  return ok({ id: collectionId });
}
