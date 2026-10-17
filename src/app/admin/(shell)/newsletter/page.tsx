import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Newsletter" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function NewsletterPage() {
  await requireStaff("support", { next: "/admin/newsletter" });
  return (
    <>
      <PageHeader title="Newsletter" />
      <ComingSoon
        title="Newsletter"
        description="Kontakte, Kampagnen mit Block-Editor, Testversand, Planung und Kennzahlen."
      />
    </>
  );
}
