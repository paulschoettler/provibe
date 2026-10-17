import { NextResponse, type NextRequest } from "next/server";
import { loginUrl } from "@/lib/auth/redirect";
import { getCurrentCustomer } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Rechnung als PDF. Die Bestellung wird mit der Nutzer-Session geladen (RLS: nur eigene),
 * das PDF liegt unveränderbar im privaten Bucket invoices und wird serverseitig gelesen.
 * Ohne Rechnung: 404 mit Hinweis.
 */
export const dynamic = "force-dynamic";

function notFound(number: string, message: string) {
  const safe = number.replace(/[^A-Za-z0-9#-]/g, "");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Rechnung nicht verfügbar | provibe</title></head>
<body style="margin:0;background:#FBF8EE;color:#4A2F39;font-family:Jost,system-ui,sans-serif">
<main style="max-width:560px;margin:0 auto;padding:64px 16px">
<p style="font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;color:#7E2856;margin:0 0 12px">Dein Konto</p>
<h1 style="font-size:32px;line-height:1.1;color:#6B1D49;margin:0 0 16px">Rechnung noch nicht verfügbar</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">${message}</p>
<p><a href="/account/bestellungen/${encodeURIComponent(safe)}" style="color:#7E2856;font-weight:600">Zurück zur Bestellung</a></p>
</main></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ nummer: string }> }) {
  const { nummer } = await ctx.params;
  const number = decodeURIComponent(nummer);
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.redirect(
      new URL(
        loginUrl(`/account/bestellungen/${encodeURIComponent(number)}`),
        request.nextUrl.origin,
      ),
      { status: 303 },
    );
  }
  if (!/^[A-Za-z0-9#-]{3,40}$/.test(number)) {
    return notFound(number, "Diese Bestellung haben wir nicht gefunden.");
  }

  const supabase = await supabaseServer();
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, invoice_number, invoice_pdf_path, invoice_status")
    .eq("order_number", number)
    .maybeSingle();
  if (!order) return notFound(number, "Diese Bestellung haben wir in deinem Konto nicht gefunden.");
  if (!order.invoice_pdf_path) {
    return notFound(
      number,
      "Die Rechnung wird nach der Zahlung erstellt und kommt zusätzlich per E-Mail. Schau in ein paar Minuten noch einmal vorbei. Fehlt sie dann immer noch, schreib uns an hello@provibe-drinks.de.",
    );
  }

  const path = order.invoice_pdf_path.replace(/^invoices\//, "");
  const { data: file, error } = await supabaseAdmin().storage.from("invoices").download(path);
  if (error || !file) {
    console.error("[konto] Rechnung nicht lesbar", order.order_number, error?.message);
    return notFound(
      number,
      "Die Rechnung ist gerade nicht abrufbar. Bitte versuch es später noch einmal.",
    );
  }

  const filename = `Rechnung-${(order.invoice_number ?? order.order_number).replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
  return new NextResponse(await file.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
