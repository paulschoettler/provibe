import type { MetadataRoute } from "next";

/**
 * Bis zum Go-live: alles gesperrt (zusätzlich X-Robots-Tag in netlify.toml).
 * Die finale robots.txt (Admin, Warenkorb, Checkout, Konto, Suche sperren, KI-Crawler erlauben)
 * kommt mit der Storefront in Phase 5.
 */
export default function robots(): MetadataRoute.Robots {
  const live = process.env.APP_STAGE === "production" && process.env.SITE_INDEXABLE === "true";
  if (!live) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.provibe-drinks.de";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/cart", "/checkout", "/account", "/search", "/api/"],
      },
      { userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"], allow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
