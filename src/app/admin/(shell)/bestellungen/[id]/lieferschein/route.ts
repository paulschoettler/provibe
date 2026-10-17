import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin/auth";
import { renderPackingSlip } from "@/lib/admin/fulfilment/packing-slip";

/** Lieferschein einer Bestellung als druckfertiges HTML (ohne Preise). Alle Staff-Rollen. */
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await requireStaff("support", { next: `/admin/bestellungen/${encodeURIComponent(id)}` });
  try {
    const { html } = await renderPackingSlip(decodeURIComponent(id));
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new NextResponse("Bestellung nicht gefunden.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
