import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { getPage } from "@/lib/content/pages";

/**
 * Investoren-Pitch der Messe (F3): Inhalt 1:1 aus pages (Handle messe), nicht indexierbar.
 * Die Sprungmarken #deck und #termin der Shopify-Seite hatten kein Ziel mehr; sie führen
 * jetzt per E-Mail zu hello@ (Empfehlung F3: Buttons auf Mailto).
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("messe");
  return {
    title: page?.seoTitle ?? "Messe",
    description:
      page?.seoDescription ??
      "provibe für Investoren: Eistee mit Protein, Zielgruppe, Markt und Pitch Deck.",
    robots: { index: false, follow: false },
    alternates: { canonical: "/pages/messe" },
  };
}

const DECK = "mailto:hello@provibe-drinks.de?subject=Pitch%20Deck%20provibe";
const TERMIN = "mailto:hello@provibe-drinks.de?subject=Termin%20mit%20Celine";

/** Interne Sprungmarken ohne Ziel auf Mailto umstellen; Text bleibt unverändert. */
function rewriteAnchors(html: string): string {
  return html
    .replace(/href="#deck"/g, `href="${DECK}"`)
    .replace(/href="#termin"/g, `href="${TERMIN}"`)
    .replace(/href="#"/g, `href="${TERMIN}"`)
    .replace(
      /<a href="https:\/\/(instagram|tiktok)/g,
      '<a rel="noreferrer noopener" target="_blank" href="https://$1',
    );
}

export default async function MessePage() {
  const page = await getPage("messe");
  if (!page) notFound();
  const html = rewriteAnchors(page.bodyHtml);
  const hasH1 = /<h1[\s>]/i.test(html);
  return (
    <SiteShell>
      <article className="pv-container pv-before-footer pt-10 lg:max-w-[860px] lg:pt-16">
        {hasH1 ? null : <h1 className="pv-display mb-6">{page.title}</h1>}
        <div className="pv-prose" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </SiteShell>
  );
}
