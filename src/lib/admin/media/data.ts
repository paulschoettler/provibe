import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { StaffSession } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/admin/audit";
import { can, db, dbErrorMessage } from "@/lib/admin/products/access";
import {
  fail,
  INVALID_INPUT,
  NO_PERMISSION,
  NOT_FOUND,
  ok,
  zodFieldErrors,
  type AdminResult,
} from "@/lib/admin/products/result";
import { revalidateCatalog } from "@/lib/admin/products/revalidate";
import { publicEnv } from "@/lib/env/public";
import type { Json } from "@/lib/supabase/database.types";
import {
  altSchema,
  altTextFor,
  buildPublicImageUrl,
  checkImage,
  IMAGE_TYPES,
  imageOrderSchema,
  imageStoragePath,
  isRemovableUploadPath,
  MAX_IMAGE_BYTES,
  orderError,
  PENDING_PREFIX,
  pendingUploadPath,
  PRODUCT_MEDIA_BUCKET,
} from "./rules";

/**
 * Produktbilder im Bucket product-media (öffentlich lesbar, Schreiben nur Service-Role).
 *
 * Zwei Wege zum Upload:
 * 1. uploadProductImage: Datei liegt schon auf dem Server (Route Handler mit FormData).
 *    Achtung: Server Actions sind auf 2 MB begrenzt (next.config.ts, bodySizeLimit).
 * 2. createImageUploadUrl + finalizeImageUpload: Der Browser lädt per signierter URL direkt in
 *    uploads/<handle>/ hoch, der Server prüft danach Inhalt, Typ und Größe, legt die Datei unter
 *    products/<handle>/<handle>-<hash>.<ext> ab und löscht die Zwischendatei.
 */

export function getPublicImageUrl(path: string, bucket: string = PRODUCT_MEDIA_BUCKET): string {
  return buildPublicImageUrl(publicEnv.supabaseUrl, bucket, path);
}

export interface StoredImage {
  id: string;
  url: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  position: number;
  alt: string;
}

interface ProductRef {
  id: string;
  handle: string;
  title: string;
}

async function loadProduct(productId: string): Promise<ProductRef | null> {
  const { data } = await db()
    .from("products")
    .select("id, handle, product_translations (locale, title)")
    .eq("id", productId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    handle: data.handle,
    title: data.product_translations.find((t) => t.locale === "de")?.title ?? data.handle,
  };
}

function toBytes(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

async function storeImage(
  product: ProductRef,
  bytes: Uint8Array,
  declaredType: string | null | undefined,
  opts: { alt?: string | null; variantId?: string | null },
  actor: StaffSession,
): Promise<AdminResult<StoredImage>> {
  const checked = checkImage(bytes, declaredType);
  if (!checked.ok) return fail(checked.error, { file: checked.error });
  const altParsed = altSchema.safeParse(opts.alt ?? "");
  if (!altParsed.success) return fail(INVALID_INPUT, { alt: altParsed.error.issues[0].message });

  const client = db();
  if (opts.variantId) {
    const { data: v } = await client
      .from("product_variants")
      .select("id")
      .eq("id", opts.variantId)
      .eq("product_id", product.id)
      .maybeSingle();
    if (!v) return fail(INVALID_INPUT, { variantId: "Diese Variante gehört nicht zum Produkt." });
  }

  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = imageStoragePath(product.handle, hash, checked.image.extension);

  const { data: dupe } = await client
    .from("product_images")
    .select("id")
    .eq("product_id", product.id)
    .eq("storage_path", path)
    .maybeSingle();
  if (dupe)
    return fail("Dieses Bild ist beim Produkt schon vorhanden.", { file: "Doppeltes Bild." });

  const { error: upErr } = await client.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, bytes, {
    contentType: checked.image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  // Gleicher Pfad heißt gleicher Inhalt (Hash): eine vorhandene Datei weiterverwenden
  if (upErr && !/exist|duplicate/i.test(upErr.message)) {
    console.error("product-media upload:", upErr.message);
    return fail("Das Bild konnte nicht gespeichert werden. Bitte versuche es noch einmal.");
  }

  const { data: last } = await client
    .from("product_images")
    .select("position")
    .eq("product_id", product.id)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? -1) + 1;
  const alt = altTextFor(altParsed.data, product.title, position + 1);

  const { data: row, error } = await client
    .from("product_images")
    .insert({
      product_id: product.id,
      variant_id: opts.variantId ?? null,
      storage_bucket: PRODUCT_MEDIA_BUCKET,
      storage_path: path,
      width: checked.image.width,
      height: checked.image.height,
      alt: { de: alt },
      position,
    })
    .select("id")
    .single();
  if (error || !row) return fail(dbErrorMessage(error));

  await writeAudit(actor, {
    action: "product.image.create",
    entityType: "product",
    entityId: product.id,
    after: { image_id: row.id, storage_path: path, position, alt },
  });
  revalidateCatalog({ productHandles: [product.handle], allCollections: true });

  const warnings = altParsed.data
    ? []
    : ["Kein Alt-Text angegeben, es wurde ein Standardtext gesetzt."];
  return ok(
    {
      id: row.id,
      url: getPublicImageUrl(path),
      storagePath: path,
      width: checked.image.width,
      height: checked.image.height,
      position,
      alt,
    },
    warnings,
  );
}

/** Upload aus Server-Code (Route Handler). file.bytes ist der komplette Dateiinhalt. */
export async function uploadProductImage(
  productId: string,
  file: { bytes: Uint8Array | ArrayBuffer; fileName: string; contentType?: string | null },
  opts: { alt?: string | null; variantId?: string | null },
  actor: StaffSession,
): Promise<AdminResult<StoredImage>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const product = await loadProduct(productId);
  if (!product) return fail(NOT_FOUND);
  return storeImage(product, toBytes(file.bytes), file.contentType, opts, actor);
}

/** Signierte Upload-URL für den direkten Browser-Upload (Dateien über 2 MB). */
export async function createImageUploadUrl(
  productId: string,
  file: { fileName: string; contentType: string; size: number },
  actor: StaffSession,
): Promise<AdminResult<{ path: string; token: string; signedUrl: string; bucket: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  if (!(file.contentType in IMAGE_TYPES))
    return fail("Erlaubt sind JPEG, PNG, WebP und AVIF.", { file: "Dateityp nicht erlaubt." });
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES)
    return fail("Die Datei ist größer als 10 MB. Bitte verkleinere das Bild.", {
      file: "Zu groß.",
    });
  const product = await loadProduct(productId);
  if (!product) return fail(NOT_FOUND);

  const path = pendingUploadPath(product.handle, randomUUID(), file.fileName);
  const { data, error } = await db().storage.from(PRODUCT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl:", error?.message);
    return fail("Der Upload konnte nicht vorbereitet werden.");
  }
  return ok({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    bucket: PRODUCT_MEDIA_BUCKET,
  });
}

/** Nach dem Browser-Upload: prüfen, endgültig ablegen, Zwischendatei löschen. */
export async function finalizeImageUpload(
  productId: string,
  pendingPath: string,
  opts: { alt?: string | null; variantId?: string | null },
  actor: StaffSession,
): Promise<AdminResult<StoredImage>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const product = await loadProduct(productId);
  if (!product) return fail(NOT_FOUND);
  if (!pendingPath.startsWith(`${PENDING_PREFIX}/${product.handle}/`) || pendingPath.includes(".."))
    return fail("Ungültiger Upload-Pfad.");

  const bucket = db().storage.from(PRODUCT_MEDIA_BUCKET);
  const { data: blob, error } = await bucket.download(pendingPath);
  if (error || !blob)
    return fail("Die hochgeladene Datei wurde nicht gefunden. Bitte lade sie erneut hoch.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = await storeImage(product, bytes, null, opts, actor);
  await bucket.remove([pendingPath]);
  return result;
}

export async function updateImage(
  imageId: string,
  patch: { alt?: string; locale?: string; variantId?: string | null },
  actor: StaffSession,
): Promise<AdminResult<{ id: string }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: img } = await client
    .from("product_images")
    .select(
      "id, product_id, alt, variant_id, products (handle, product_translations (locale, title))",
    )
    .eq("id", imageId)
    .maybeSingle();
  if (!img) return fail(NOT_FOUND);
  const prod = img.products as unknown as {
    handle: string;
    product_translations: { locale: string; title: string }[];
  };

  const update: { alt?: Json; variant_id?: string | null } = {};
  if (patch.alt !== undefined) {
    const parsed = altSchema.min(1, "Bitte gib einen Alt-Text ein.").safeParse(patch.alt);
    if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
    const locale = patch.locale && /^[a-z]{2}$/.test(patch.locale) ? patch.locale : "de";
    const current =
      img.alt && typeof img.alt === "object" && !Array.isArray(img.alt) ? img.alt : {};
    update.alt = { ...current, [locale]: parsed.data };
  }
  if (patch.variantId !== undefined) {
    if (patch.variantId) {
      const { data: v } = await client
        .from("product_variants")
        .select("id")
        .eq("id", patch.variantId)
        .eq("product_id", img.product_id)
        .maybeSingle();
      if (!v) return fail(INVALID_INPUT, { variantId: "Diese Variante gehört nicht zum Produkt." });
    }
    update.variant_id = patch.variantId;
  }
  if (!Object.keys(update).length) return ok({ id: imageId });

  const { error } = await client.from("product_images").update(update).eq("id", imageId);
  if (error) return fail(dbErrorMessage(error));
  await writeAudit(actor, {
    action: "product.image.update",
    entityType: "product",
    entityId: img.product_id,
    before: { image_id: imageId, alt: img.alt, variant_id: img.variant_id },
    after: { image_id: imageId, ...update },
  });
  revalidateCatalog({ productHandles: [prod.handle], allCollections: true });
  return ok({ id: imageId });
}

/** Reihenfolge setzen: die Liste enthält alle Bild-IDs des Produkts in neuer Reihenfolge. */
export async function reorderImages(
  productId: string,
  orderedIds: string[],
  actor: StaffSession,
): Promise<AdminResult<{ count: number }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const parsed = imageOrderSchema.safeParse(orderedIds);
  if (!parsed.success) return fail(INVALID_INPUT, zodFieldErrors(parsed.error));
  const product = await loadProduct(productId);
  if (!product) return fail(NOT_FOUND);
  const client = db();
  const { data: current } = await client
    .from("product_images")
    .select("id, position")
    .eq("product_id", productId)
    .order("position");
  const currentIds = (current ?? []).map((r) => r.id);
  const err = orderError(currentIds, parsed.data);
  if (err) return fail(err);
  const positions = new Map((current ?? []).map((r) => [r.id, r.position]));
  for (const [position, id] of parsed.data.entries()) {
    if (positions.get(id) === position) continue;
    const { error } = await client.from("product_images").update({ position }).eq("id", id);
    if (error) return fail(dbErrorMessage(error));
  }
  await writeAudit(actor, {
    action: "product.image.reorder",
    entityType: "product",
    entityId: productId,
    before: { order: currentIds },
    after: { order: parsed.data },
  });
  revalidateCatalog({ productHandles: [product.handle], allCollections: true });
  return ok({ count: parsed.data.length });
}

/**
 * Bild löschen. Die Datei im Bucket wird nur entfernt, wenn sie unter products/ liegt (eigener
 * Upload, nie seed/) und kein anderes Bild (zum Beispiel einer Produktkopie) sie noch nutzt.
 */
export async function deleteImage(
  imageId: string,
  actor: StaffSession,
): Promise<AdminResult<{ fileRemoved: boolean }>> {
  if (!can(actor, "editProducts")) return fail(NO_PERMISSION);
  const client = db();
  const { data: img } = await client
    .from("product_images")
    .select("id, product_id, storage_bucket, storage_path, position, products (handle)")
    .eq("id", imageId)
    .maybeSingle();
  if (!img) return fail(NOT_FOUND);
  const handle = (img.products as unknown as { handle: string }).handle;

  const { error } = await client.from("product_images").delete().eq("id", imageId);
  if (error) return fail(dbErrorMessage(error));

  // Positionen ohne Lücke
  const { data: rest } = await client
    .from("product_images")
    .select("id, position")
    .eq("product_id", img.product_id)
    .order("position");
  for (const [position, r] of (rest ?? []).entries()) {
    if (r.position !== position)
      await client.from("product_images").update({ position }).eq("id", r.id);
  }

  let fileRemoved = false;
  if (img.storage_bucket === PRODUCT_MEDIA_BUCKET && isRemovableUploadPath(img.storage_path)) {
    const { count } = await client
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("storage_bucket", img.storage_bucket)
      .eq("storage_path", img.storage_path);
    if (!count) {
      const { error: rmErr } = await client.storage
        .from(img.storage_bucket)
        .remove([img.storage_path]);
      fileRemoved = !rmErr;
      if (rmErr) console.error("product-media remove:", rmErr.message);
    }
  }

  await writeAudit(actor, {
    action: "product.image.delete",
    entityType: "product",
    entityId: img.product_id,
    before: { image_id: imageId, storage_path: img.storage_path, position: img.position },
    after: { file_removed: fileRemoved },
  });
  revalidateCatalog({ productHandles: [handle], allCollections: true });
  return ok({ fileRemoved });
}
