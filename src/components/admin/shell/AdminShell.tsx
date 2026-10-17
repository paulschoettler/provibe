import "server-only";
import type { ReactNode } from "react";
import { PERMISSIONS, type StaffSession } from "@/lib/admin/auth";
import { countOpenOrders } from "@/lib/admin/dashboard/queries";
import { countPendingReviews } from "@/lib/admin/reviews/queries";
import { countSubscriptionAlerts } from "@/lib/subscriptions/admin-queries";
import { initials, ROLE_LABELS } from "@/lib/admin/staff/rules";
import { ToastRegion } from "@/components/admin/ui/ToastRegion";
import { navFor } from "./nav";
import { SidebarContent, type ShellUser } from "./Sidebar";
import { Topbar, type QuickAction } from "./Topbar";

/**
 * Rahmen aller Backoffice-Seiten nach dem Login: Seitenleiste 240 px (ab lg fest, darunter Drawer),
 * Kopfzeile 56 px, Inhalt mit 24 px Rand (mobil 16 px), Toast-Bereich.
 */
export async function AdminShell({
  session,
  children,
}: {
  session: StaffSession;
  children: ReactNode;
}) {
  const [openOrders, aboAlerts, pendingReviews] = await Promise.all([
    countOpenOrders(),
    // überfällige Abos plus ungeklärte Kündigungen ohne Login; Fulfillment ohne Zähler
    PERMISSIONS.viewCustomers(session)
      ? countSubscriptionAlerts()
      : Promise.resolve({ pastDue: 0, unmatchedCancellations: 0, total: 0 }),
    // offene Bewertungen nur für Rollen mit Kundendaten
    PERMISSIONS.viewCustomers(session) ? countPendingReviews() : Promise.resolve(0),
  ]);
  const items = navFor(session, {
    "/admin/bestellungen": openOrders,
    "/admin/abos": aboAlerts.total,
    "/admin/bewertungen": pendingReviews,
  });
  const user: ShellUser = {
    name: session.displayName,
    email: session.email,
    roleLabel: ROLE_LABELS[session.role],
    initials: initials(session.displayName, session.email),
  };
  const quickActions: QuickAction[] = [
    PERMISSIONS.fulfil(session)
      ? { href: "/admin/bestellungen/neu", label: "Bestellung anlegen" }
      : null,
    PERMISSIONS.editProducts(session)
      ? { href: "/admin/produkte/neu", label: "Produkt anlegen" }
      : null,
    PERMISSIONS.editProducts(session)
      ? { href: "/admin/rabatte/neu", label: "Rabattcode anlegen" }
      : null,
    PERMISSIONS.manageUsers(session)
      ? { href: "/admin/einstellungen/benutzer?einladen=1", label: "Benutzer einladen" }
      : null,
  ].filter((a): a is QuickAction => a !== null);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#inhalt"
        className="rounded-admin-feld bg-admin-karte sr-only z-[70] px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block">
        <SidebarContent items={items} user={user} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          items={items}
          user={user}
          openOrders={openOrders}
          aboAlerts={aboAlerts.total}
          quickActions={quickActions}
        />
        <main
          id="inhalt"
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-6 lg:py-6"
        >
          {children}
        </main>
      </div>
      <ToastRegion />
    </div>
  );
}
