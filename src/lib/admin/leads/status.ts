/**
 * Lead-Status laut Schema (lead_status: new, contacted, qualified, won, lost). Entscheidung H18:
 * Anzeige "Qualifiziert" statt Umbenennen des Enums. Rein, getestet in status.test.ts.
 */

export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  won: "Gewonnen",
  lost: "Verloren",
};

/** Badge-Ton passend zu den Admin-Statusfarben (Figma Variablensammlung "Admin"). */
export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  "blue" | "yellow" | "magenta" | "green" | "gray"
> = {
  new: "blue",
  contacted: "yellow",
  qualified: "magenta",
  won: "green",
  lost: "gray",
};

export const LEAD_LOCATION_TYPES = ["Gym", "Einzelhandel", "Gastro", "Hotel", "Sonstiges"] as const;

/**
 * Erlaubte Wechsel: vorwärts frei, zurück nur aus won/lost nach qualified (Wiederaufnahme).
 * Gleicher Status ist kein Wechsel.
 */
export function canChangeLeadStatus(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  if (from === "won" || from === "lost") return to === "qualified" || to === "contacted";
  return true;
}

/** Status nach Umwandlung in einen B2B-Kunden. */
export function statusAfterConversion(): LeadStatus {
  return "won";
}

export function isOpenLead(status: LeadStatus): boolean {
  return status !== "won" && status !== "lost";
}
