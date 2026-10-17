"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasRole, requireStaff } from "@/lib/admin/auth";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { toActionError } from "@/lib/admin/orders/errors";
import { discardJob, jobKindLabel, retryJob } from "./admin";

/** Server Actions für /admin/jobs (nur Owner und Admin). */

const PATH = "/admin/jobs";

export async function retryJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return actionError("Jobs verwalten dürfen nur Owner und Admin.");
  const id = z.uuid().safeParse(formData.get("jobId"));
  if (!id.success) return actionError("Ungültiger Job.");
  try {
    const { result, kind } = await retryJob(id.data, session);
    await flashToast(
      result === "succeeded"
        ? `${jobKindLabel(kind)}: erfolgreich ausgeführt`
        : result === "retry"
          ? `${jobKindLabel(kind)}: erneut fehlgeschlagen, nächster Versuch mit Wartezeit`
          : `${jobKindLabel(kind)}: eingereiht, der Runner übernimmt`,
      result === "retry" ? "error" : "success",
    );
  } catch (error) {
    return actionError(toActionError(error).message);
  }
  revalidatePath(PATH);
  return actionOk();
}

export async function discardJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return actionError("Jobs verwalten dürfen nur Owner und Admin.");
  const id = z.uuid().safeParse(formData.get("jobId"));
  if (!id.success) return actionError("Ungültiger Job.");
  try {
    await discardJob(id.data, session, String(formData.get("reason") ?? ""));
  } catch (error) {
    return actionError(toActionError(error).message);
  }
  await flashToast("Job verworfen");
  revalidatePath(PATH);
  return actionOk();
}
