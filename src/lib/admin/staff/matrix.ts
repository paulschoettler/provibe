import "server-only";
import { PERMISSIONS, type StaffRole, type StaffSession } from "@/lib/admin/auth";
import { STAFF_ROLES } from "./rules";

/**
 * Rollenmatrix für /admin/einstellungen/benutzer, direkt aus PERMISSIONS (src/lib/admin/auth.ts)
 * berechnet, damit Anzeige und Prüfung nie auseinanderlaufen. Lesen dürfen alle Rollen alles,
 * außer Fulfillment bei Kundendaten (viewCustomers).
 */
export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewCustomers: "Kunden, Leads, Segmente einsehen",
  fulfil: "Bestellungen versenden, Tracking, Bestand",
  refund: "Erstattungen",
  editProducts: "Produkte, Preise, Rabatte, Kollektionen",
  sendNewsletter: "Newsletter-Kampagnen und Automationen",
  editContent: "Inhalte und Rechtstexte",
  editSettings: "Einstellungen (Versand, Steuern, Tracking, Rechnungen)",
  manageUsers: "Benutzer und Rollen",
};

const ORDER: PermissionKey[] = [
  "viewCustomers",
  "fulfil",
  "refund",
  "editProducts",
  "sendNewsletter",
  "editContent",
  "editSettings",
  "manageUsers",
];

function fakeSession(role: StaffRole): StaffSession {
  return { userId: "", email: "", displayName: "", role, mfaVerified: true, mfaEnforced: true };
}

export interface MatrixRow {
  key: PermissionKey;
  label: string;
  roles: Record<StaffRole, boolean>;
}

export function permissionMatrix(): MatrixRow[] {
  return ORDER.map((key) => ({
    key,
    label: PERMISSION_LABELS[key],
    roles: Object.fromEntries(
      STAFF_ROLES.map((r) => [r, PERMISSIONS[key](fakeSession(r))]),
    ) as Record<StaffRole, boolean>,
  }));
}
