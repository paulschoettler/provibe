import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { buildCustomerDataExport } from "@/lib/admin/customers/data-export";

/**
 * Datenauskunft nach DSGVO Art. 15 als JSON-Download. Prüfung über guard.ts (viewCustomers),
 * Protokolleintrag customer.data_export in buildCustomerDataExport.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff("support", { next: `/admin/kunden/${id}` });
  if (!PERMISSIONS.viewCustomers(session))
    return new Response("Keine Berechtigung", { status: 403 });
  try {
    const { export: data, fileName } = await buildCustomerDataExport(id, session);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auskunft fehlgeschlagen";
    return new Response(message, {
      status: message.includes("nicht gefunden") ? 404 : 500,
    });
  }
}
