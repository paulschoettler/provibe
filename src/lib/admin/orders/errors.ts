/**
 * Fehler der Bestell-Serverlogik. Server Actions fangen sie ab und zeigen message (Deutsch,
 * für das Team formuliert) an; code steuert die Darstellung (zum Beispiel 403 oder Konflikt).
 */
export type AdminOrderErrorCode =
  | "forbidden"
  | "not_found"
  | "validation"
  | "invalid_transition"
  | "conflict"
  | "insufficient_stock"
  | "provider";

export class AdminOrderError extends Error {
  constructor(
    public readonly code: AdminOrderErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AdminOrderError";
  }
}

export function isAdminOrderError(error: unknown): error is AdminOrderError {
  return error instanceof AdminOrderError;
}

/** Für Server Actions: Fehler in ein anzeigbares Ergebnis umwandeln, Unerwartetes nur loggen. */
export function toActionError(error: unknown): { ok: false; code: string; message: string } {
  if (isAdminOrderError(error)) return { ok: false, code: error.code, message: error.message };
  console.error("[admin/orders]", error);
  return {
    ok: false,
    code: "unexpected",
    message: "Das hat nicht geklappt. Bitte versuch es erneut.",
  };
}

/** Zod-Fehler in einen Validierungsfehler mit erstem Hinweis übersetzen. */
export function validationError(
  issues: { path: PropertyKey[]; message: string }[],
): AdminOrderError {
  const first = issues[0];
  const field = first?.path.map(String).join(".") ?? "";
  return new AdminOrderError(
    "validation",
    first ? `${field ? `${field}: ` : ""}${first.message}` : "Ungültige Eingabe",
    issues,
  );
}
