/**
 * Gemeinsamer Rückgabewert der Backoffice-Server-Actions für <ActionForm> (useActionState).
 * Liegt außerhalb von "use server"-Dateien, weil diese nur asynchrone Funktionen exportieren dürfen.
 *
 *   export async function saveX(_prev: ActionState, formData: FormData): Promise<ActionState> {
 *     const session = await requireStaff("admin");
 *     const parsed = schema.safeParse(Object.fromEntries(formData));
 *     if (!parsed.success) return fieldErrors(parsed.error);
 *     ...
 *     await flashToast("Gespeichert");
 *     return actionOk();
 *   }
 */
import type { ZodError } from "zod";

export interface ActionState {
  status: "idle" | "ok" | "error";
  /** Meldung über dem Formular (Fehler) oder für die Erfolgsanzeige */
  message?: string;
  /** Fehler je Feldname; die Feldbausteine zeigen sie automatisch an */
  fieldErrors?: Record<string, string>;
  /** Eingaben zurückgeben, damit das Formular ohne JavaScript nicht leer neu lädt */
  values?: Record<string, string>;
  /** Beliebige Zusatzdaten für den Client (zum Beispiel einmalig angezeigte Codes) */
  data?: Record<string, unknown>;
}

export const INITIAL_ACTION_STATE: ActionState = { status: "idle" };

export function actionOk(message?: string, data?: Record<string, unknown>): ActionState {
  return { status: "ok", message, data };
}

export function actionError(
  message: string,
  extra?: Pick<ActionState, "fieldErrors" | "values">,
): ActionState {
  return { status: "error", message, ...extra };
}

/** Zod-Fehler in Feldfehler übersetzen (erste Meldung je Feld). */
export function fieldErrorsOf(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function fieldErrors(
  error: ZodError,
  message = "Bitte prüf die markierten Felder.",
  values?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors: fieldErrorsOf(error), values };
}

/** FormData in ein flaches Objekt aus Strings (Mehrfachwerte als Array) für Zod. */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const value = typeof raw === "string" ? raw : raw.name;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}
