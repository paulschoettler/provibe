"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import type { ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { errorMessage, runCrmAction, str } from "@/lib/admin/customers/crm-action";
import { parseEditorParams, rowsToRules, stateToParams } from "./editor-state";
import { deleteSegment, saveSegment } from "./segments";

/**
 * Server Actions der Segmente. Speichern hängt als formAction am Button des GET-Editors
 * (alle Felder kommen mit), danach zurück in den Editor mit Toast. Löschen nur ohne Kampagnen.
 * Recht: viewCustomers (Support darf Segmente pflegen, laut segments.ts).
 */

const PATH = "/admin/segmente";

function editorUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `${PATH}?${q}` : PATH;
}

export async function saveSegmentFormAction(formData: FormData): Promise<void> {
  const session = await requireStaff("support", { next: PATH });
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  // add/del gehören zum GET-Editor, nicht zum Speichern
  delete raw.add;
  delete raw.del;
  const state = parseEditorParams(raw);
  const idRaw = str(formData, "bearbeiten");
  const id = z.string().uuid().safeParse(idRaw).success ? idRaw : undefined;
  const back = { ...(id ? { bearbeiten: id } : { bearbeiten: "neu" }), ...stateToParams(state) };
  if (!PERMISSIONS.viewCustomers(session)) {
    await flashToast("Dafür fehlt dir die Berechtigung.", "error");
    redirect(editorUrl(back));
  }
  if (state.name.length < 2) {
    await flashToast("Bitte gib dem Segment einen Namen.", "error");
    redirect(editorUrl({ ...back, fehler: "name" }));
  }
  const { rules, errors } = rowsToRules(state);
  if (!rules) {
    await flashToast(`Bitte prüf Bedingung ${Number(Object.keys(errors)[0]) + 1}.`, "error");
    redirect(editorUrl(back));
  }
  let savedId: string;
  try {
    const saved = await saveSegment(
      { id, name: state.name, description: state.description || null, rules },
      session,
    );
    savedId = saved.id;
    await flashToast(`Segment „${saved.name}“ gespeichert, ${saved.lastCount ?? 0} Kunden`);
  } catch (error) {
    unstable_rethrow(error);
    await flashToast(errorMessage(error), "error");
    redirect(editorUrl(back));
  }
  revalidatePath(PATH);
  revalidatePath("/admin/kunden");
  redirect(editorUrl({ bearbeiten: savedId }));
}

export async function deleteSegmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let deleted = false;
  const state = await runCrmAction("viewCustomers", PATH, async (session) => {
    await deleteSegment(str(formData, "segmentId"), session);
    deleted = true;
    await flashToast("Segment gelöscht");
    revalidatePath(PATH);
  });
  if (deleted) redirect(PATH);
  return state;
}
