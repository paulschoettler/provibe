import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Bestand" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function BestandPage() {
  await requireStaff("support", { next: "/admin/bestand" });
  return (
    <>
      <PageHeader title="Bestand" />
      <ComingSoon
        title="Bestand"
        description="Übersicht, Korrekturen mit Grund, Historie und Warnschwellen."
      />
    </>
  );
}
