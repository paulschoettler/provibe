import "server-only";
import { hasRole, PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import type { IconName } from "@/components/admin/ui/Icon";
import type { NavLink } from "./nav-shared";

/**
 * Navigation des Backoffice (Figma Seitenleiste 26:3601). Reihenfolge und Beschriftung wie im
 * Entwurf. visible blendet Module aus, für die die Rolle keine Leserechte hat; Schreibrechte prüft
 * jede Seite und jede Server Action selbst.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** nur exakte Übereinstimmung aktiv (Dashboard) */
  exact?: boolean;
  visible?: (s: StaffSession) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/bestellungen", label: "Bestellungen", icon: "bestellungen" },
  // Figma 79:2395 "Seitenleiste (mit Abos)": direkt unter Bestellungen. Alle Rollen sehen den
  // Punkt (Fulfillment sieht Lieferplan und Historie ohne Beträge, die Seiten prüfen selbst).
  { href: "/admin/abos", label: "Abos", icon: "abo" },
  { href: "/admin/produkte", label: "Produkte", icon: "produkte" },
  { href: "/admin/kollektionen", label: "Kollektionen", icon: "kollektionen" },
  { href: "/admin/bestand", label: "Bestand", icon: "bestand" },
  { href: "/admin/rabatte", label: "Rabatte", icon: "rabatte" },
  { href: "/admin/kunden", label: "Kunden", icon: "kunden", visible: PERMISSIONS.viewCustomers },
  {
    href: "/admin/segmente",
    label: "Segmente",
    icon: "segmente",
    visible: PERMISSIONS.viewCustomers,
  },
  { href: "/admin/leads", label: "Leads", icon: "leads", visible: PERMISSIONS.viewCustomers },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    icon: "newsletter",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/automationen",
    label: "Automationen",
    icon: "automationen",
    visible: PERMISSIONS.viewCustomers,
  },
  { href: "/admin/emails", label: "E-Mails", icon: "emails" },
  { href: "/admin/inhalte", label: "Inhalte", icon: "inhalte" },
  {
    href: "/admin/bewertungen",
    label: "Bewertungen",
    icon: "notiz",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/einstellungen",
    label: "Einstellungen",
    icon: "einstellungen",
    visible: (s) => hasRole(s, "admin"),
  },
  {
    href: "/admin/protokoll",
    label: "Protokoll",
    icon: "protokoll",
    visible: (s) => hasRole(s, "admin"),
  },
];

export function navFor(
  session: StaffSession,
  counts: Partial<Record<string, number>> = {},
): NavLink[] {
  return NAV_ITEMS.filter((i) => !i.visible || i.visible(session)).map((i) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
    exact: i.exact,
    count: counts[i.href] || undefined,
  }));
}
