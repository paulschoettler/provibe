import type { Metadata, Viewport } from "next";
import { BRAND_COLORS } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: { default: "Backoffice", template: "%s | provibe Backoffice" },
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

/** Browserleiste in der Seitenleistenfarbe (Wildberry); themeColor kennt keine CSS-Variablen. */
export const viewport: Viewport = { themeColor: BRAND_COLORS.wildberry };

/**
 * Wurzel des Backoffice. [data-admin] schaltet die Admin-Tokens frei (globals.css, Block "Admin Shell").
 * Anmeldung und Zwei-Faktor liegen in (auth) ohne Shell, alle übrigen Seiten in (shell) mit requireStaff.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div data-admin="">{children}</div>;
}
