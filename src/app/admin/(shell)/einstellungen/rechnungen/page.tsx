import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Rechnungen" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EinstellungenRechnungenPage() {
  await requireStaff("support", { next: "/admin/einstellungen/rechnungen" });
  return (
    <>
      <PageHeader title="Rechnungen" />
      <ComingSoon title="Rechnungen" description="Rechnungsstellung über Lexware Office." />
    </>
  );
}
