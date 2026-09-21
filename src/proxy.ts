import { NextResponse, type NextRequest } from "next/server";

/**
 * Läuft vor jeder Anfrage.
 * 1. Bis zum Go-live: Basic Auth für die gesamte Site, wenn SITE_PROTECT_USER/PASSWORD gesetzt sind.
 *    Webhooks (/api/webhooks/*) und der Health-Check bleiben erreichbar, weil externe Dienste
 *    keine Zugangsdaten mitschicken.
 * 2. /admin ist immer noindex (zusätzlich zum Header in netlify.toml).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = process.env.SITE_PROTECT_USER;
  const password = process.env.SITE_PROTECT_PASSWORD;

  const isExempt = pathname.startsWith("/api/webhooks/") || pathname === "/api/health";

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

  const response = NextResponse.next();
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
