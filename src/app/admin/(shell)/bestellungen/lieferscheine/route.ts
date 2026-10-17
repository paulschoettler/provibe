import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/admin/auth";
import { renderPackingSlips } from "@/lib/admin/fulfilment/packing-slip";
import { idsFrom } from "@/lib/admin/orders/url";

/**
 * Sammeldruck der Lieferscheine aus der Bestellliste (ids mehrfach oder kommagetrennt). Druckfertiges
 * HTML mit Seitenumbruch je Bestellung; PDF über "Drucken, Als PDF sichern" im Browser.
 */
export const dynamic = "force-dynamic";

function message(status: number, text: string) {
  return new NextResponse(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Lieferscheine</title></head><body style="font-family:Jost,system-ui,sans-serif;padding:32px"><p>${text}</p><p><a href="/admin/bestellungen">Zurück zu den Bestellungen</a></p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

export async function GET(request: NextRequest) {
  await requireStaff("support", { next: "/admin/bestellungen" });
  const ids = idsFrom({ ids: request.nextUrl.searchParams.getAll("ids") });
  if (ids.length === 0) return message(400, "Bitte wähle mindestens eine Bestellung aus.");
  try {
    const { html } = await renderPackingSlips(ids);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return message(404, "Keine der ausgewählten Bestellungen wurde gefunden.");
  }
}
