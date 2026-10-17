import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Shopdaten" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EinstellungenShopdatenPage() {
  await requireStaff("support", { next: "/admin/einstellungen/shopdaten" });
  return (
    <>
      <PageHeader title="Shopdaten" />
      <ComingSoon title="Shopdaten" description="Firmendaten, Kontakt und Absender." />
    </>
  );
}
