import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "E-Mails" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EmailsPage() {
  await requireStaff("support", { next: "/admin/emails" });
  return (
    <>
      <PageHeader title="E-Mails" />
      <ComingSoon
        title="E-Mails"
        description="Transaktionale Vorlagen einsehen und Versandprotokoll."
      />
    </>
  );
}
