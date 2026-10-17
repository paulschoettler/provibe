/**
 * Gemeinsamer Zustand der Kontoformulare (useActionState). Liegt bewusst außerhalb der
 * "use server"-Dateien, die nur asynchrone Funktionen exportieren dürfen.
 */
export interface AccountFormState {
  status: "idle" | "ok" | "error";
  message: string;
  /** Fehler je Feldname, werden per aria-describedby am Feld angezeigt */
  fieldErrors?: Record<string, string>;
  /** Eingaben zurückgeben, damit das Formular ohne JavaScript nicht leer neu lädt */
  values?: Record<string, string>;
  /** Für "Link gesendet": an welche Adresse */
  email?: string;
}

export const INITIAL_FORM_STATE: AccountFormState = { status: "idle", message: "" };

/** Neutrale Meldung nach Magic-Link- oder Aktivierungsanfrage (kein Hinweis, ob es die Adresse gibt). */
export const LINK_SENT_MESSAGE =
  "Wenn es zu dieser Adresse ein Konto gibt oder eines angelegt werden kann, ist der Link unterwegs.";

export const GENERIC_ERROR_MESSAGE =
  "Das hat gerade nicht geklappt. Bitte versuch es in ein paar Minuten noch einmal.";
