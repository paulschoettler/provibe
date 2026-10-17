import "server-only";
import type { z } from "zod";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";

/**
 * Gemeinsame Prüfungen der CRM-Serverfunktionen. Jede schreibende Funktion bekommt die
 * Staff-Sitzung (aus requireStaff() in der Server Action) als actor, prüft hier das Modulrecht
 * und validiert die Eingabe mit Zod.
 */

export type Permission = keyof typeof PERMISSIONS;

export class PermissionError extends Error {
  constructor() {
    super("Keine Berechtigung für diese Aktion");
    this.name = "PermissionError";
  }
}

export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Bitte prüf deine Eingabe.");
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function assertPermission(actor: StaffSession, permission: Permission): void {
  if (!PERMISSIONS[permission](actor)) throw new PermissionError();
}

/** Zod-Eingabe prüfen; wirft ValidationError mit Feldfehlern (Pfad mit Punkten). */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new ValidationError(fieldErrors);
}
