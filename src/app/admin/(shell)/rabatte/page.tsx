import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Rabatte" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function RabattePage() {
  await requireStaff("support", { next: "/admin/rabatte" });
  return (
    <>
      <PageHeader title="Rabatte" />
      <ComingSoon title="Rabatte" description="Rabattcodes, Regeln und Nutzung." />
    </>
  );
}
