import "server-only";
import { cookies } from "next/headers";
import { TOAST_COOKIE, parseToast, type ToastData, type ToastTone } from "./toast-shared";

/**
 * Rückmeldung einer Server Action als Toast, ohne Client-State-Bibliothek:
 * Die Action setzt ein kurzlebiges Cookie, die Shell liest es beim nächsten Rendern
 * (<ToastRegion /> im Layout) und zeigt die Meldung. Der Client löscht das Cookie nach dem Anzeigen,
 * ohne JavaScript läuft es nach 30 Sekunden ab.
 *
 *   await flashToast("Einladung an anna@provibe-drinks.de verschickt");
 *   await flashToast("Label konnte nicht erstellt werden", "error");
 */
export async function flashToast(message: string, tone: ToastTone = "success"): Promise<void> {
  const store = await cookies();
  const data: ToastData = { id: Date.now().toString(36), tone, message: message.slice(0, 240) };
  store.set(TOAST_COOKIE, JSON.stringify(data), {
    path: "/admin",
    maxAge: 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // der Client entfernt die Meldung nach dem Anzeigen
  });
}

/** Aktuellen Toast lesen (Server Component). */
export async function readToast(): Promise<ToastData | null> {
  const store = await cookies();
  return parseToast(store.get(TOAST_COOKIE)?.value);
}
