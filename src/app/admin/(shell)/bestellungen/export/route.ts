import { NextResponse, type NextRequest } from "next/server";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { exportOrdersCsv } from "@/lib/admin/orders/export";
import { toActionError } from "@/lib/admin/orders/errors";
import { filterFromParams, type ListParams } from "@/lib/admin/orders/url";

/**
 * CSV-Export der Bestellliste: mit ids nur die Auswahl, sonst exakt der Filter der Liste (ohne
 * Seitenbegrenzung). Enthält Kundendaten, deshalb nur für Rollen mit viewCustomers; jeder Export
 * steht im Audit-Log (exportOrdersCsv).
 */
export const dynamic = "force-dynamic";

function paramsOf(request: NextRequest): ListParams {
  const out: ListParams = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const all = request.nextUrl.searchParams.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export async function GET(request: NextRequest) {
  const session = await requireStaff("support", { next: "/admin/bestellungen" });
  if (!PERMISSIONS.viewCustomers(session)) {
    return new NextResponse("Der Export enthält Kundendaten und ist für deine Rolle gesperrt.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const filter = filterFromParams(paramsOf(request), { pageSize: 200 });
  try {
    const result = await exportOrdersCsv(filter, session);
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
        "X-Export-Rows": String(result.rowCount),
      },
    });
  } catch (error) {
    return new NextResponse(toActionError(error).message, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
