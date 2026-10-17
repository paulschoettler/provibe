"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import {
  createImageUploadUrl,
  deleteImage,
  finalizeImageUpload,
  reorderImages,
  updateImage,
  uploadProductImage,
} from "@/lib/admin/media/data";
import {
  actionError,
  actionOk,
  formDataToObject,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { db } from "./access";
import { isProductHandleFree } from "./data";
import { flattenFormValues, mapComponentErrors, parseProductForm, str } from "./form";
import { INVALID_INPUT, NO_PERMISSION, type FieldErrors } from "./result";
import { handleError } from "./rules";
import {
  archiveProduct,
  duplicateProduct,
  moveProduct,
  removeVariant,
  reorderProducts,
  saveProduct,
  saveVariants,
  setBundleComponents,
  setProductsStatus,
} from "./write";

/**
 * Server Actions der Seiten /admin/produkte, /admin/produkte/[id] und /neu. Jede Action prüft
 * Sitzung und Recht (editProducts: Owner und Admin) selbst; die Regeln, Zod-Prüfungen, das
 * Protokoll und die Revalidierung der Storefront liegen in write.ts und media/data.ts.
 */

const LIST = "/admin/produkte";
const uuid = z.guid();

async function editor(next = LIST): Promise<StaffSession | null> {
  const session = await requireStaff("support", { next });
  return PERMISSIONS.editProducts(session) ? session : null;
}

function detailPath(id: string) {
  return `${LIST}/${id}`;
}

function summarize(warnings: string[]): string | undefined {
  const unique = [...new Set(warnings)];
  if (!unique.length) return undefined;
  const weight = unique.filter((w) => w.includes("hat kein Gewicht"));
  const rest = unique.filter((w) => !w.includes("hat kein Gewicht"));
  if (weight.length > 1)
    rest.push(`${weight.length} Varianten haben kein Gewicht, DHL-Labels brauchen es.`);
  else rest.push(...weight);
  return rest.join(" ");
}

/* ------------------------------------------------------------------------------------------ */
/* Editor speichern                                                                            */
/* ------------------------------------------------------------------------------------------ */

export async function saveProductFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const obj = formDataToObject(formData);
  const productId = str(obj, "id");
  const session = await editor(productId ? detailPath(productId) : `${LIST}/neu`);
  if (!session) return actionError(NO_PERMISSION);
  const values = flattenFormValues(obj);
  if (productId && !uuid.safeParse(productId).success) return actionError(INVALID_INPUT);

  let optionName: string | null = null;
  let variantCount = 0;
  if (productId) {
    const [{ data: opts }, { count }] = await Promise.all([
      db()
        .from("product_options")
        .select("name")
        .eq("product_id", productId)
        .order("position")
        .limit(1),
      db()
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId),
    ]);
    optionName = opts?.[0]?.name ?? null;
    variantCount = count ?? 0;
  }

  const parsed = parseProductForm(obj, { optionName, variantCount });
  if (Object.keys(parsed.errors).length)
    return actionError(INVALID_INPUT, { fieldErrors: parsed.errors, values });

  /* Neues Produkt: als Entwurf anlegen, dann die erste Variante */
  if (!productId) {
    // neue Produkte ans Ende der Reihenfolge, sofern keine Position angegeben ist
    let position = parsed.product.position;
    if (position == null) {
      const { data: last } = await db()
        .from("products")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      position = (last?.[0]?.position ?? -1) + 1;
    }
    const created = await saveProduct({ ...parsed.product, status: "draft", position }, session);
    if (!created.ok)
      return actionError(created.error, { fieldErrors: created.fieldErrors, values });
    let note = "";
    if (parsed.variants.length) {
      const v = await saveVariants(created.data.id, parsed.variants, session);
      if (!v.ok) note = " Die Variante konnte nicht angelegt werden, bitte im Editor prüfen.";
    }
    await flashToast(`Produkt als Entwurf angelegt.${note}`, note ? "error" : "success");
    revalidatePath(LIST);
    redirect(detailPath(created.data.id) as Route);
  }

  const warnings: string[] = [];
  const fieldErrors: FieldErrors = {};

  /* Varianten zuerst, damit "Aktiv" die neuen Preise schon sieht */
  if (parsed.variants.length) {
    const v = await saveVariants(productId, parsed.variants, session);
    if (!v.ok) return actionError(v.error, { fieldErrors: v.fieldErrors, values });
    warnings.push(...v.warnings);
  }

  /* Bundle-Komponenten: nur geänderte schreiben */
  for (const c of parsed.components) {
    const { data: current } = await db()
      .from("bundle_components")
      .select("component_variant_id, quantity")
      .eq("bundle_variant_id", c.bundleVariantId);
    const key = (rows: { id: string; q: number }[]) =>
      rows
        .map((r) => `${r.id}:${r.q}`)
        .sort()
        .join("|");
    const before = key((current ?? []).map((r) => ({ id: r.component_variant_id, q: r.quantity })));
    const after = key(c.items.map((r) => ({ id: r.componentVariantId, q: r.quantity })));
    if (before === after) continue;
    const r = await setBundleComponents(c.bundleVariantId, c.items, session);
    if (!r.ok) {
      const mapped = mapComponentErrors(c.bundleVariantId, r.fieldErrors);
      Object.assign(
        fieldErrors,
        Object.keys(mapped).length ? mapped : { [`components.${c.bundleVariantId}`]: r.error },
      );
    }
  }

  /* Alt-Texte */
  for (const img of parsed.imageAlts) {
    const r = await updateImage(img.id, { alt: img.alt }, session);
    if (!r.ok) fieldErrors[`images.${img.id}.alt`] = Object.values(r.fieldErrors)[0] ?? r.error;
  }

  const saved = await saveProduct(parsed.product, session);
  revalidatePath(LIST);
  revalidatePath(detailPath(productId));
  if (!saved.ok) {
    return actionError(
      `${saved.error}${parsed.variants.length ? " Die Varianten sind gespeichert." : ""}`,
      { fieldErrors: { ...fieldErrors, ...saved.fieldErrors }, values },
    );
  }
  if (Object.keys(fieldErrors).length) {
    return actionError("Produkt gespeichert, aber nicht alles ließ sich übernehmen.", {
      fieldErrors,
      values,
    });
  }
  warnings.push(...saved.warnings);
  await flashToast("Produkt gespeichert");
  return actionOk(summarize(warnings));
}

/** Handle-Prüfung beim Tippen (Format und Eindeutigkeit). */
export async function checkProductHandleAction(
  handle: string,
  exceptId?: string,
): Promise<{ ok: boolean; message: string }> {
  await requireStaff("support", { next: LIST });
  const h = String(handle ?? "")
    .trim()
    .toLowerCase();
  const err = handleError(h);
  if (err) return { ok: false, message: err };
  const free = await isProductHandleFree(
    h,
    exceptId && uuid.safeParse(exceptId).success ? exceptId : undefined,
  );
  return free
    ? { ok: true, message: `Frei: /products/${h}` }
    : { ok: false, message: "Dieser Handle ist schon vergeben." };
}

/* ------------------------------------------------------------------------------------------ */
/* Duplizieren, Archivieren, Varianten entfernen                                               */
/* ------------------------------------------------------------------------------------------ */

export async function duplicateProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("productId") ?? "");
  const session = await editor(detailPath(id));
  if (!session || !uuid.safeParse(id).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  const r = await duplicateProduct(id, session);
  if (!r.ok) {
    await flashToast(r.error, "error");
    return;
  }
  await flashToast(`Kopie angelegt: ${r.warnings[0] ?? "Entwurf"}`);
  revalidatePath(LIST);
  redirect(detailPath(r.data.id) as Route);
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("productId") ?? "");
  const session = await editor(detailPath(id));
  if (!session || !uuid.safeParse(id).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  const r = await archiveProduct(id, session);
  await flashToast(
    r.ok ? (summarize(["Produkt archiviert.", ...r.warnings]) ?? "") : r.error,
    r.ok ? "success" : "error",
  );
  revalidatePath(LIST);
  revalidatePath(detailPath(id));
}

export async function removeVariantAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const session = await editor(detailPath(productId));
  if (!session || !uuid.safeParse(variantId).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  const r = await removeVariant(variantId, session);
  if (!r.ok) await flashToast(r.error, "error");
  else
    await flashToast(
      r.data.deleted ? "Variante gelöscht" : (r.warnings[0] ?? "Variante deaktiviert"),
    );
  revalidatePath(detailPath(productId));
  revalidatePath(LIST);
}

/* ------------------------------------------------------------------------------------------ */
/* Liste: Sammelaktion, Reihenfolge                                                            */
/* ------------------------------------------------------------------------------------------ */

export async function setProductsStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await editor();
  if (!session) return actionError(NO_PERMISSION);
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "draft") return actionError(INVALID_INPUT);
  const ids = [...new Set(formData.getAll("ids").map(String))];
  if (!ids.length) return actionError("Bitte wähle mindestens ein Produkt.");
  const r = await setProductsStatus(ids, status, session);
  if (!r.ok) return actionError(r.error);
  revalidatePath(LIST);
  const label = status === "active" ? "aktiv" : "Entwurf";
  if (r.data.skipped.length) {
    const first = r.data.skipped[0];
    await flashToast(
      `${r.data.changed.length} auf ${label} gesetzt, ${r.data.skipped.length} übersprungen (${first.title}: ${first.reason})`,
      r.data.changed.length ? "success" : "error",
    );
  } else {
    await flashToast(
      `${r.data.changed.length} ${r.data.changed.length === 1 ? "Produkt" : "Produkte"} auf ${label} gesetzt`,
    );
  }
  return actionOk();
}

export async function moveProductAction(formData: FormData): Promise<void> {
  const session = await editor();
  const id = String(formData.get("productId") ?? "");
  const dir = formData.get("direction") === "up" ? "up" : "down";
  if (!session || !uuid.safeParse(id).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  const r = await moveProduct(id, dir, session);
  if (!r.ok) await flashToast(r.error, "error");
  revalidatePath(LIST);
}

/** Ziehen in der Liste (Client): neue Reihenfolge der sichtbaren Produkte. */
export async function reorderProductsAction(
  orderedIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  const session = await editor();
  if (!session) return { ok: false, message: NO_PERMISSION };
  const r = await reorderProducts(Array.isArray(orderedIds) ? orderedIds.map(String) : [], session);
  revalidatePath(LIST);
  return r.ok ? { ok: true } : { ok: false, message: r.error };
}

/* ------------------------------------------------------------------------------------------ */
/* Bilder                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Bildaktionen ohne JavaScript über ein eigenes Formular: op = "delete:<id>", "up:<id>",
 * "down:<id>" oder "main:<id>" (Hauptbild = erste Position).
 */
export async function imageOpAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const session = await editor(detailPath(productId));
  const [op, imageId] = String(formData.get("op") ?? "").split(":");
  if (!session || !uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  if (op === "delete") {
    const r = await deleteImage(imageId, session);
    await flashToast(r.ok ? "Bild gelöscht" : r.error, r.ok ? "success" : "error");
  } else if (op === "up" || op === "down" || op === "main") {
    const { data } = await db()
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .order("position");
    const order = (data ?? []).map((r) => r.id);
    const i = order.indexOf(imageId);
    if (i >= 0) {
      if (op === "main") {
        order.splice(i, 1);
        order.unshift(imageId);
      } else {
        const j = op === "up" ? i - 1 : i + 1;
        if (j >= 0 && j < order.length) [order[i], order[j]] = [order[j], order[i]];
      }
      const r = await reorderImages(productId, order, session);
      await flashToast(
        r.ok ? (op === "main" ? "Hauptbild gesetzt" : "Reihenfolge gespeichert") : r.error,
        r.ok ? "success" : "error",
      );
    }
  }
  revalidatePath(detailPath(productId));
}

/** Upload ohne JavaScript (bis 2 MB, Grenze der Server Actions). */
export async function uploadImageFormAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const session = await editor(detailPath(productId));
  if (!session || !uuid.safeParse(productId).success) {
    await flashToast(NO_PERMISSION, "error");
    return;
  }
  const file = formData.get("file");
  const alt = String(formData.get("alt") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    await flashToast("Bitte wähle eine Bilddatei aus.", "error");
    return;
  }
  if (!alt) {
    await flashToast("Bitte gib einen Alt-Text für das Bild ein.", "error");
    return;
  }
  const r = await uploadProductImage(
    productId,
    { bytes: await file.arrayBuffer(), fileName: file.name, contentType: file.type },
    { alt },
    session,
  );
  await flashToast(r.ok ? "Bild hochgeladen" : r.error, r.ok ? "success" : "error");
  revalidatePath(detailPath(productId));
}

/** Direkter Upload aus dem Browser, Schritt 1: signierte URL. */
export async function createImageUploadUrlAction(
  productId: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<{ ok: true; signedUrl: string; path: string } | { ok: false; message: string }> {
  const session = await editor(detailPath(productId));
  if (!session || !uuid.safeParse(productId).success) return { ok: false, message: NO_PERMISSION };
  const r = await createImageUploadUrl(
    productId,
    {
      fileName: String(file?.fileName ?? "bild"),
      contentType: String(file?.contentType ?? ""),
      size: Number(file?.size ?? 0),
    },
    session,
  );
  return r.ok
    ? { ok: true, signedUrl: r.data.signedUrl, path: r.data.path }
    : { ok: false, message: r.error };
}

/** Direkter Upload, Schritt 2: prüfen, ablegen, Zwischendatei löschen. */
export async function finalizeImageUploadAction(
  productId: string,
  pendingPath: string,
  alt: string,
): Promise<{ ok: boolean; message: string }> {
  const session = await editor(detailPath(productId));
  if (!session || !uuid.safeParse(productId).success) return { ok: false, message: NO_PERMISSION };
  const r = await finalizeImageUpload(
    productId,
    String(pendingPath),
    { alt: String(alt ?? "") },
    session,
  );
  revalidatePath(detailPath(productId));
  return r.ok ? { ok: true, message: "Bild hochgeladen" } : { ok: false, message: r.error };
}

/** Ziehen der Bilder (Client): komplette neue Reihenfolge. */
export async function reorderImagesAction(
  productId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  const session = await editor(detailPath(productId));
  if (!session || !uuid.safeParse(productId).success) return { ok: false, message: NO_PERMISSION };
  const r = await reorderImages(
    productId,
    Array.isArray(orderedIds) ? orderedIds.map(String) : [],
    session,
  );
  revalidatePath(detailPath(productId));
  return r.ok ? { ok: true } : { ok: false, message: r.error };
}
