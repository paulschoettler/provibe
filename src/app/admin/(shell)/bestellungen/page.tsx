import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Bestellungen" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function BestellungenPage() {
  await requireStaff("support", { next: "/admin/bestellungen" });
  return (
    <>
      <PageHeader title="Bestellungen" />
      <ComingSoon
        title="Bestellungen"
        description="Liste mit Filtern, Detail mit Statusfluss, Erstattung, Rechnung und Lieferschein, Tracking, Notizen, CSV-Export und manuelle Bestellung."
      />
    </>
  );
}
