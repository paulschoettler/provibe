import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Inhalte" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function InhaltePage() {
  await requireStaff("support", { next: "/admin/inhalte" });
  return (
    <>
      <PageHeader title="Inhalte" />
      <ComingSoon
        title="Inhalte"
        description="Seiten, Rechtstexte mit Versionen, Startseiten-Module, Announcement-Bar, Navigation, Footer und Blog."
      />
    </>
  );
}
