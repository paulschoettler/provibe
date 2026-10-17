import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Segmente" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function SegmentePage() {
  await requireStaff("support", { next: "/admin/segmente" });
  return (
    <>
      <PageHeader title="Segmente" />
      <ComingSoon title="Segmente" description="Gespeicherte Filter als Zielgruppen." />
    </>
  );
}
