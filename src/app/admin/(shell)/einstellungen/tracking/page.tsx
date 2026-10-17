import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/auth";
import { ComingSoon } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Tracking" };

/** Platzhalter: Folgt in Welle 2 (Muster siehe src/components/admin/ui/README.md). */
export default async function EinstellungenTrackingPage() {
  await requireStaff("support", { next: "/admin/einstellungen/tracking" });
  return (
    <>
      <PageHeader title="Tracking" />
      <ComingSoon title="Tracking" description="Tracking-IDs für Meta, Google und TikTok." />
    </>
  );
}
