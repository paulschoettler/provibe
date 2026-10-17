import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  getCancellationRequest,
  type CancellationRequestDetail as Detail,
} from "@/lib/subscriptions/admin-queries";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CancellationRequestDetail } from "@/components/admin/subscriptions/CancellationRequestDetail";

export const metadata: Metadata = { title: "Kündigung" };

const LIST = "/admin/abos/kuendigungen";

/** /admin/abos/kuendigungen/[id]: eine Kündigungserklärung ohne Login mit Zuordnung und Klärung. */
export default async function CancellationRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `${LIST}/${id}` });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  let entry: Detail | null = null;
  try {
    entry = await getCancellationRequest(id);
  } catch (error) {
    console.error("[admin] Kündigungsanfrage", error);
    return (
      <>
        <PageHeader title="Kündigung" backHref={LIST} backLabel="Kündigungen" />
        <FormMessage tone="error">Die Kündigung konnte gerade nicht geladen werden.</FormMessage>
      </>
    );
  }
  if (!entry) notFound();
  return (
    <>
      <PageHeader
        title={`Kündigung von ${entry.name}`}
        backHref={LIST}
        backLabel="Kündigungen"
        description={entry.email}
      />
      <CancellationRequestDetail entry={entry} />
    </>
  );
}
