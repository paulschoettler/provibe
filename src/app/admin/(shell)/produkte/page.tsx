import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Produkte" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function ProduktePage() {
  await requireStaff("support", { next: "/admin/produkte" });
  return (
    <>
      <PageHeader title="Produkte" />
      <ComingSoon
        title="Produkte"
        description="Produkte, Varianten, Bundles, Bilder, LMIV, Pfand, Steuer, SEO und Kollektionen."
      />
    </>
  );
}
