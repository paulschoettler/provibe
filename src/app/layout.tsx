import type { Metadata, Viewport } from "next";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ConsentRoot } from "@/components/consent/ConsentRoot";
import { EMPTY_CART } from "@/lib/cart/types";
import { BRAND_COLORS } from "@/lib/brand/tokens";
// CI-Tokens zuerst (lädt über @import einmal das Adobe-Kit sne6rux), dann die Site-Styles
import "../../brand/provibe-ci/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "provibe: Eistee mit Protein", template: "%s | provibe" },
  description:
    "provibe ist erfrischender Eistee mit 15 g Protein, ohne Zucker, ready to drink. Wildberry, Raspberry Lime und Peach.",
  robots: { index: false, follow: false },
  openGraph: { locale: "de_DE", siteName: "provibe", type: "website" },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.cream,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Adobe-Fonts-Kit: geladen über brand/provibe-ci/tokens.css (ein @import), hier nur der Preconnect */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        {/* Progressive Enhancement: Effekte nur mit JS, Inhalte immer im HTML.
            Als data-Attribut statt Klasse, weil React bei einer Hydration-Wiederholung
            (zum Beispiel durch Browser-Erweiterungen, die vor dem Start ins DOM schreiben)
            className von <html> neu setzt und Klassen aus Skripten verloren gehen. Ein
            MutationObserver setzt das Attribut wieder, falls React es beim Neuaufbau entfernt. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var h=document.documentElement;h.setAttribute('data-js','');" +
              "if(window.MutationObserver){new MutationObserver(function(){if(!h.hasAttribute('data-js'))h.setAttribute('data-js','')})" +
              ".observe(h,{attributes:true,attributeFilter:['data-js']})}})()",
          }}
        />
      </head>
      <body>
        {/* Warenkorb: Stand kommt nach dem Mounten per Server Action, damit das Layout statisch bleibt (ADR-010) */}
        <CartProvider initialCart={EMPTY_CART}>
          {children}
          <CartDrawer />
          {/* Consent-Banner, Einstellungsdialog und Tracking (nur nach Einwilligung) */}
          <ConsentRoot />
        </CartProvider>
      </body>
    </html>
  );
}
