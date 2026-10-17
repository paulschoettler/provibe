import "server-only";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS, requireStaff, type StaffSession } from "@/lib/admin/auth";
import { PermissionError, ValidationError } from "@/lib/admin/customers/guard";
import { actionError, actionOk, type ActionState } from "@/components/admin/ui/action-state";

/**
 * Gemeinsamer Rahmen der Server Actions für Inhalte, Einstellungen und Bewertungen:
 * requireStaff, Modulrecht aus PERMISSIONS, Fehler der Serverlogik (ValidationError mit
 * Feldfehlern, PermissionError, Error mit deutscher Meldung) als ActionState für <ActionForm>.
 * redirect() und notFound() werden durchgereicht (unstable_rethrow).
 */

export const NO_PERMISSION = "Dafür fehlt dir die Berechtigung.";

export async function runAdminAction(
  permission: keyof typeof PERMISSIONS,
  next: string,
  fn: (session: StaffSession) => Promise<ActionState | void>,
  values?: Record<string, string>,
): Promise<ActionState> {
  const session = await requireStaff("support", { next });
  if (!PERMISSIONS[permission](session)) return actionError(NO_PERMISSION);
  try {
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
    if (error instanceof PermissionError) return actionError(NO_PERMISSION, { values });
    const message = error instanceof Error && error.message ? error.message : "";
    console.error("[admin] Aktion fehlgeschlagen", message);
    return actionError(message || "Das hat gerade nicht geklappt. Bitte versuch es noch einmal.", {
      values,
    });
  }
}
