import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Steuern" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EinstellungenSteuernPage() {
  await requireStaff("support", { next: "/admin/einstellungen/steuern" });
  return (
    <>
      <PageHeader title="Steuern" />
      <ComingSoon title="Steuern" description="Steuersätze je Steuerklasse." />
    </>
  );
}
