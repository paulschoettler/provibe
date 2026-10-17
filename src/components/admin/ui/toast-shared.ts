/** Gemeinsame Typen für Toasts (Server und Client). */
export type ToastTone = "success" | "error";

export interface ToastData {
  id: string;
  tone: ToastTone;
  message: string;
}

export const TOAST_COOKIE = "pv_admin_toast";

/** Cookie-Wert prüfen; alles Unerwartete wird verworfen (Inhalt kommt vom Client zurück). */
export function parseToast(raw: string | undefined): ToastData | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ToastData>;
    if (typeof value.message !== "string" || value.message.length === 0) return null;
    return {
      id: typeof value.id === "string" ? value.id.slice(0, 20) : "t",
      tone: value.tone === "error" ? "error" : "success",
      message: value.message.slice(0, 240),
    };
  } catch {
    return null;
  }
}

/** Bekannte Meldungen über Suchparameter (?toast=gespeichert), zum Beispiel nach redirect(). */
export const TOAST_MESSAGES: Record<string, ToastData> = {
  gespeichert: { id: "gespeichert", tone: "success", message: "Änderungen gespeichert" },
  geloescht: { id: "geloescht", tone: "success", message: "Gelöscht" },
  fehler: {
    id: "fehler",
    tone: "error",
    message: "Das hat nicht geklappt. Bitte versuch es noch einmal.",
  },
  keinrecht: { id: "keinrecht", tone: "error", message: "Dafür fehlt dir die Berechtigung." },
};
