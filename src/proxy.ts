import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redirectFromTable } from "@/lib/redirects/proxy";

/**
 * Läuft vor jeder Anfrage.
 * 1. Bis zum Go-live: Basic Auth für die gesamte Site, wenn SITE_PROTECT_USER/PASSWORD gesetzt sind.
 *    Webhooks (/api/webhooks/*) und der Health-Check bleiben erreichbar, weil externe Dienste
 *    keine Zugangsdaten mitschicken.
 * 2. /admin ist immer noindex (zusätzlich zum Header in netlify.toml).
 * 3. Supabase-Session auffrischen, wenn ein Auth-Cookie da ist (Server Components können
 *    erneuerte Tokens nicht speichern, sonst fliegen Kunden nach einer Stunde raus).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = process.env.SITE_PROTECT_USER;
  const password = process.env.SITE_PROTECT_PASSWORD;

  const isExempt =
    pathname.startsWith("/api/webhooks/") ||
    pathname === "/api/health" ||
    pathname === "/api/jobs/run" ||
    pathname === "/api/newsletter/unsubscribe";

  if (user && password && !isExempt) {
    const header = request.headers.get("authorization") ?? "";
    const [scheme, encoded] = header.split(" ");
    let ok = false;
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const idx = decoded.indexOf(":");
      ok = decoded.slice(0, idx) === user && decoded.slice(idx + 1) === password;
    }
    if (!ok) {
      return new NextResponse("Zugang geschützt", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="provibe (Vorschau)", charset="UTF-8"' },
      });
    }
  }

  // Im Backoffice gepflegte Weiterleitungen (Tabelle redirects, je Instanz fünf Minuten gecacht)
  const tableRedirect = await redirectFromTable(request);
  if (tableRedirect) return tableRedirect;

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (hasAuthCookie && supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  }
  if (pathname.startsWith("/account") || pathname.startsWith("/auth")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  if (pathname.startsWith("/admin")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
