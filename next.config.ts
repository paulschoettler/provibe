import type { NextConfig } from "next";

/**
 * Security-Header stehen hier und nicht nur in netlify.toml, weil Netlify die Header aus der
 * netlify.toml nicht auf Antworten des Next.js-Runtimes anwendet. Gleiches gilt für Umgebungs-
 * variablen aus [context.*.environment]: sie gelten nur im Build. Laufzeitwerte (APP_STAGE,
 * APP_INTEGRATIONS) sind deshalb als Netlify-Umgebungsvariablen je Kontext gesetzt.
 */
const indexable = process.env.SITE_INDEXABLE === "true" && process.env.APP_STAGE === "production";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(indexable ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Netlify Image CDN übernimmt die Optimierung (AVIF/WebP, responsive Größen)
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ajscwnbgaijknmdrtihn.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
