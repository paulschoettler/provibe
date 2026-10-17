"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/admin/auth";
import { PermissionError, ValidationError } from "@/lib/admin/customers/guard";
import { formValues, list, text } from "@/lib/admin/content/input";
import { NO_PERMISSION } from "@/lib/admin/content/run-action";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { flashToast } from "@/components/admin/ui/toast-server";
import { approveReviews, deleteReview, rejectReview, replyToReview } from "./moderation";
import { canModerateReviews } from "./queries";

/**
 * Server Actions für /admin/bewertungen. Moderieren dürfen Owner, Admin und Support
 * (canModerateReviews), löschen nur Owner und Admin (in moderation.ts geprüft).
 */

const PATH = "/admin/bewertungen";

async function run(
  fd: FormData,
  fn: (session: Awaited<ReturnType<typeof requireStaff>>) => Promise<ActionState | void>,
): Promise<ActionState> {
  const session = await requireStaff("support", { next: PATH });
  if (!canModerateReviews(session)) return actionError(NO_PERMISSION);
  const values = formValues(fd);
  try {
    const result = (await fn(session)) ?? actionOk();
    revalidatePath(PATH);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ValidationError)
      return actionError(error.message, { fieldErrors: error.fieldErrors, values });
    if (error instanceof PermissionError) return actionError(NO_PERMISSION, { values });
    return actionError(error instanceof Error ? error.message : "Das hat nicht geklappt.", {
      values,
    });
  }
}

export async function approveReviewsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (session) => {
    const count = await approveReviews(list(fd, "ids"), session);
    await flashToast(
      count === 0
        ? "Nichts zu tun, die Auswahl war schon freigegeben"
        : count === 1
          ? "Bewertung freigegeben"
          : `${count} Bewertungen freigegeben`,
    );
  });
}

export async function rejectReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const result = await run(fd, async (session) => {
    await rejectReview(
      { id: text(fd, "id"), reason: text(fd, "reason"), detail: text(fd, "detail") },
      session,
    );
    await flashToast("Bewertung abgelehnt, Grund protokolliert");
    done = true;
  });
  if (done) redirect(`${PATH}?tab=abgelehnt` as Route);
  return result;
}

export async function replyReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(fd, async (session) => {
    const outcome = await replyToReview(
      { id: text(fd, "id"), body: text(fd, "replyBody") },
      session,
    );
    await flashToast(outcome === "saved" ? "Antwort gespeichert" : "Antwort entfernt");
    return actionOk();
  });
}

export async function deleteReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const tab = text(fd, "tab");
  const result = await run(fd, async (session) => {
    await deleteReview({ id: text(fd, "id"), note: text(fd, "note") }, session);
    await flashToast("Bewertung gelöscht");
    done = true;
  });
  if (done) redirect(`${PATH}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}` as Route);
  return result;
}
