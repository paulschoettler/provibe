import { requireStaff } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * Shell für alle Backoffice-Seiten nach der Anmeldung. Ohne Sitzung geht es zum Login, ohne
 * bestätigte Zwei-Faktor-Anmeldung zu /admin/2fa. Jede Seite und jede Server Action prüft
 * zusätzlich selbst (Layouts laufen bei Client-Navigation nicht immer neu).
 */
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  return <AdminShell session={session}>{children}</AdminShell>;
}
