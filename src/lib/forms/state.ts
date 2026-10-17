/**
 * Zustand der Inhaltsformulare für useActionState. Liegt außerhalb der "use server"-Dateien,
 * weil diese nur asynchrone Funktionen exportieren dürfen.
 */
export interface FormState {
  status: "idle" | "error" | "ok";
  /** Allgemeine Meldung (Fehlerbox oben im Formular) */
  message?: string;
  /** Fehler je Feldname */
  fieldErrors?: Record<string, string>;
  /** Eingaben zum Wiederbefüllen nach einem Fehler (ohne JavaScript lädt die Seite neu) */
  values?: Record<string, string>;
}

export const INITIAL_FORM_STATE: FormState = { status: "idle" };

/** Zustand des Widerrufsformulars: zusätzlich gefundene Bestellpositionen. */
export interface WithdrawalFormState extends FormState {
  /** Bestellung gefunden: Positionen zur Mehrfachauswahl */
  orderItems?: { value: string; label: string }[];
  /** Ergebnis der Suche, für die Hinweiszeile */
  lookup?: "found" | "not_found";
  selectedItems?: string[];
}

export const INITIAL_WITHDRAWAL_STATE: WithdrawalFormState = { status: "idle" };

/** Allgemeine Fehlermeldung für die Box über dem Formular (Figma 26:3500). */
export const FORM_ERROR_TITLE = "Da fehlt noch was";
export const FORM_ERROR_TEXT = "Bitte prüfe die markierten Felder.";
export const FORM_FAILURE_TEXT =
  "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal oder schreib uns eine E-Mail.";
