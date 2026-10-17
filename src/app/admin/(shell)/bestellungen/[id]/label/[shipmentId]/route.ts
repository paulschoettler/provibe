import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { getShippingLabelUrl } from "@/lib/admin/fulfilment/shipments";
import { ordersDb } from "@/lib/admin/orders/db";

/** DHL-Label einer Sendung: Weiterleitung auf eine frische signierte URL (10 Minuten). */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; shipmentId: string }> },
) {
  const { id, shipmentId } = await ctx.params;
  const session = await requireStaff("support", {
    next: `/admin/bestellungen/${encodeURIComponent(id)}`,
  });
  if (!PERMISSIONS.fulfil(session)) {
    return new NextResponse("Labels sehen Owner, Admin und Fulfillment.", { status: 403 });
  }
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(shipmentId).success) {
    return new NextResponse("Nicht gefunden.", { status: 404 });
  }
  const { data } = await ordersDb()
    .from("shipments")
    .select("id")
    .eq("id", shipmentId)
    .eq("order_id", id)
    .maybeSingle();
  if (!data) return new NextResponse("Nicht gefunden.", { status: 404 });
  const url = await getShippingLabelUrl(shipmentId, session).catch(() => null);
  if (!url) return new NextResponse("Für diese Sendung gibt es kein Label.", { status: 404 });
  return NextResponse.redirect(url, 303);
}
