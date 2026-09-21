import type { Metadata } from "next";
import "./globals.css";

/**
 * Root-Layout. Bewusst ohne Design: Das kundenseitige Frontend entsteht erst nach den
 * Design-Beispielen des Auftraggebers (CLAUDE.md, "Aktuelle Sperren"). Schriften werden später
 * selbst gehostet (keine Google-Fonts-CDN-Einbindung).
 */
export const metadata: Metadata = {
  title: { default: "provibe", template: "%s | provibe" },
  description: "provibe: Eistee mit 15 g Protein.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
