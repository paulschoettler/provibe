"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import { flattenFormValues } from "@/lib/admin/products/form";
import { INVALID_INPUT, NO_PERMISSION } from "@/lib/admin/products/result";
import {
  actionError,
  actionOk,
  formDataToObject,
  type ActionState,
} from "@/components/admin/ui/action-state";
import { formatMoney } from "@/components/admin/ui/format";
import { flashToast } from "@/components/admin/ui/toast-server";
import { checkDiscount, deleteDiscount, saveDiscount, setDiscountActive } from "./data";
import { parseDiscountForm } from "./form";
import { parseEuroToCents } from "./rules";

/**
 * Server Actions für /admin/rabatte. Ändern dürfen Owner und Admin (editProducts), lesen alle
 * Staff-Rollen. Rabattcodes liegen nicht im Storefront-Cache (Kasse ist dynamisch), deshalb
 * reicht revalidatePath fürs Backoffice.
 */

const LIST = "/admin/rabatte";
const uuid = z.guid();

async function editor(next = LIST): Promise<StaffSession | null> {
  const session = await requireStaff("support", { next });
  return PERMISSIONS.editProducts(session) ? session : null;
}

export async function saveDiscountFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const obj = formDataToObject(formData);
  const id = typeof obj.id === "string" ? obj.id : "";
  const session = await editor(id ? `${LIST}/${id}` : `${LIST}/neu`);
  if (!session) return actionError(NO_PERMISSION);
  const values = flattenFormValues(obj);
  const parsed = parseDiscountForm(obj);
  if (Object.keys(parsed.errors).length)
    return actionError(INVALID_INPUT, { fieldErrors: parsed.errors, values });
  const r = await saveDiscount(parsed.discount, session);
  if (!r.ok) {
    // Feldpfade aus Zod (appliesTo.ids) auf die Formularfelder abbilden
    const fe: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.fieldErrors)) {
      if (k.startsWith("appliesTo")) fe.appliesTo = v;
      else if (k === "value")
        fe[parsed.discount.kind === "fixed_amount" ? "valueAmount" : "valuePercent"] = v;
      else if (k === "minSubtotalCents") fe.minSubtotal = v;
      else fe[k] = v;
    }
    return actionError(r.error, { fieldErrors: fe, values });
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${r.data.id}`);
  const generated = parsed.generated ? ` mit erzeugtem Code ${r.data.code}` : "";
  await flashToast(id ? `Rabatt ${r.data.code} gespeichert` : `Rabatt angelegt${generated}`);
  if (!id) redirect(`${LIST}/${r.data.id}` as Route);
  return actionOk(r.warnings.length ? r.warnings.join(" ") : undefined);
}

export async function setDiscountActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("discountId") ?? "");
  const session = await editor(`${LIST}/${id}`);
  if (!session || !uuid.safeParse(id).success)
    return void (await flashToast(NO_PERMISSION, "error"));
  const active = formData.get("active") === "true";
  const r = await setDiscountActive(id, active, session);
  await flashToast(
    r.ok ? (active ? "Rabatt aktiviert" : "Rabatt deaktiviert") : r.error,
    r.ok ? "success" : "error",
  );
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

export async function deleteDiscountAction(formData: FormData): Promise<void> {
  const id = String(formData.get("discountId") ?? "");
  const session = await editor(`${LIST}/${id}`);
  if (!session || !uuid.safeParse(id).success)
    return void (await flashToast(NO_PERMISSION, "error"));
  const r = await deleteDiscount(id, session);
  if (!r.ok) return void (await flashToast(r.error, "error"));
  await flashToast("Rabatt gelöscht");
  revalidatePath(LIST);
  redirect(LIST as Route);
}

/** Code wie an der Kasse prüfen (gleiche Regeln aus src/lib/pricing), ohne etwas zu ändern. */
export async function checkDiscountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff("support", { next: LIST });
  const code = String(formData.get("code") ?? "");
  const subtotalRaw = String(formData.get("subtotal") ?? "");
  const subtotal = parseEuroToCents(subtotalRaw);
  const values = { subtotal: subtotalRaw, email: String(formData.get("email") ?? "") };
  if (subtotal == null)
    return actionError("Bitte einen Warenwert wie 49,90 eingeben.", {
      fieldErrors: { subtotal: "Bitte einen Betrag." },
      values,
    });
  const email = String(formData.get("email") ?? "").trim() || null;
  const r = await checkDiscount({ code, subtotalCents: subtotal, email });
  if (!r.found || !r.evaluation) return actionError(r.message ?? "Code unbekannt.", { values });
  if (!r.evaluation.ok)
    return actionError(r.message ?? "Der Code greift bei diesem Warenkorb nicht.", { values });
  const e = r.evaluation;
  const parts = [
    e.discountCents ? `Rabatt ${formatMoney(e.discountCents)}` : null,
    e.freeShipping ? "versandkostenfrei" : null,
  ].filter(Boolean);
  return actionOk(
    `Greift bei ${formatMoney(subtotal)} Warenwert: ${parts.join(", ") || "kein Betrag"}.`,
  );
}
