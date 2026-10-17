import "server-only";
import { hasRole, PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import type { IconName } from "@/components/admin/ui/Icon";
import type { NavGroupId, NavLink } from "./nav-shared";

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
  /** Bereich in der Seitenleiste; Dashboard und Inhalte stehen einzeln */
  group?: NavGroupId;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/bestellungen", label: "Bestellungen", group: "verkauf", icon: "bestellungen" },
  // Figma 79:2395 "Seitenleiste (mit Abos)": direkt unter Bestellungen. Alle Rollen sehen den
  // Punkt (Fulfillment sieht Lieferplan und Historie ohne Beträge, die Seiten prüfen selbst).
  { href: "/admin/abos", label: "Abos", group: "verkauf", icon: "abo" },
  { href: "/admin/rabatte", label: "Rabatte", group: "verkauf", icon: "rabatte" },
  { href: "/admin/produkte", label: "Produkte", group: "katalog", icon: "produkte" },
  { href: "/admin/kollektionen", label: "Kollektionen", group: "katalog", icon: "kollektionen" },
  { href: "/admin/bestand", label: "Bestand", group: "katalog", icon: "bestand" },
  {
    href: "/admin/kunden",
    label: "Kunden",
    group: "kunden",
    icon: "kunden",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/segmente",
    label: "Segmente",
    group: "kunden",
    icon: "segmente",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/leads",
    label: "Leads",
    group: "kunden",
    icon: "leads",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/bewertungen",
    label: "Bewertungen",
    group: "kunden",
    icon: "notiz",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    group: "marketing",
    icon: "newsletter",
    visible: PERMISSIONS.viewCustomers,
  },
  {
    href: "/admin/automationen",
    label: "Automationen",
    group: "marketing",
    icon: "automationen",
    visible: PERMISSIONS.viewCustomers,
  },
  { href: "/admin/emails", label: "E-Mails", group: "marketing", icon: "emails" },
  { href: "/admin/inhalte", label: "Inhalte", icon: "inhalte" },
  {
    href: "/admin/einstellungen",
    label: "Einstellungen",
    group: "system",
    icon: "einstellungen",
    visible: (s) => hasRole(s, "admin"),
  },
  {
    href: "/admin/protokoll",
    label: "Protokoll",
    group: "system",
    icon: "protokoll",
    visible: (s) => hasRole(s, "admin"),
  },
  {
    href: "/admin/jobs",
    label: "Jobs",
    group: "system",
    icon: "liste",
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
    group: i.group,
  }));
}
