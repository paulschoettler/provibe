import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Leads" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function LeadsPage() {
  await requireStaff("support", { next: "/admin/leads" });
  return (
    <>
      <PageHeader title="Leads" />
      <ComingSoon title="Leads" description="Partner- und B2B-Anfragen mit Status." />
    </>
  );
}
