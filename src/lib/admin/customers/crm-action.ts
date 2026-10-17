import "server-only";
import { unstable_rethrow } from "next/navigation";
import { requireStaff, type StaffSession } from "@/lib/admin/auth";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";
import { PermissionError, ValidationError, assertPermission, type Permission } from "./guard";

/**
 * Rahmen der Server Actions im CRM (Kunden, Segmente, Leads, Newsletter, Automationen, E-Mails):
 * requireStaff, Modulrecht über guard.ts, Fehler der Serverlogik als ActionState für <ActionForm>.
 * redirect() und notFound() werden durchgereicht (unstable_rethrow).
 */

export const CRM_NO_PERMISSION = "Dafür fehlt dir die Berechtigung.";
export const CRM_GENERIC_ERROR = "Das hat gerade nicht geklappt. Bitte versuch es noch einmal.";

/** Owner und Admin (Sperren, Löschen, Lead umwandeln). */
export function isOwnerOrAdmin(session: StaffSession): boolean {
  return session.role === "owner" || session.role === "admin";
}

export function errorMessage(error: unknown): string {
  if (error instanceof PermissionError) return CRM_NO_PERMISSION;
  if (error instanceof Error && error.message) return error.message;
  return CRM_GENERIC_ERROR;
}

export async function runCrmAction(
  permission: Permission | "ownerOrAdmin",
  next: string,
  fn: (session: StaffSession) => Promise<ActionState | void>,
  values?: Record<string, string>,
): Promise<ActionState> {
  const session = await requireStaff("support", { next });
  try {
    if (permission === "ownerOrAdmin") {
      if (!isOwnerOrAdmin(session)) throw new PermissionError();
    } else {
      assertPermission(session, permission);
    }
    return (await fn(session)) ?? actionOk();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ValidationError) {
      const count = Object.keys(error.fieldErrors).length;
      return actionError(count > 1 ? "Bitte prüf die markierten Felder." : error.message, {
        fieldErrors: error.fieldErrors,
        values,
      });
    }
    const message = errorMessage(error);
    if (!(error instanceof PermissionError)) console.error("[crm] Aktion fehlgeschlagen", message);
    return actionError(message, { values });
  }
}

/** Wert eines Formularfelds als getrimmter String. */
export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}
