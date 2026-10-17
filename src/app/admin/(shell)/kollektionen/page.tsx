import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Kollektionen" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function KollektionenPage() {
  await requireStaff("support", { next: "/admin/kollektionen" });
  return (
    <>
      <PageHeader title="Kollektionen" />
      <ComingSoon title="Kollektionen" description="Manuelle und regelbasierte Kollektionen." />
    </>
  );
}
