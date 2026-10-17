import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Automationen" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function AutomationenPage() {
  await requireStaff("support", { next: "/admin/automationen" });
  return (
    <>
      <PageHeader title="Automationen" />
      <ComingSoon
        title="Automationen"
        description="Willkommen, Warenkorbabbrecher und Bewertungsanfrage, je abschaltbar."
      />
    </>
  );
}
