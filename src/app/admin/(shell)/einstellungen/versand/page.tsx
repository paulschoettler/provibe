import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Versand" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EinstellungenVersandPage() {
  await requireStaff("support", { next: "/admin/einstellungen/versand" });
  return (
    <>
      <PageHeader title="Versand" />
      <ComingSoon title="Versand" description="Versandzonen und Tarife." />
    </>
  );
}
