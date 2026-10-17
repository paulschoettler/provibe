"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import {
  deleteCollectionImageFile,
  removeCollectionImage,
  uploadCollectionImage,
} from "@/lib/admin/media/data";
import { flattenFormValues, type FormObject } from "@/lib/admin/products/form";
import { INVALID_INPUT, NO_PERMISSION } from "@/lib/admin/products/result";
import { handleError } from "@/lib/admin/products/rules";
import {
  actionError,
  actionOk,
  formDataToObject,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import {
  applyCollectionRules,
  deleteCollection,
  getCollectionForEdit,
  isCollectionHandleFree,
  previewCollectionRules,
  publishCollection,
  saveCollection,
  setCollectionProducts,
  type RulePreviewItem,
} from "./data";
import { parseCollectionForm, parseRuleRows } from "./form";

/**
 * Server Actions für /admin/kollektionen. Rechte wie Produkte (editProducts); Revalidierung
 * der Storefront (Tag catalog) übernimmt data.ts über revalidateCatalog.
 */

const LIST = "/admin/kollektionen";
const uuid = z.guid();

async function editor(next = LIST): Promise<StaffSession | null> {
  const session = await requireStaff("support", { next });
  return PERMISSIONS.editProducts(session) ? session : null;
}

export async function saveCollectionFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const obj = formDataToObject(formData);
  const id = typeof obj.id === "string" ? obj.id : "";
  const session = await editor(id ? `${LIST}/${id}` : `${LIST}/neu`);
  if (!session) return actionError(NO_PERMISSION);
  const values = flattenFormValues(obj);
  const parsed = parseCollectionForm(obj);
  if (Object.keys(parsed.errors).length)
    return actionError(INVALID_INPUT, { fieldErrors: parsed.errors, values });

  const saved = await saveCollection(parsed.collection, session);
  if (!saved.ok) return actionError(saved.error, { fieldErrors: saved.fieldErrors, values });
  const warnings = [...saved.warnings];

  if (parsed.productIds) {
    const current = await getCollectionForEdit(saved.data.id);
    const before = (current?.products ?? []).map((p) => p.id).join(",");
    if (before !== parsed.productIds.join(",")) {
      const r = await setCollectionProducts(saved.data.id, parsed.productIds, session);
      if (!r.ok)
        return actionError(`Kollektion gespeichert, Produktliste nicht: ${r.error}`, {
          fieldErrors: r.fieldErrors,
          values,
        });
    }
  }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${saved.data.id}`);
  if (!id) {
    await flashToast("Kollektion angelegt");
    redirect(`${LIST}/${saved.data.id}` as Route);
  }
  await flashToast(
    saved.data.productCount != null
      ? `Kollektion gespeichert, ${saved.data.productCount} Produkte passen`
      : "Kollektion gespeichert",
  );
  return actionOk(warnings.length ? warnings.join(" ") : undefined);
}

/** Live-Vorschau der Regeln (Client). rows sind die Formularfelder rules.<i>.* als Strings. */
export async function previewRulesAction(
  rows: Record<string, string>,
  sortKey: string,
): Promise<
  | { ok: true; items: RulePreviewItem[]; total: number }
  | { ok: false; message: string; fieldErrors: Record<string, string> }
> {
  await requireStaff("support", { next: LIST });
  const errors: Record<string, string> = {};
  const obj: FormObject = {};
  for (const [k, v] of Object.entries(rows ?? {}))
    if (/^rules\.\d+\.(field|op|value|isNew|remove)$/.test(k)) obj[k] = String(v);
  const rules = parseRuleRows(obj, errors);
  if (Object.keys(errors).length)
    return { ok: false, message: "Bitte prüfe die Bedingungen.", fieldErrors: errors };
  const r = await previewCollectionRules(rules, String(sortKey ?? ""));
  return r.ok
    ? { ok: true, items: r.data.items, total: r.data.total }
    : { ok: false, message: r.error, fieldErrors: r.fieldErrors };
}

export async function checkCollectionHandleAction(
  handle: string,
  exceptId?: string,
): Promise<{ ok: boolean; message: string }> {
  await requireStaff("support", { next: LIST });
  const h = String(handle ?? "")
    .trim()
    .toLowerCase();
  const err = handleError(h);
  if (err) return { ok: false, message: err };
  const free = await isCollectionHandleFree(
    h,
    exceptId && uuid.safeParse(exceptId).success ? exceptId : undefined,
  );
  return free
    ? { ok: true, message: `Frei: /collections/${h}` }
    : { ok: false, message: "Dieser Handle ist schon vergeben." };
}

function idOf(formData: FormData): string | null {
  const id = String(formData.get("collectionId") ?? "");
  return uuid.safeParse(id).success ? id : null;
}

export async function publishCollectionAction(formData: FormData): Promise<void> {
  const id = idOf(formData);
  const session = await editor(id ? `${LIST}/${id}` : LIST);
  if (!session || !id) return void (await flashToast(NO_PERMISSION, "error"));
  const publish = formData.get("publish") === "true";
  const r = await publishCollection(id, publish, session);
  await flashToast(
    r.ok
      ? [
          publish ? "Kollektion veröffentlicht" : "Kollektion ist jetzt ein Entwurf",
          ...r.warnings,
        ].join(". ")
      : r.error,
    r.ok ? "success" : "error",
  );
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

export async function applyRulesAction(formData: FormData): Promise<void> {
  const id = idOf(formData);
  const session = await editor(id ? `${LIST}/${id}` : LIST);
  if (!session || !id) return void (await flashToast(NO_PERMISSION, "error"));
  const r = await applyCollectionRules(id, session);
  await flashToast(
    r.ok
      ? `Regeln angewendet: ${r.data.total} Produkte (${r.data.added} neu, ${r.data.removed} entfernt)`
      : r.error,
    r.ok ? "success" : "error",
  );
  revalidatePath(`${LIST}/${id}`);
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const id = idOf(formData);
  const session = await editor(id ? `${LIST}/${id}` : LIST);
  if (!session || !id) return void (await flashToast(NO_PERMISSION, "error"));
  const before = await getCollectionForEdit(id);
  const r = await deleteCollection(id, session);
  if (!r.ok) {
    await flashToast(r.error, "error");
    return;
  }
  await deleteCollectionImageFile(before?.collection.imagePath ?? null);
  await flashToast("Kollektion gelöscht");
  revalidatePath(LIST);
  redirect(LIST as Route);
}

export async function uploadCollectionImageAction(formData: FormData): Promise<void> {
  const id = idOf(formData);
  const session = await editor(id ? `${LIST}/${id}` : LIST);
  if (!session || !id) return void (await flashToast(NO_PERMISSION, "error"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return void (await flashToast("Bitte wähle eine Bilddatei aus.", "error"));
  const r = await uploadCollectionImage(
    id,
    { bytes: await file.arrayBuffer(), contentType: file.type },
    session,
  );
  await flashToast(r.ok ? "Bild gespeichert" : r.error, r.ok ? "success" : "error");
  revalidatePath(`${LIST}/${id}`);
  revalidatePath(LIST);
}

export async function removeCollectionImageAction(formData: FormData): Promise<void> {
  const id = idOf(formData);
  const session = await editor(id ? `${LIST}/${id}` : LIST);
  if (!session || !id) return void (await flashToast(NO_PERMISSION, "error"));
  const r = await removeCollectionImage(id, session);
  await flashToast(r.ok ? "Bild entfernt" : r.error, r.ok ? "success" : "error");
  revalidatePath(`${LIST}/${id}`);
  revalidatePath(LIST);
}
