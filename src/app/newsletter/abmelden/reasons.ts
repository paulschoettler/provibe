/** Optionale Abmeldegründe (nur zur Auswertung, keine Pflicht). */
export const UNSUBSCRIBE_REASONS = [
  { value: "zu_viele_mails", label: "Zu viele E-Mails" },
  { value: "nicht_relevant", label: "Inhalte passen nicht zu mir" },
  { value: "nie_angemeldet", label: "Ich habe mich nie angemeldet" },
  { value: "sonstiges", label: "Anderer Grund" },
] as const;
