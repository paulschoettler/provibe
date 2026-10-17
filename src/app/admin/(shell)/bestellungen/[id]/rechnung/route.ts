import { NextResponse, type NextRequest } from "next/server";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { getInvoicePdfUrl } from "@/lib/admin/invoices/invoices";
import { resolveOrderId } from "@/lib/admin/orders/db";

/**
 * Rechnungs-PDF anzeigen: Weiterleitung auf eine signierte URL (10 Minuten) im privaten Bucket.
 * Erzeugt nichts (ensure: false); fehlt das PDF, zurück zum Detail. Erzeugen läuft über die
 * Server Action "Rechnung erzeugen". Nicht für Fulfillment (Beträge, Kundendaten).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const back = `/admin/bestellungen/${encodeURIComponent(id)}`;
  const session = await requireStaff("support", { next: back });
  if (!PERMISSIONS.viewCustomers(session)) {
    return new NextResponse("Rechnungen sind für deine Rolle nicht freigegeben.", { status: 403 });
  }
  const orderId = await resolveOrderId(decodeURIComponent(id));
  if (!orderId) return new NextResponse("Bestellung nicht gefunden.", { status: 404 });
  try {
    const link = await getInvoicePdfUrl(orderId, { ensure: false });
    if (!link) return NextResponse.redirect(new URL(back, request.nextUrl.origin), 303);
    return NextResponse.redirect(link.url, 303);
  } catch {
    return new NextResponse("Das PDF ist gerade nicht abrufbar.", { status: 502 });
  }
}
