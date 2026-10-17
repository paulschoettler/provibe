import type { StaffRole } from "@/lib/admin/auth";

/**
 * Regeln der Benutzerverwaltung (reine Funktionen, getestet in rules.test.ts).
 * Entscheidung H19: Benutzerverwaltung nur Owner. Zusätzlich darf niemand sich selbst aussperren
 * und es bleibt immer mindestens ein aktiver Owner.
 */
export const STAFF_ROLES: StaffRole[] = ["owner", "admin", "support", "fulfillment"];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  support: "Support",
  fulfillment: "Fulfillment",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: "Alles, inklusive Benutzer und Rollen",
  admin: "Alles schreiben außer Benutzerverwaltung",
  support: "Kunden, Bestellungen, Leads, Newsletter-Kontakte",
  fulfillment: "Bestellungen versenden, Bestand pflegen",
};

export interface StaffLike {
  userId: string;
  role: StaffRole;
  isActive: boolean;
}

export type RuleResult = { ok: true } | { ok: false; reason: string };

function activeOwners(all: StaffLike[]): StaffLike[] {
  return all.filter((s) => s.isActive && s.role === "owner");
}

export function checkRoleChange(
  actor: { userId: string; role: StaffRole },
  target: StaffLike,
  newRole: StaffRole,
  all: StaffLike[],
): RuleResult {
  if (actor.role !== "owner") return { ok: false, reason: "Nur Owner dürfen Rollen ändern." };
  if (target.role === newRole) return { ok: false, reason: "Die Rolle ist bereits gesetzt." };
  if (
    target.role === "owner" &&
    newRole !== "owner" &&
    target.isActive &&
    activeOwners(all).length <= 1
  ) {
    return { ok: false, reason: "Es muss mindestens ein aktiver Owner bleiben." };
  }
  if (target.userId === actor.userId && newRole !== "owner") {
    return { ok: false, reason: "Du kannst dir die Owner-Rolle nicht selbst entziehen." };
  }
  return { ok: true };
}

export function checkActiveChange(
  actor: { userId: string; role: StaffRole },
  target: StaffLike,
  active: boolean,
  all: StaffLike[],
): RuleResult {
  if (actor.role !== "owner")
    return { ok: false, reason: "Nur Owner dürfen Benutzer deaktivieren." };
  if (target.isActive === active) {
    return {
      ok: false,
      reason: active ? "Der Benutzer ist bereits aktiv." : "Der Benutzer ist bereits deaktiviert.",
    };
  }
  if (!active && target.userId === actor.userId) {
    return { ok: false, reason: "Du kannst dich nicht selbst deaktivieren." };
  }
  if (!active && target.role === "owner" && activeOwners(all).length <= 1) {
    return { ok: false, reason: "Es muss mindestens ein aktiver Owner bleiben." };
  }
  return { ok: true };
}

export function checkMfaReset(
  actor: { userId: string; role: StaffRole },
  target: StaffLike,
): RuleResult {
  if (actor.role !== "owner")
    return { ok: false, reason: "Nur Owner dürfen die Zwei-Faktor-Anmeldung zurücksetzen." };
  if (target.userId === actor.userId) {
    return {
      ok: false,
      reason:
        "Deine eigene Zwei-Faktor-Anmeldung setzt ein anderer Owner zurück, oder du nutzt einen Wiederherstellungscode.",
    };
  }
  return { ok: true };
}

/** Zwei-Faktor-Status für die Benutzerliste (Figma 49:3529: aktiv, ausstehend, nach Annahme). */
export type MfaDisplay = "active" | "pending" | "invite";

export function mfaDisplay(input: { verifiedFactors: number; invitePending: boolean }): MfaDisplay {
  if (input.invitePending) return "invite";
  return input.verifiedFactors > 0 ? "active" : "pending";
}

/** Initialen für den Avatar: "Paul Schöttler" → "PS", "support@…" → "SU" */
export function initials(name: string | null | undefined, email: string): string {
  const source = (name ?? "").trim();
  if (source && !source.includes("@")) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters =
      parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
    return letters.toUpperCase();
  }
  return (
    email
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "??"
  );
}

/** Auswahl für Einladen und Rolle ändern (RadioCards) */
export const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
  description: ROLE_DESCRIPTIONS[r],
}));
