import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { EMPTY_CART } from "@/lib/cart/types";
import "./globals.css";

/** Jost, selbst gehostet (SIL Open Font License 1.1, siehe src/fonts/OFL.txt). Keine Google-Fonts-CDN-Einbindung. */
const jost = localFont({
  src: [
    { path: "../fonts/jost-variable.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/jost-italic-variable.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-jost",
  display: "swap",
  preload: true,
});

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
  themeColor: "#fbf8ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={jost.variable} suppressHydrationWarning>
      <head>
        {/* Progressive Enhancement: Effekte nur mit JS, Inhalte immer im HTML.
            Als data-Attribut statt Klasse, weil React bei einer Hydration-Wiederholung
            (zum Beispiel durch Browser-Erweiterungen, die vor dem Start ins DOM schreiben)
            className von <html> neu setzt und Klassen aus Skripten verloren gehen. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-js','')",
          }}
        />
      </head>
      <body>
        {/* Warenkorb: Stand kommt nach dem Mounten per Server Action, damit das Layout statisch bleibt (ADR-010) */}
        <CartProvider initialCart={EMPTY_CART}>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
