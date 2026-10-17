"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { adjustInventory, setThreshold, setTracking } from "./data";

/**
 * Server Actions für /admin/bestand: Bestand buchen (Grund Pflicht, bei Korrektur auch eine
 * Notiz), Warnschwelle und Bestandsführung je Variante. Die Regeln stehen in rules.ts, Audit und
 * inventory_movements schreibt data.ts.
 */

const PATH = "/admin/bestand";
const variantId = z.guid();

function intFrom(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().replace(/^\+/, "");
  return /^-?\d{1,6}$/.test(v) ? Number(v) : null;
}

export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.fulfil(session)) {
    return actionError("Bestand buchen dürfen Owner, Admin und Fulfillment.");
  }
  const values = {
    delta: String(formData.get("delta") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
  const id = variantId.safeParse(formData.get("variantId"));
  if (!id.success) return actionError("Ungültige Variante.", { values });
  const delta = intFrom(formData.get("delta"));
  if (delta === null || delta === 0) {
    return actionError("Bitte prüf die Menge.", {
      fieldErrors: { delta: "Ganze Zahl ungleich 0, zum Beispiel 24 oder -3" },
      values,
    });
  }
  if (!values.reason) {
    return actionError("Bitte wähle einen Grund.", {
      fieldErrors: { reason: "Grund ist Pflicht" },
      values,
    });
  }
  const result = await adjustInventory(
    id.data,
    delta,
    values.reason as "correction",
    values.note.trim() || null,
    session,
  );
  if (!result.ok) {
    return actionError(result.error, { fieldErrors: result.fieldErrors, values });
  }
  await flashToast(
    `Gebucht: ${delta > 0 ? "+" : ""}${delta}, Bestand jetzt ${result.data.onHand}${
      result.warnings.length ? `. ${result.warnings[0]}` : ""
    }`,
    "success",
  );
  revalidatePath(PATH);
  return actionOk();
}

export async function setThresholdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.editProducts(session)) {
    return actionError("Warnschwellen ändern dürfen Owner und Admin.");
  }
  const id = variantId.safeParse(formData.get("variantId"));
  if (!id.success) return actionError("Ungültige Variante.");
  const value = intFrom(formData.get("threshold"));
  if (value === null || value < 0) {
    return actionError("Bitte prüf die Warnschwelle.", {
      fieldErrors: { threshold: "Ganze Zahl ab 0" },
      values: { threshold: String(formData.get("threshold") ?? "") },
    });
  }
  const result = await setThreshold(id.data, value, session);
  if (!result.ok) return actionError(result.error, { fieldErrors: result.fieldErrors });
  await flashToast(`Warnschwelle auf ${result.data.lowStockThreshold} gesetzt`);
  revalidatePath(PATH);
  return actionOk();
}

export async function setTrackingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.editProducts(session)) {
    return actionError("Bestandsführung ändern dürfen Owner und Admin.");
  }
  const id = variantId.safeParse(formData.get("variantId"));
  if (!id.success) return actionError("Ungültige Variante.");
  const track = formData.get("trackInventory") === "on";
  const backorder = formData.get("allowBackorder") === "on";
  const result = await setTracking(id.data, track, backorder, session);
  if (!result.ok) return actionError(result.error);
  await flashToast(
    result.warnings[0] ??
      (track ? "Bestandsführung eingeschaltet" : "Bestandsführung ausgeschaltet"),
    "success",
  );
  revalidatePath(PATH);
  return actionOk();
}
