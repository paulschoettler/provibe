import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Kunden" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function KundenPage() {
  await requireStaff("support", { next: "/admin/kunden" });
  return (
    <>
      <PageHeader title="Kunden" />
      <ComingSoon
        title="Kunden"
        description="Mini-CRM mit Profil, Bestellungen, Umsatz, Newsletter-Nachweis, Tags, Notizen und Timeline."
      />
    </>
  );
}
